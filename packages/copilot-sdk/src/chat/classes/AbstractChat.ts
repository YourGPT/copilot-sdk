/**
 * AbstractChat - Framework-agnostic chat orchestration
 *
 * This class coordinates:
 * - Message sending and receiving
 * - Stream processing
 * - State updates via injected ChatState
 *
 * Framework adapters (React, Vue, etc.) extend this class
 * and inject their own state implementation.
 */

import type {
  ContextUsage,
  MessageAttachment,
  ToolDefinition,
  ToolOptimizationConfig,
} from "../../core";
import type { ChatState } from "../interfaces/ChatState";
import type {
  ChatTransport,
  StreamChunk,
  ChatResponse,
} from "../interfaces/ChatTransport";
import type {
  UIMessage,
  ChatConfig,
  ChatCallbacks,
  ChatInit,
  StreamingMessageState,
} from "../types/index";
import { HttpTransport } from "../adapters/HttpTransport";
import {
  createUserMessage,
  createEmptyAssistantMessage,
  generateMessageId,
  streamStateToMessage,
} from "../functions/message";
import {
  createStreamState,
  processStreamChunk,
  isStreamDone,
} from "../functions/stream";
import { SimpleChatState } from "../interfaces/ChatState";
import { ChatContextOptimizer } from "../optimizations";

/**
 * Event types emitted by AbstractChat
 */
export type ChatEvent =
  | { type: "toolCalls"; toolCalls: UIMessage["toolCalls"] }
  | { type: "done" }
  | { type: "error"; error: Error };

/**
 * Event handler type
 */
export type ChatEventHandler<T extends ChatEvent["type"]> = (
  event: Extract<ChatEvent, { type: T }>,
) => void;

/**
 * AbstractChat - Core chat functionality
 *
 * @example
 * ```typescript
 * // With React state
 * class ReactChat extends AbstractChat {
 *   constructor(config: ChatInit) {
 *     const state = new ReactChatState();
 *     super({ ...config, state });
 *   }
 * }
 *
 * // Usage
 * const chat = new ReactChat({ runtimeUrl: '/api/chat' });
 * await chat.sendMessage('Hello!');
 * ```
 */
export class AbstractChat<T extends UIMessage = UIMessage> {
  protected state: ChatState<T>;
  protected transport: ChatTransport;
  protected config: ChatConfig;
  protected callbacks: ChatCallbacks<T>;
  protected optimizer: ChatContextOptimizer;
  protected lastContextUsage: ContextUsage | null = null;

  // Event handlers
  private eventHandlers = new Map<
    ChatEvent["type"],
    Set<ChatEventHandler<ChatEvent["type"]>>
  >();

  // Current streaming state
  private streamState: StreamingMessageState | null = null;

  constructor(init: ChatInit<T>) {
    this.config = {
      runtimeUrl: init.runtimeUrl,
      llm: init.llm,
      systemPrompt: init.systemPrompt,
      streaming: init.streaming ?? true,
      headers: init.headers,
      body: init.body,
      threadId: init.threadId,
      debug: init.debug,
      optimization: init.optimization,
    };

    // Use provided state or create default
    this.state =
      (init.state as ChatState<T>) ??
      (new SimpleChatState<T>() as ChatState<T>);

    // Use provided transport or create default
    // Pass Resolvable values - they are resolved at request time
    this.transport =
      init.transport ??
      new HttpTransport({
        url: init.runtimeUrl,
        headers: init.headers,
        body: init.body,
        streaming: init.streaming ?? true,
      });

    // Store callbacks
    this.callbacks = init.callbacks ?? {};
    this.optimizer = new ChatContextOptimizer(init.optimization);

    // Set initial messages
    if (init.initialMessages?.length) {
      this.state.setMessages(init.initialMessages);
    }
  }

  // ============================================
  // Public Getters
  // ============================================

  get messages(): T[] {
    return this.state.messages;
  }

  get status() {
    return this.state.status;
  }

  get error() {
    return this.state.error;
  }

  get isStreaming(): boolean {
    return this.transport.isStreaming();
  }

  // ============================================
  // Public Actions
  // ============================================

  /**
   * Check if a request is currently in progress
   */
  get isBusy(): boolean {
    return (
      this.state.status === "submitted" || this.state.status === "streaming"
    );
  }

  /**
   * Send a message
   * Returns false if a request is already in progress
   */
  async sendMessage(
    content: string,
    attachments?: MessageAttachment[],
  ): Promise<boolean> {
    // Guard: Don't send if already processing
    if (this.isBusy) {
      this.debug("sendMessage", "Blocked - request already in progress");
      return false;
    }

    this.debug("sendMessage", { content, attachments });

    try {
      // IMPORTANT: Resolve any pending tool_calls before sending
      // This prevents Anthropic API errors: "tool_use without tool_result"
      this.resolveUnresolvedToolCalls();

      // Create user message
      const userMessage = createUserMessage(content, attachments) as T;

      // Add to state
      this.state.pushMessage(userMessage);
      this.state.status = "submitted";
      this.state.error = undefined;

      // Notify callbacks
      this.callbacks.onMessagesChange?.(this.state.messages);
      this.callbacks.onStatusChange?.("submitted");

      // Yield to allow UI to render loading state (important for non-streaming)
      await Promise.resolve();

      // Send request
      await this.processRequest();
      return true;
    } catch (error) {
      this.handleError(error as Error);
      return false;
    }
  }

  /**
   * Resolve any tool_calls that don't have corresponding tool_results.
   * This prevents Anthropic API errors when tool_use has no tool_result.
   * Can happen when max iterations is reached or tool execution is interrupted.
   */
  private resolveUnresolvedToolCalls(): void {
    const messages = this.state.messages;

    // Collect all tool_call IDs from assistant messages
    const allToolCallIds = new Set<string>();
    // Collect resolved tool_call IDs from tool messages
    const resolvedIds = new Set<string>();

    for (const msg of messages) {
      if (msg.role === "assistant" && msg.toolCalls?.length) {
        for (const tc of msg.toolCalls) {
          allToolCallIds.add(tc.id);
        }
      }
      if (msg.role === "tool" && msg.toolCallId) {
        resolvedIds.add(msg.toolCallId);
      }
    }

    // Find unresolved tool_calls
    const unresolvedIds = [...allToolCallIds].filter(
      (id) => !resolvedIds.has(id),
    );

    if (unresolvedIds.length > 0) {
      this.debug(
        "resolveUnresolvedToolCalls",
        `Adding ${unresolvedIds.length} missing tool results`,
      );

      // Add error result for each unresolved tool_call
      for (const toolCallId of unresolvedIds) {
        const toolMessage = {
          id: generateMessageId(),
          role: "tool" as const,
          content: JSON.stringify({
            success: false,
            error: "Tool execution was interrupted. Please try again.",
          }),
          toolCallId,
          createdAt: new Date(),
        } as T;

        this.state.pushMessage(toolMessage);
      }

      this.callbacks.onMessagesChange?.(this.state.messages);
    }
  }

  /**
   * Continue with tool results
   *
   * Automatically handles `addAsUserMessage` flag in results (e.g., screenshots).
   * When a tool result has this flag, the attachment is extracted and sent as
   * a user message so the AI can see it (e.g., for vision analysis).
   */
  async continueWithToolResults(
    toolResults: Array<{ toolCallId: string; result: unknown }>,
  ): Promise<void> {
    this.debug("continueWithToolResults", toolResults);

    try {
      // Process results - extract attachments that should be added as user message
      const attachmentsToAdd: MessageAttachment[] = [];

      for (const { toolCallId, result } of toolResults) {
        // Check if result wants to be added as user message (e.g., screenshot)
        const typedResult = result as {
          success?: boolean;
          message?: string;
          addAsUserMessage?: boolean;
          data?: {
            attachment?: MessageAttachment;
          };
        } | null;

        let messageContent: string;

        if (typedResult?.addAsUserMessage && typedResult.data?.attachment) {
          this.debug(
            "Tool result has attachment to add as user message",
            typedResult.data.attachment.type,
          );
          attachmentsToAdd.push(typedResult.data.attachment);

          // Simplified result without base64 data
          messageContent = JSON.stringify({
            success: true,
            message: typedResult.message || "Content shared in conversation.",
          });
        } else {
          // Store FULL result in message (Vercel-style)
          // Transformation happens at send time in buildRequest()
          messageContent =
            typeof result === "string" ? result : JSON.stringify(result);
        }

        const toolMessage = {
          id: generateMessageId(),
          role: "tool" as const,
          content: messageContent,
          toolCallId,
          createdAt: new Date(),
        } as T;

        this.state.pushMessage(toolMessage);
      }

      // If there are attachments (e.g., screenshots), add user message so AI can see them
      if (attachmentsToAdd.length > 0) {
        this.debug(
          "Adding user message with attachments",
          attachmentsToAdd.length,
        );
        const userMessage = {
          id: generateMessageId(),
          role: "user" as const,
          content: "Here's my screen:",
          attachments: attachmentsToAdd,
          createdAt: new Date(),
        } as T;

        this.state.pushMessage(userMessage);
      }

      this.state.status = "submitted";
      this.callbacks.onMessagesChange?.(this.state.messages);
      this.callbacks.onStatusChange?.("submitted");

      // Yield a full macrotask so React can flush the "submitted" status
      // before the next request fires. Promise.resolve() is a microtask and
      // is not enough for React 18 to render the loading state.
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Continue request
      await this.processRequest();
    } catch (error) {
      this.handleError(error as Error);
    }
  }

  /**
   * Stop generation
   */
  stop(): void {
    this.transport.abort();
    this.state.status = "ready";
    this.callbacks.onStatusChange?.("ready");
  }

  /**
   * Clear all messages
   */
  clearMessages(): void {
    this.state.clearMessages();
    this.callbacks.onMessagesChange?.([]);
  }

  /**
   * Set messages directly
   */
  setMessages(messages: T[]): void {
    this.state.setMessages(messages);
    this.callbacks.onMessagesChange?.(messages);
  }

  /**
   * Regenerate last response
   */
  async regenerate(messageId?: string): Promise<void> {
    // Remove messages from the specified ID (or last assistant message)
    const messages = this.state.messages;
    let targetIndex = messages.length - 1;

    if (messageId) {
      targetIndex = messages.findIndex((m) => m.id === messageId);
    } else {
      // Find last assistant message
      for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i].role === "assistant") {
          targetIndex = i;
          break;
        }
      }
    }

    if (targetIndex > 0) {
      // Remove from target onwards
      this.state.setMessages(messages.slice(0, targetIndex));
      this.callbacks.onMessagesChange?.(this.state.messages);

      // Resend
      await this.processRequest();
    }
  }

  // ============================================
  // Event Handling
  // ============================================

  /**
   * Subscribe to events
   */
  on<E extends ChatEvent["type"]>(
    event: E,
    handler: ChatEventHandler<E>,
  ): () => void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.eventHandlers.get(event)!.add(handler as any);

    return () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.eventHandlers.get(event)?.delete(handler as any);
    };
  }

  /**
   * Emit an event
   */
  protected emit<E extends ChatEvent["type"]>(
    type: E,
    data: Omit<Extract<ChatEvent, { type: E }>, "type">,
  ): void {
    const event = { type, ...data } as ChatEvent;
    const handlers = this.eventHandlers.get(type);
    if (type === "toolCalls") {
      this.debug(`emit(toolCalls): ${handlers?.size || 0} handlers registered`);
    }
    this.eventHandlers.get(type)?.forEach((handler) => handler(event));
  }

  // ============================================
  // Protected Methods
  // ============================================

  /**
   * Process a chat request
   */
  protected async processRequest(): Promise<void> {
    // Build request
    const request = this.buildRequest();

    // Send request
    const response = await this.transport.send(request);

    // Check if streaming or JSON
    if (this.isAsyncIterable(response)) {
      await this.handleStreamResponse(response);
    } else {
      this.handleJsonResponse(response);
    }
  }

  /**
   * Set tools available for the LLM
   */
  setTools(tools: ToolDefinition[]): void {
    this.config.tools = tools;
  }

  /**
   * Update prompt/tool optimization behavior.
   */
  setOptimizationConfig(config?: ToolOptimizationConfig): void {
    this.config.optimization = config;
    this.optimizer.updateConfig(config);
  }

  /**
   * Select the active tool profile for future requests.
   */
  setToolProfile(profile?: string): void {
    this.optimizer.setActiveProfile(profile);
  }

  /**
   * Get the most recent prompt context usage snapshot.
   */
  getContextUsage(): ContextUsage | null {
    return this.lastContextUsage;
  }

  /**
   * Dynamic context from useAIContext hook
   */
  protected dynamicContext: string = "";

  /**
   * Optional transform applied to messages just before building the HTTP request.
   * Used by the message-history / compaction system to send a pruned message list
   * without mutating the in-memory store (which keeps the full history for display).
   */
  private requestMessageTransform:
    | ((messages: UIMessage[]) => UIMessage[])
    | null = null;

  /**
   * Set (or clear) the per-request message transform.
   * Pass null to disable.
   */
  setRequestMessageTransform(
    fn: ((messages: UIMessage[]) => UIMessage[]) | null,
  ): void {
    this.requestMessageTransform = fn;
  }

  /**
   * Set dynamic context (appended to system prompt)
   */
  setContext(context: string): void {
    this.dynamicContext = context;
    this.debug("Context updated", { length: context.length });
  }

  /**
   * Set system prompt dynamically
   * This allows updating the system prompt after initialization
   */
  setSystemPrompt(prompt: string): void {
    this.config.systemPrompt = prompt;
    this.debug("System prompt updated", { length: prompt.length });
  }

  /**
   * Set headers configuration
   * Can be static headers or a getter function for dynamic resolution
   */
  setHeaders(headers: ChatConfig["headers"]): void {
    this.config.headers = headers;
    if (this.transport.setHeaders && headers !== undefined) {
      this.transport.setHeaders(headers);
    }
    this.debug("Headers config updated");
  }

  /**
   * Set URL configuration
   * Can be static URL or a getter function for dynamic resolution
   */
  setUrl(url: ChatConfig["runtimeUrl"]): void {
    this.config.runtimeUrl = url;
    if (this.transport.setUrl) {
      this.transport.setUrl(url);
    }
    this.debug("URL config updated");
  }

  /**
   * Set body configuration
   * Additional properties merged into every request body
   */
  setBody(body: ChatConfig["body"]): void {
    this.config.body = body;
    if (this.transport.setBody && body !== undefined) {
      this.transport.setBody(body);
    }
    this.debug("Body config updated");
  }

  /**
   * Build the request payload
   */
  protected buildRequest() {
    const systemPrompt = this.dynamicContext
      ? `${this.config.systemPrompt || ""}\n\n## Current App Context:\n${this.dynamicContext}`.trim()
      : this.config.systemPrompt;
    const rawMessages = this.requestMessageTransform
      ? (this.requestMessageTransform(
          this.state.messages as UIMessage[],
        ) as T[])
      : this.state.messages;
    const optimized = this.optimizer.prepare({
      messages: rawMessages,
      tools: this.config.tools,
      systemPrompt,
    });
    this.lastContextUsage = optimized.contextUsage;
    this.callbacks.onContextUsageChange?.(optimized.contextUsage);

    return {
      messages: optimized.messages,
      threadId: this.config.threadId,
      systemPrompt,
      llm: this.config.llm,
      tools: this.config.tools?.length
        ? this.config.tools.map((tool) => ({
            name: tool.name,
            description: tool.description,
            category: tool.category,
            group: tool.group,
            deferLoading: tool.deferLoading,
            profiles: tool.profiles,
            searchKeywords: tool.searchKeywords,
            inputSchema: tool.inputSchema,
          }))
        : undefined,
    };
  }

  /**
   * Handle streaming response
   */
  protected async handleStreamResponse(
    stream: AsyncIterable<StreamChunk>,
  ): Promise<void> {
    this.state.status = "streaming";
    this.callbacks.onStatusChange?.("streaming");

    // Create empty assistant message for streaming
    const assistantMessage = createEmptyAssistantMessage() as T;
    this.state.pushMessage(assistantMessage);

    // Initialize stream state
    this.streamState = createStreamState(assistantMessage.id);
    this.callbacks.onMessageStart?.(assistantMessage.id);

    this.debug("handleStreamResponse", "Starting to process stream");

    let chunkCount = 0;
    let toolCallsEmitted = false; // Guard to prevent emitting toolCalls twice

    // Process stream chunks
    for await (const chunk of stream) {
      chunkCount++;
      this.debug("chunk", { count: chunkCount, type: chunk.type });

      // Handle error chunks immediately
      if (chunk.type === "error") {
        const error = new Error(chunk.message || "Stream error");
        this.handleError(error);
        return;
      }

      // Handle message:end mid-stream (server-side agent loop turn completed)
      // This creates separate messages for each turn instead of combining them
      if (chunk.type === "message:end" && this.streamState?.content) {
        this.debug("message:end mid-stream - finalizing current turn");

        // Finalize current message with its content and tool calls
        const turnMessage = streamStateToMessage(this.streamState) as T;

        // Add toolCallsHidden metadata if applicable
        const toolCallsHidden: Record<string, boolean> = {};
        for (const [id, result] of this.streamState.toolResults) {
          if (result.hidden !== undefined) {
            toolCallsHidden[id] = result.hidden;
          }
        }
        if (
          turnMessage.toolCalls?.length &&
          Object.keys(toolCallsHidden).length > 0
        ) {
          (turnMessage as T & { metadata?: Record<string, unknown> }).metadata =
            {
              ...(turnMessage as T & { metadata?: Record<string, unknown> })
                .metadata,
              toolCallsHidden,
            };
        }

        this.state.updateMessageById(
          this.streamState.messageId,
          () => turnMessage,
        );
        this.callbacks.onMessageFinish?.(turnMessage);

        // Reset stream state for next turn - will be initialized on next message:start
        this.streamState = null;
        continue;
      }

      // Handle message:start after a mid-stream finalization
      if (chunk.type === "message:start" && this.streamState === null) {
        this.debug("message:start after mid-stream end - creating new message");
        const newMessage = createEmptyAssistantMessage() as T;
        this.state.pushMessage(newMessage);
        this.streamState = createStreamState(newMessage.id);
        this.callbacks.onMessageStart?.(newMessage.id);
        continue;
      }

      // Update stream state (pure function)
      // Skip if streamState is null (shouldn't happen but be safe)
      if (!this.streamState) {
        this.debug("warning", "streamState is null, skipping chunk");
        continue;
      }
      this.streamState = processStreamChunk(chunk, this.streamState);

      // Emit server tool callbacks for action events
      if (chunk.type === "action:start") {
        this.callbacks.onServerToolStart?.({
          id: chunk.id,
          name: chunk.name,
          hidden: chunk.hidden,
        });
      } else if (chunk.type === "action:args") {
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(chunk.args);
        } catch {
          // Keep empty args
        }
        // Get name from toolResults (set by action:start)
        const existingResult = this.streamState?.toolResults.get(chunk.id);
        if (existingResult) {
          this.callbacks.onServerToolArgs?.({
            id: chunk.id,
            name: existingResult.name,
            args,
          });
        }
      } else if (chunk.type === "action:end") {
        this.callbacks.onServerToolEnd?.({
          id: chunk.id,
          name: chunk.name,
          result: chunk.result,
          error: chunk.error,
        });
      }

      // Update message in state BY ID (not last position)
      // This is critical: when tool calls trigger nested streams,
      // updateLastMessage would update the wrong message
      const updatedMessage = streamStateToMessage(this.streamState) as T;
      this.state.updateMessageById(
        this.streamState.messageId,
        () => updatedMessage,
      );

      // Notify delta callback
      if (chunk.type === "message:delta") {
        this.callbacks.onMessageDelta?.(assistantMessage.id, chunk.content);
      }

      // Check for completion
      if (isStreamDone(chunk)) {
        this.debug("streamDone", { chunk });

        // CRITICAL: Process messages from done event (server-side tool results)
        // Without this, tool_call_id is lost and causes Anthropic API errors
        if (chunk.type === "done" && chunk.messages?.length) {
          this.debug("processDoneMessages", {
            count: chunk.messages.length,
          });

          const currentStreamToolCallIds = new Set(
            this.streamState?.toolCalls?.map((toolCall) => toolCall.id) ?? [],
          );
          const messagesToInsert: T[] = [];

          // Build hidden map from stream state's toolResults
          const toolCallsHidden: Record<string, boolean> = {};
          if (this.streamState?.toolResults) {
            for (const [id, result] of this.streamState.toolResults) {
              if (result.hidden !== undefined) {
                toolCallsHidden[id] = result.hidden;
              }
            }
          }

          for (const msg of chunk.messages) {
            // Skip plain assistant text messages because they are already represented
            // by streamed message:start/message:delta/message:end events. Preserve
            // assistant messages that carry tool_calls so tool results keep a valid
            // preceding assistant tool_call message in local state.
            if (msg.role === "assistant" && !msg.tool_calls?.length) {
              continue;
            }

            // The current streamed turn already becomes an assistant message from
            // streamState/tool_calls handling. Skip the duplicate copy from the
            // done payload, but keep assistant tool_call messages from earlier
            // recursive turns (for example search_tools followed by a later client
            // tool call).
            if (
              msg.role === "assistant" &&
              msg.tool_calls?.length &&
              (msg.tool_calls as Array<{ id: string }>).every((toolCall) =>
                currentStreamToolCallIds.has(toolCall.id),
              )
            ) {
              continue;
            }

            // For assistant messages with tool_calls, add hidden metadata
            let metadata: Record<string, unknown> | undefined;
            if (
              msg.role === "assistant" &&
              msg.tool_calls?.length &&
              Object.keys(toolCallsHidden).length > 0
            ) {
              metadata = { toolCallsHidden };
            }

            const message = {
              id: generateMessageId(),
              role: msg.role as T["role"],
              content: msg.content ?? "",
              toolCalls: msg.tool_calls as T["toolCalls"],
              toolCallId: msg.tool_call_id,
              createdAt: new Date(),
              metadata,
            } as T;

            messagesToInsert.push(message);
          }

          if (messagesToInsert.length > 0) {
            const currentMessages = this.state.messages;
            const currentStreamIndex = this.streamState
              ? currentMessages.findIndex(
                  (message) => message.id === this.streamState!.messageId,
                )
              : -1;

            if (currentStreamIndex === -1) {
              this.state.setMessages([...currentMessages, ...messagesToInsert]);
            } else {
              this.state.setMessages([
                ...currentMessages.slice(0, currentStreamIndex),
                ...messagesToInsert,
                ...currentMessages.slice(currentStreamIndex),
              ]);
            }
          }

          // Only execute client tools once the full done payload has been
          // merged into local state. Emitting earlier on the first tool_calls
          // chunk can race with recursive server-tool turns and produce an
          // invalid continuation order for OpenAI-compatible providers.
          if (
            chunk.requiresAction &&
            !toolCallsEmitted &&
            updatedMessage.toolCalls?.length
          ) {
            toolCallsEmitted = true;
            this.debug("toolCalls", { toolCalls: updatedMessage.toolCalls });
            this.emit("toolCalls", { toolCalls: updatedMessage.toolCalls });
          }
        }

        break;
      }
    }

    this.debug("handleStreamResponse", `Processed ${chunkCount} chunks`);

    // If streamState was already finalized (via message:end mid-stream), skip finalization
    if (!this.streamState) {
      this.debug("streamState already finalized via message:end");
    } else {
      // Build hidden map from stream state's toolResults for final message metadata
      const toolCallsHidden: Record<string, boolean> = {};
      if (this.streamState.toolResults) {
        for (const [id, result] of this.streamState.toolResults) {
          if (result.hidden !== undefined) {
            toolCallsHidden[id] = result.hidden;
          }
        }
      }

      // Finalize - update by ID to ensure we update the correct message
      const finalMessage = streamStateToMessage(this.streamState) as T;

      // Add toolCallsHidden metadata if we have tool calls with hidden flags
      if (
        finalMessage.toolCalls?.length &&
        Object.keys(toolCallsHidden).length > 0
      ) {
        (finalMessage as T & { metadata?: Record<string, unknown> }).metadata =
          {
            ...(finalMessage as T & { metadata?: Record<string, unknown> })
              .metadata,
            toolCallsHidden,
          };
      }

      this.state.updateMessageById(
        this.streamState.messageId,
        () => finalMessage,
      );

      // Check if we got any content
      if (
        !finalMessage.content &&
        (!finalMessage.toolCalls || finalMessage.toolCalls.length === 0)
      ) {
        this.debug("warning", "Empty response - no content and no tool calls");
      }
    }

    this.callbacks.onMessagesChange?.(this.state.messages);

    // Only set status to "ready" if NO tool calls were emitted
    // If tool calls were emitted, the async handler will manage status
    // (it will set "submitted" then "streaming" for the continuation)
    if (!toolCallsEmitted) {
      this.state.status = "ready";
      this.callbacks.onStatusChange?.("ready");
      this.callbacks.onFinish?.(this.state.messages);
    }

    this.emit("done", {});
    this.streamState = null;
  }

  /**
   * Handle JSON (non-streaming) response
   */
  protected handleJsonResponse(response: ChatResponse): void {
    // Build a map of tool call hidden flags from response.toolCalls
    const toolCallHiddenMap = new Map<string, boolean>();
    if (response.toolCalls) {
      for (const tc of response.toolCalls) {
        if (tc.hidden !== undefined) {
          toolCallHiddenMap.set(tc.id, tc.hidden);
        }
      }
    }

    // Add response messages
    for (const msg of response.messages ?? []) {
      // For assistant messages with tool_calls, add hidden info to metadata
      let metadata: Record<string, unknown> | undefined;
      if (
        msg.role === "assistant" &&
        msg.tool_calls &&
        toolCallHiddenMap.size > 0
      ) {
        const toolCallsHidden: Record<string, boolean> = {};
        for (const tc of msg.tool_calls as Array<{ id: string }>) {
          const hidden = toolCallHiddenMap.get(tc.id);
          if (hidden !== undefined) {
            toolCallsHidden[tc.id] = hidden;
          }
        }
        if (Object.keys(toolCallsHidden).length > 0) {
          metadata = { toolCallsHidden };
        }
      }

      const message = {
        id: generateMessageId(),
        role: msg.role as T["role"],
        content: msg.content ?? "",
        toolCalls: msg.tool_calls as T["toolCalls"],
        // CRITICAL: Preserve toolCallId for tool messages (fixes Anthropic API errors)
        toolCallId: msg.tool_call_id,
        createdAt: new Date(),
        metadata,
      } as T;

      this.state.pushMessage(message);
    }

    this.callbacks.onMessagesChange?.(this.state.messages);

    // Check for tool calls BEFORE setting status to ready
    // If tool calls exist, the async handler will manage status
    const hasToolCalls =
      response.requiresAction &&
      this.state.messages.length > 0 &&
      this.state.messages[this.state.messages.length - 1]?.toolCalls?.length;

    if (hasToolCalls) {
      const lastMessage = this.state.messages[this.state.messages.length - 1];
      this.emit("toolCalls", { toolCalls: lastMessage.toolCalls });
    } else {
      // Only set ready if no tool calls
      this.state.status = "ready";
      this.callbacks.onStatusChange?.("ready");
      this.callbacks.onFinish?.(this.state.messages);
    }

    this.emit("done", {});
  }

  /**
   * Handle errors
   */
  protected handleError(error: Error): void {
    this.debug("error", error);
    this.state.error = error;
    this.state.status = "error";
    this.callbacks.onError?.(error);
    this.callbacks.onStatusChange?.("error");
    this.emit("error", { error });
  }

  /**
   * Debug logging
   */
  protected debug(action: string, data?: unknown): void {
    if (this.config.debug) {
      console.log(`[AbstractChat] ${action}`, data);
    }
  }

  /**
   * Type guard for async iterable
   */
  private isAsyncIterable(value: unknown): value is AsyncIterable<StreamChunk> {
    return (
      value !== null &&
      typeof value === "object" &&
      Symbol.asyncIterator in value
    );
  }

  private _isDisposed = false;

  /**
   * Whether this instance has been disposed
   */
  get disposed(): boolean {
    return this._isDisposed;
  }

  /**
   * Dispose and cleanup
   * Note: Event handlers are NOT cleared to support React StrictMode revive()
   */
  dispose(): void {
    if (this._isDisposed) {
      this.debug("dispose() called but already disposed - ignoring");
      return;
    }
    this.debug("dispose() - stopping active requests");
    this._isDisposed = true;
    this.stop();
    // Event handlers persist for React StrictMode revive()
  }

  /**
   * Revive a disposed instance (for React StrictMode compatibility)
   * This allows reusing an instance after dispose() was called
   */
  revive(): void {
    if (!this._isDisposed) {
      return;
    }
    this.debug("revive() - restoring disposed instance");
    this._isDisposed = false;
  }
}
