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
  MessageAttachment,
  AIResponseMode,
  ToolResponse,
  ToolDefinition,
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
  requiresToolExecution,
} from "../functions/stream";
import { SimpleChatState } from "../interfaces/ChatState";

// ============================================
// AI Response Control Helper
// ============================================

/**
 * Tool definition with AI response control fields
 */
interface ToolWithAIConfig {
  name: string;
  aiResponseMode?: AIResponseMode;
  aiContext?:
    | string
    | ((result: ToolResponse, args: Record<string, unknown>) => string);
}

/**
 * Build tool result content for AI based on aiResponseMode and aiContext
 * This transforms client-side tool results before sending to the LLM
 *
 * Priority for responseMode: result._aiResponseMode > tool.aiResponseMode > "full"
 * Priority for context: result._aiContext > tool.aiContext > undefined
 *
 * @param result - The tool result (may include _aiResponseMode, _aiContext, _aiContent)
 * @param tool - Optional tool definition with aiResponseMode and aiContext
 * @param args - Tool arguments (for dynamic aiContext functions)
 * @returns The content string to send to the AI
 */
function buildToolResultContentForAI(
  result: unknown,
  tool?: ToolWithAIConfig,
  args?: Record<string, unknown>,
): string {
  if (typeof result === "string") return result;

  const typedResult = result as ToolResponse | null;

  // Priority: result._aiResponseMode > tool.aiResponseMode > "full"
  const responseMode =
    typedResult?._aiResponseMode ?? tool?.aiResponseMode ?? "full";

  // Check for multimodal content
  if (typedResult?._aiContent) {
    return JSON.stringify(typedResult._aiContent);
  }

  // Get AI context: result._aiContext > tool.aiContext (string or function)
  let aiContext: string | undefined = typedResult?._aiContext;
  if (!aiContext && tool?.aiContext) {
    aiContext =
      typeof tool.aiContext === "function"
        ? tool.aiContext(typedResult as ToolResponse, args ?? {})
        : tool.aiContext;
  }

  switch (responseMode) {
    case "none":
      return aiContext ?? "[Result displayed to user]";

    case "brief":
      return aiContext ?? "[Tool executed successfully]";

    case "full":
    default:
      if (aiContext) {
        // Include context as prefix, then full data (without the control fields)
        const {
          _aiResponseMode,
          _aiContext,
          _aiContent,
          _uiResources,
          ...dataOnly
        } = typedResult ?? {};
        return `${aiContext}\n\nFull data: ${JSON.stringify(dataOnly)}`;
      }
      // Strip UI resources from full result - they're for rendering, not for AI
      if (typedResult?._uiResources) {
        const { _uiResources, ...dataOnly } = typedResult;
        return JSON.stringify(dataOnly);
      }
      return JSON.stringify(result);
  }
}

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
      threadId: init.threadId,
      debug: init.debug,
    };

    // Use provided state or create default
    this.state =
      (init.state as ChatState<T>) ??
      (new SimpleChatState<T>() as ChatState<T>);

    // Use provided transport or create default
    this.transport =
      init.transport ??
      new HttpTransport({
        url: init.runtimeUrl,
        headers: init.headers,
        streaming: init.streaming ?? true,
      });

    // Store callbacks
    this.callbacks = init.callbacks ?? {};

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

      // Yield to allow UI to render loading state (important for non-streaming)
      await Promise.resolve();

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
   * Dynamic context from useAIContext hook
   */
  protected dynamicContext: string = "";

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
   * Build the request payload
   */
  protected buildRequest() {
    // Send tools in SDK format - runtime handles conversion to LLM format
    // Filter out tools that are marked as unavailable
    const tools = this.config.tools
      ?.filter((tool) => tool.available !== false)
      .map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
      }));

    // Build a map of toolCallId -> { toolName, args } from assistant messages
    const toolCallMap = new Map<
      string,
      { toolName: string; args: Record<string, unknown> }
    >();
    for (const msg of this.state.messages) {
      if (msg.role === "assistant" && msg.toolCalls) {
        for (const tc of msg.toolCalls) {
          try {
            const args = tc.function?.arguments
              ? JSON.parse(tc.function.arguments)
              : {};
            toolCallMap.set(tc.id, { toolName: tc.function.name, args });
          } catch {
            toolCallMap.set(tc.id, { toolName: tc.function.name, args: {} });
          }
        }
      }
    }

    // Create a lookup for tool definitions by name
    const toolDefMap = new Map<string, ToolWithAIConfig>();
    if (this.config.tools) {
      for (const tool of this.config.tools) {
        toolDefMap.set(tool.name, {
          name: tool.name,
          aiResponseMode: tool.aiResponseMode,
          aiContext: tool.aiContext,
        });
      }
    }

    return {
      messages: this.state.messages.map((m) => {
        // For tool messages, transform based on aiResponseMode at SEND time
        // This preserves full data in storage while sending brief to AI
        if (m.role === "tool" && m.content && m.toolCallId) {
          try {
            const fullResult = JSON.parse(m.content);

            // Look up the tool name and args from the tool call
            const toolCallInfo = toolCallMap.get(m.toolCallId);
            const toolDef = toolCallInfo
              ? toolDefMap.get(toolCallInfo.toolName)
              : undefined;
            const toolArgs = toolCallInfo?.args;

            const transformedContent = buildToolResultContentForAI(
              fullResult,
              toolDef,
              toolArgs,
            );
            return {
              role: m.role,
              content: transformedContent,
              tool_call_id: m.toolCallId,
            };
          } catch (e) {
            // If not JSON, send as-is (log in debug mode)
            this.debug("Failed to parse tool message JSON", {
              content: m.content?.slice(0, 100),
              error: e instanceof Error ? e.message : String(e),
            });
            return {
              role: m.role,
              content: m.content,
              tool_call_id: m.toolCallId,
            };
          }
        }

        // Other messages unchanged
        return {
          role: m.role,
          content: m.content,
          tool_calls: m.toolCalls,
          tool_call_id: m.toolCallId,
          attachments: m.attachments,
        };
      }),
      threadId: this.config.threadId,
      systemPrompt: this.dynamicContext
        ? `${this.config.systemPrompt || ""}\n\n## Current App Context:\n${this.dynamicContext}`.trim()
        : this.config.systemPrompt,
      llm: this.config.llm,
      tools: tools?.length ? tools : undefined,
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
    let hasError = false;
    let toolCallsEmitted = false; // Guard to prevent emitting toolCalls twice

    // Process stream chunks
    for await (const chunk of stream) {
      chunkCount++;
      this.debug("chunk", { count: chunkCount, type: chunk.type });

      // Handle error chunks immediately
      if (chunk.type === "error") {
        hasError = true;
        const error = new Error(chunk.message || "Stream error");
        this.handleError(error);
        return;
      }

      // Update stream state (pure function)
      this.streamState = processStreamChunk(chunk, this.streamState);

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

      // Check for tool calls - only emit once per stream
      if (requiresToolExecution(chunk) && !toolCallsEmitted) {
        toolCallsEmitted = true;
        this.debug("toolCalls", { toolCalls: updatedMessage.toolCalls });
        this.emit("toolCalls", { toolCalls: updatedMessage.toolCalls });
      }

      // Check for completion
      if (isStreamDone(chunk)) {
        this.debug("streamDone", { chunk });
        break;
      }
    }

    this.debug("handleStreamResponse", `Processed ${chunkCount} chunks`);

    // Finalize - update by ID to ensure we update the correct message
    const finalMessage = streamStateToMessage(this.streamState) as T;
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

    this.callbacks.onMessageFinish?.(finalMessage);
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
    // Add response messages
    for (const msg of response.messages ?? []) {
      const message = {
        id: generateMessageId(),
        role: msg.role as T["role"],
        content: msg.content ?? "",
        toolCalls: msg.tool_calls as T["toolCalls"],
        createdAt: new Date(),
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
