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
import { createLogger } from "../../core/utils/logger";

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
   *
   * @param content - Message content
   * @param attachments - Optional attachments
   * @param options - Optional branching options
   * @param options.editMessageId - Edit flow: new message branches from the
   *   same parent as this message ID, creating a parallel conversation path
   */
  async sendMessage(
    content: string,
    attachments?: MessageAttachment[],
    options?: {
      editMessageId?: string;
    },
  ): Promise<boolean> {
    // Guard: Don't send if already processing
    if (this.isBusy) {
      this.debug("sendMessage", "Blocked - request already in progress");
      return false;
    }

    this.debug("sendMessage", { content, attachments, options });

    try {
      // IMPORTANT: Resolve any pending tool_calls before sending
      // This prevents Anthropic API errors: "tool_use without tool_result"
      this.resolveUnresolvedToolCalls();

      // Determine parentId for the new user message
      let newParentId: string | null | undefined;
      const visibleMessages = this.state.messages;

      if (options?.editMessageId && this.state.setCurrentLeaf) {
        // Edit flow: branch from the same parent as the edited message
        const allMessages =
          this.state.getAllMessages?.() ?? this.state.messages;
        const target = allMessages.find((m) => m.id === options.editMessageId);
        if (target && target.parentId !== undefined) {
          newParentId = target.parentId;
          // Rewind active path to just before the original message
          this.state.setCurrentLeaf(
            typeof target.parentId === "string" ? target.parentId : null,
          );
        }
      } else if (visibleMessages.length > 0) {
        // Normal follow-up: new message is a child of the current leaf
        newParentId = visibleMessages[visibleMessages.length - 1].id;
      }

      // Create user message with parentId for correct tree placement
      const userMessage = createUserMessage(content, attachments, {
        parentId: newParentId,
      }) as T;

      // Add to state
      this.state.pushMessage(userMessage);
      this.state.status = "submitted";
      this.state.error = undefined;

      // For streaming: push placeholder assistant message NOW (before microtask yield)
      // so the loader appears immediately with zero blank-state flash between user
      // message submission and the first stream event arriving.
      let preCreatedMessageId: string | undefined;
      if (this.config.streaming !== false) {
        const visibleMessages = this.state.messages;
        const currentLeafId =
          visibleMessages.length > 0
            ? visibleMessages[visibleMessages.length - 1].id
            : undefined;
        const preMsg = createEmptyAssistantMessage(undefined, {
          parentId: currentLeafId,
        }) as T;
        this.state.pushMessage(preMsg);
        preCreatedMessageId = preMsg.id;
      }

      // Notify callbacks (single batch: user message + status + optional placeholder)
      this.callbacks.onMessagesChange?.(this._allMessages());
      this.callbacks.onStatusChange?.("submitted");

      // Yield to allow UI to render loading state (important for non-streaming)
      await Promise.resolve();

      // Send request — pass pre-created ID so processRequest reuses it
      await this.processRequest({ preCreatedMessageId });
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

      // Add error result for each unresolved tool_call.
      // Chain parentId so these messages are placed correctly in the branch tree.
      const visibleMsgs = this.state.messages;
      let errorChainParentId: string | undefined =
        visibleMsgs.length > 0
          ? visibleMsgs[visibleMsgs.length - 1].id
          : undefined;

      for (const toolCallId of unresolvedIds) {
        const toolMessageId = generateMessageId();
        const toolMessage = {
          id: toolMessageId,
          role: "tool" as const,
          content: JSON.stringify({
            success: false,
            error: "Tool execution was interrupted. Please try again.",
          }),
          toolCallId,
          createdAt: new Date(),
          ...(errorChainParentId !== undefined
            ? { parentId: errorChainParentId }
            : {}),
        } as T;

        this.state.pushMessage(toolMessage);
        errorChainParentId = toolMessageId;
      }

      this.callbacks.onMessagesChange?.(this._allMessages());
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

      // Capture current leaf so tool messages are chained under the assistant
      // message that triggered the tool calls, not placed at tree root.
      // Without this, MessageTree.addMessage() assigns parentKey = ROOT_KEY,
      // which hijacks getVisibleMessages() and breaks the conversation path.
      const visibleMessages = this.state.messages;
      let chainParentId: string | undefined =
        visibleMessages.length > 0
          ? visibleMessages[visibleMessages.length - 1].id
          : undefined;

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

        const toolMessageId = generateMessageId();
        const toolMessage = {
          id: toolMessageId,
          role: "tool" as const,
          content: messageContent,
          toolCallId,
          createdAt: new Date(),
          ...(chainParentId !== undefined ? { parentId: chainParentId } : {}),
        } as T;

        this.state.pushMessage(toolMessage);
        // Next tool message (if any) chains off this one
        chainParentId = toolMessageId;
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
          ...(chainParentId !== undefined ? { parentId: chainParentId } : {}),
        } as T;

        this.state.pushMessage(userMessage);
      }

      this.state.status = "submitted";
      this.callbacks.onMessagesChange?.(this._allMessages());
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
   * Add tool result messages to history and stop — does NOT trigger a new LLM request.
   *
   * Use this instead of continueWithToolResults when you want to close out pending
   * tool_use blocks (so the history stays valid) without letting the AI continue.
   * Optionally appends a final assistant message (e.g. an iteration-limit notice).
   */
  async addToolResultMessages(
    toolResults: Array<{ toolCallId: string; result: unknown }>,
    finalAssistantContent?: string,
  ): Promise<void> {
    const visibleMessages = this.state.messages;
    let chainParentId: string | undefined =
      visibleMessages.length > 0
        ? visibleMessages[visibleMessages.length - 1].id
        : undefined;

    for (const { toolCallId, result } of toolResults) {
      const messageContent =
        typeof result === "string" ? result : JSON.stringify(result);

      const toolMessageId = generateMessageId();
      const toolMessage = {
        id: toolMessageId,
        role: "tool" as const,
        content: messageContent,
        toolCallId,
        createdAt: new Date(),
        ...(chainParentId !== undefined ? { parentId: chainParentId } : {}),
      } as T;

      this.state.pushMessage(toolMessage);
      chainParentId = toolMessageId;
    }

    if (finalAssistantContent) {
      const assistantMsg = {
        id: generateMessageId(),
        role: "assistant" as const,
        content: finalAssistantContent,
        createdAt: new Date(),
        ...(chainParentId !== undefined ? { parentId: chainParentId } : {}),
      } as T;
      this.state.pushMessage(assistantMsg);
    }

    this.callbacks.onMessagesChange?.(this._allMessages());
    this.state.status = "ready";
    this.callbacks.onStatusChange?.("ready");
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
   * Regenerate last response.
   *
   * Branch-aware: when the state supports branching (setCurrentLeaf is available),
   * regenerate creates a new sibling response instead of destroying the original.
   * The old response is preserved and navigable via switchBranch().
   *
   * Legacy fallback: when branching is not available, uses old slice() behavior.
   */
  async regenerate(messageId?: string): Promise<void> {
    if (this.isBusy) return;

    const messages = this.state.messages; // visible path
    let targetMessage: T | undefined;

    if (messageId) {
      targetMessage = messages.find((m) => m.id === messageId);
      // Not on visible path — check inactive branches too
      if (!targetMessage) {
        targetMessage = this.state
          .getAllMessages?.()
          .find((m) => m.id === messageId);
      }
    } else {
      // Find last assistant message in the visible path
      for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i].role === "assistant") {
          targetMessage = messages[i];
          break;
        }
      }
    }

    if (!targetMessage) return;

    // Branch-aware regenerate: preserve old response as inactive sibling
    if (targetMessage.parentId !== undefined && this.state.setCurrentLeaf) {
      // Rewind active path to target's parent
      // The new assistant response will be pushed as a new child (sibling)
      this.state.setCurrentLeaf(targetMessage.parentId ?? null);
      this.callbacks.onMessagesChange?.(this._allMessages());
      this.state.status = "submitted";
      await Promise.resolve();
      await this.processRequest();
      return;
    }

    // Legacy fallback: old slice() behavior for non-tree-aware state
    const targetIndex = messages.indexOf(targetMessage);
    if (targetIndex > 0) {
      this.state.setMessages(messages.slice(0, targetIndex));
      this.callbacks.onMessagesChange?.(this._allMessages());
      await this.processRequest();
    }
  }

  // ============================================
  // Event Handling
  // ============================================

  /**
   * Returns all messages across all branches when the state supports it
   * (branch-aware), otherwise returns the visible path.
   * Use this whenever firing onMessagesChange so inactive branches are not lost.
   */
  private _allMessages(): T[] {
    return this.state.getAllMessages?.() ?? this.state.messages;
  }

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
  protected async processRequest(options?: {
    preCreatedMessageId?: string;
  }): Promise<void> {
    // Build request
    const request = this.buildRequest();

    // For streaming: pre-push an empty assistant message BEFORE the HTTP
    // round-trip so the UI shows a loading bubble immediately (e.g. between
    // tool execution and the continuation stream starting).
    // Skip if sendMessage already pushed a placeholder (preCreatedMessageId set).
    let preCreatedMessageId = options?.preCreatedMessageId;
    if (this.config.streaming !== false && !preCreatedMessageId) {
      // Use the current leaf (last visible message) as parent so the assistant
      // message is correctly placed as a child in the branch tree.
      const visibleMessages = this.state.messages;
      const currentLeafId =
        visibleMessages.length > 0
          ? visibleMessages[visibleMessages.length - 1].id
          : undefined;
      const preMsg = createEmptyAssistantMessage(undefined, {
        parentId: currentLeafId,
      }) as T;
      this.state.pushMessage(preMsg);
      this.callbacks.onMessagesChange?.(this._allMessages());
      preCreatedMessageId = preMsg.id;
    }

    // Send request
    const response = await this.transport.send(request);

    // Check if streaming or JSON
    if (this.isAsyncIterable(response)) {
      await this.handleStreamResponse(response, preCreatedMessageId);
    } else {
      // Non-streaming: remove the pre-pushed placeholder (not needed).
      // Use getAllMessages() so inactive branch messages are preserved when
      // tree.reset() is called — this.state.messages only returns visible path.
      // Also capture + restore the intended active path: tree.reset() rebuilds
      // activeChildMap using "last child at each fork", which would snap back to
      // the wrong branch if we're mid-edit on an inactive branch.
      if (preCreatedMessageId) {
        const id = preCreatedMessageId;
        // The placeholder is the last visible message; the one before it is the
        // intended leaf after removal.
        const visibleMsgs = this.state.messages;
        const placeholderIdx = visibleMsgs.findIndex((m) => m.id === id);
        const intendedLeafId =
          placeholderIdx > 0 ? visibleMsgs[placeholderIdx - 1].id : null;

        const allMsgs = this.state.getAllMessages?.() ?? this.state.messages;
        this.state.setMessages(allMsgs.filter((m) => m.id !== id));

        // Restore the correct active branch after tree.reset()
        if (intendedLeafId && this.state.setCurrentLeaf) {
          this.state.setCurrentLeaf(intendedLeafId);
        }
      }
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
   * Inline skills from the client (sent on every request for server to merge)
   */
  protected inlineSkills: Array<{
    name: string;
    description: string;
    content: string;
    strategy?: string;
  }> = [];

  /**
   * Set inline skills (called by SkillProvider via React layer)
   */
  setInlineSkills(
    skills: Array<{
      name: string;
      description: string;
      content: string;
      strategy?: string;
    }>,
  ): void {
    this.inlineSkills = skills;
    this.debug("Inline skills updated", { count: skills.length });
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
  }

  /**
   * Set system prompt dynamically
   * This allows updating the system prompt after initialization
   */
  setSystemPrompt(prompt: string): void {
    this.config.systemPrompt = prompt;
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
      __skills: this.inlineSkills.length ? this.inlineSkills : undefined,
    };
  }

  /**
   * Handle streaming response
   */
  protected async handleStreamResponse(
    stream: AsyncIterable<StreamChunk>,
    preCreatedMessageId?: string,
  ): Promise<void> {
    this.state.status = "streaming";
    this.callbacks.onStatusChange?.("streaming");

    // Reuse the pre-pushed empty assistant message (created in processRequest
    // before the HTTP round-trip) so there's no blank gap waiting for stream start.
    // Fall back to pushing a new one if not provided.
    let assistantMessage: T;
    if (preCreatedMessageId) {
      const existing = this.state.messages.find(
        (m) => m.id === preCreatedMessageId,
      );
      if (existing) {
        assistantMessage = existing;
      } else {
        const visibleMessages = this.state.messages;
        const currentLeafId =
          visibleMessages.length > 0
            ? visibleMessages[visibleMessages.length - 1].id
            : undefined;
        assistantMessage = createEmptyAssistantMessage(undefined, {
          parentId: currentLeafId,
        }) as T;
        this.state.pushMessage(assistantMessage);
      }
    } else {
      const visibleMessages = this.state.messages;
      const currentLeafId =
        visibleMessages.length > 0
          ? visibleMessages[visibleMessages.length - 1].id
          : undefined;
      assistantMessage = createEmptyAssistantMessage(undefined, {
        parentId: currentLeafId,
      }) as T;
      this.state.pushMessage(assistantMessage);
    }

    // Initialize stream state
    this.streamState = createStreamState(assistantMessage.id);
    this.callbacks.onMessageStart?.(assistantMessage.id);

    this.debugGroup("handleStreamResponse");
    this.debug("Starting to process stream");

    let chunkCount = 0;
    let toolCallsEmitted = false; // Guard to prevent emitting toolCalls twice
    // Holds client tool calls received via a tool_calls chunk AFTER a
    // mid-stream message:end nulled streamState.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let pendingClientToolCalls: any[] | undefined;

    // Process stream chunks
    for await (const chunk of stream) {
      chunkCount++;
      // Skip high-frequency delta chunks from the chunk log to reduce noise
      if (chunk.type !== "message:delta") {
        this.debug("chunk", { count: chunkCount, type: chunk.type });
      }

      // Handle error chunks immediately
      if (chunk.type === "error") {
        const error = new Error(chunk.message || "Stream error");
        this.handleError(error);
        return;
      }

      // Handle message:end mid-stream (server-side agent loop turn completed).
      // Do NOT create a separate message for each turn — keep accumulating into
      // the same message so the user sees one assistant bubble, not three.
      // Just skip message:end entirely and let content continue flowing.
      if (chunk.type === "message:end" && this.streamState) {
        this.debug("message:end mid-stream (keeping streamState alive)", {
          messageId: this.streamState.messageId,
          contentLength: this.streamState.content.length,
          toolCallsInState: this.streamState.toolCalls?.length ?? 0,
          chunkCount,
        });
        // Don't reset streamState — next message:start will be ignored and
        // subsequent deltas will append to the same message.
        continue;
      }

      // Handle message:start after a mid-stream message:end.
      // Since we keep streamState alive above, this only fires if streamState
      // was null for another reason. Just skip it — deltas will flow into
      // the existing streamState.
      if (chunk.type === "message:start" && this.streamState !== null) {
        this.debug(
          "message:start mid-stream (streamState already active, skipping)",
        );
        continue;
      }

      // Handle message:start when streamState is null (shouldn't happen in
      // normal flow, but handle gracefully by creating a new message).
      if (chunk.type === "message:start" && this.streamState === null) {
        this.debug("message:start after mid-stream end - creating new message");
        // Capture the current leaf BEFORE pushing the new message so the
        // continuation turn is chained as a child in the branch tree.
        // Without this parentId the new message becomes a ROOT orphan, which
        // hijacks getVisibleMessages() and wipes the prior conversation from
        // the active path on every subsequent buildRequest() call.
        const currentLeaf = this.state.messages;
        const currentLeafId =
          currentLeaf.length > 0
            ? currentLeaf[currentLeaf.length - 1].id
            : undefined;
        const newMessage = createEmptyAssistantMessage(undefined, {
          parentId: currentLeafId,
        }) as T;
        this.state.pushMessage(newMessage);
        this.streamState = createStreamState(newMessage.id);
        this.callbacks.onMessageStart?.(newMessage.id);
        continue;
      }

      // Update stream state (pure function)
      // Skip most chunks if streamState is null.
      // EXCEPTION: after a mid-stream message:end the server can still send
      // tool_calls + done for client-side tool dispatch. Handle those directly.
      if (!this.streamState) {
        if (chunk.type === "tool_calls") {
          // Store for emission when done arrives. Do NOT update message state
          // here — done.messages carries the assistant message with tool_calls
          // in proper OpenAI format, which we use in the done handler below.
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          pendingClientToolCalls = (chunk as { toolCalls: any[] }).toolCalls;
          this.debug("tool_calls (post-message:end, stored as pending)", {
            count: pendingClientToolCalls?.length,
            ids: pendingClientToolCalls?.map((tc: { id?: string }) => tc.id),
          });
          continue;
        }

        if (chunk.type === "done") {
          this.debug("done (post-message:end)", {
            hasPendingToolCalls: !!pendingClientToolCalls?.length,
            pendingCount: pendingClientToolCalls?.length ?? 0,
            doneMessagesCount: chunk.messages?.length ?? 0,
            requiresAction: (chunk as { requiresAction?: boolean })
              .requiresAction,
            toolCallsEmitted,
          });
          // Process done.messages to:
          // 1. Insert any server-side tool results missing from state
          // 2. Merge OpenAI-format tool_calls into the finalized assistant message
          if (chunk.messages?.length) {
            const pendingIds = new Set(
              ((pendingClientToolCalls ?? []) as Array<{ id?: string }>)
                .filter((tc) => tc?.id)
                .map((tc) => tc.id as string),
            );
            const messagesToInsert: T[] = [];
            let clientAssistantToolCalls: unknown[] | undefined;

            // Track parent chain for inserted messages so they don't become
            // orphan root children in the MessageTree.
            const lastVisibleMsgs = this.state.messages;
            let postEndInsertParentId: string | undefined =
              lastVisibleMsgs.length > 0
                ? lastVisibleMsgs[lastVisibleMsgs.length - 1].id
                : undefined;

            for (const msg of chunk.messages) {
              // This is the client-tool assistant message already in state
              // (finalized by message:end but without toolCalls).
              // Capture its OpenAI-format tool_calls to merge into state.
              if (
                msg.role === "assistant" &&
                msg.tool_calls?.length &&
                pendingIds.size > 0 &&
                (msg.tool_calls as Array<{ id?: string }>).every((tc) =>
                  pendingIds.has(tc?.id ?? ""),
                )
              ) {
                clientAssistantToolCalls = msg.tool_calls as unknown[];
                continue; // Already in state — don't insert a duplicate
              }
              // Skip plain assistant text — already streamed
              if (msg.role === "assistant" && !msg.tool_calls?.length) continue;
              // Everything else (server tool results) needs inserting
              const insertedMsg = {
                id: generateMessageId(),
                role: msg.role as T["role"],
                content: msg.content ?? "",
                toolCalls: msg.tool_calls as T["toolCalls"],
                toolCallId: msg.tool_call_id,
                createdAt: new Date(),
                ...(postEndInsertParentId
                  ? { parentId: postEndInsertParentId }
                  : {}),
              } as T;
              postEndInsertParentId = insertedMsg.id;
              messagesToInsert.push(insertedMsg);
            }

            // Merge OpenAI-format tool_calls into the existing last assistant message
            if (clientAssistantToolCalls) {
              const currentMessages = this.state.messages;
              for (let i = currentMessages.length - 1; i >= 0; i--) {
                if (currentMessages[i].role === "assistant") {
                  this.state.updateMessageById(
                    currentMessages[i].id,
                    (m) =>
                      ({
                        ...m,
                        toolCalls: clientAssistantToolCalls,
                      }) as T,
                  );
                  break;
                }
              }
            }

            if (messagesToInsert.length > 0) {
              // Insert server tool results before the last assistant message.
              // Use _allMessages() to preserve inactive branch messages.
              const currentMessages = this._allMessages();
              let insertIdx = currentMessages.length;
              for (let i = currentMessages.length - 1; i >= 0; i--) {
                if (currentMessages[i].role === "assistant") {
                  insertIdx = i;
                  break;
                }
              }
              // Assign parentIds so inserted messages form a proper chain in the
              // MessageTree. Without this they become orphan root-level children,
              // which breaks the active-path walk and causes the visible message
              // count to drop on subsequent turns.
              const insertParentId =
                insertIdx > 0 ? currentMessages[insertIdx - 1].id : undefined;
              const linkedToInsert = messagesToInsert.map((msg, i) => ({
                ...msg,
                parentId: i === 0 ? insertParentId : messagesToInsert[i - 1].id,
              }));
              const lastInsertedId =
                linkedToInsert[linkedToInsert.length - 1].id;
              // Re-parent the message at insertIdx to chain from the last inserted
              const updatedCurrent = currentMessages.map((m, idx) =>
                idx === insertIdx ? { ...m, parentId: lastInsertedId } : m,
              );
              this.state.setMessages([
                ...updatedCurrent.slice(0, insertIdx),
                ...linkedToInsert,
                ...updatedCurrent.slice(insertIdx),
              ]);
            }
          }

          // Emit client tool calls so ChatWithTools executes them
          if (!toolCallsEmitted && pendingClientToolCalls?.length) {
            toolCallsEmitted = true;
            this.debug("emit toolCalls (post-message:end path)", {
              count: pendingClientToolCalls.length,
              names: pendingClientToolCalls.map(
                (tc: { function?: { name: string }; name?: string }) =>
                  tc.function?.name ?? tc.name,
              ),
            });
            this.emit("toolCalls", { toolCalls: pendingClientToolCalls });
          } else {
            this.debug("skip emit toolCalls (post-message:end path)", {
              toolCallsEmitted,
              hasPending: !!pendingClientToolCalls?.length,
            });
          }
          continue;
        }

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
        // Preserve parentId/childrenIds from the existing placeholder so the
        // branch tree structure (activeChildMap) is not corrupted when
        // setCurrentLeaf() walks up the chain later.
        (existing) => ({
          ...updatedMessage,
          ...(existing.parentId !== undefined
            ? { parentId: existing.parentId }
            : {}),
          ...(existing.childrenIds !== undefined
            ? { childrenIds: existing.childrenIds }
            : {}),
        }),
      );

      // Notify delta callback
      if (chunk.type === "message:delta") {
        this.callbacks.onMessageDelta?.(assistantMessage.id, chunk.content);
      }

      // Check for completion
      if (isStreamDone(chunk)) {
        this.debug("streamDone", {
          chunkType: chunk.type,
          requiresAction: (chunk as { requiresAction?: boolean })
            .requiresAction,
          doneMessagesCount:
            (chunk as { messages?: unknown[] }).messages?.length ?? 0,
          streamToolCallsCount: this.streamState?.toolCalls?.length ?? 0,
          toolCallsEmitted,
          chunkCount,
        });

        // CRITICAL: Process messages from done event (server-side tool results)
        // Without this, tool_call_id is lost and causes Anthropic API errors
        if (chunk.type === "done" && chunk.messages?.length) {
          this.debug("processDoneMessages", {
            count: chunk.messages.length,
            roles: chunk.messages.map(
              (m) =>
                `${m.role}${m.tool_calls?.length ? `[${(m.tool_calls as unknown[]).length}tc]` : ""}`,
            ),
          });

          const currentStreamToolCallIds = new Set([
            ...(this.streamState?.toolCalls?.map((toolCall) => toolCall.id) ??
              []),
            // Also include IDs from toolResults (populated by action:start/args/end
            // chunks for server-side tools). Without this, assistant messages with
            // tool_calls from done.messages are treated as "new" and inserted as
            // duplicates even though the tools were already executed in-stream.
            ...(this.streamState?.toolResults
              ? Array.from(this.streamState.toolResults.keys())
              : []),
          ]);
          const messagesToInsert: T[] = [];

          // Track parent chain for inserted messages so they don't become
          // orphan root children in the MessageTree (which would redirect
          // the active path and blank the UI).
          let insertChainParentId: string | undefined =
            this.streamState?.messageId;

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
              ...(insertChainParentId ? { parentId: insertChainParentId } : {}),
            } as T;
            insertChainParentId = message.id;

            messagesToInsert.push(message);
          }

          if (messagesToInsert.length > 0) {
            // Use _allMessages() to preserve inactive branch messages.
            // this.state.messages only returns the visible path; calling
            // setMessages() with just that would destroy all other branches
            // when tree.reset() rebuilds.
            const currentMessages = this._allMessages();
            const currentStreamIndex = this.streamState
              ? currentMessages.findIndex(
                  (message) => message.id === this.streamState!.messageId,
                )
              : -1;

            if (currentStreamIndex === -1) {
              // Append at end — chain from the last existing message
              const appendParentId =
                currentMessages.length > 0
                  ? currentMessages[currentMessages.length - 1].id
                  : undefined;
              const linkedToInsert = messagesToInsert.map((msg, i) => ({
                ...msg,
                parentId: i === 0 ? appendParentId : messagesToInsert[i - 1].id,
              }));
              this.state.setMessages([...currentMessages, ...linkedToInsert]);
            } else {
              // Insert before the current streaming message — chain from the
              // message immediately before it, then re-parent the streaming
              // message to chain from the last inserted.
              const insertParentId =
                currentStreamIndex > 0
                  ? currentMessages[currentStreamIndex - 1].id
                  : undefined;
              const linkedToInsert = messagesToInsert.map((msg, i) => ({
                ...msg,
                parentId: i === 0 ? insertParentId : messagesToInsert[i - 1].id,
              }));
              const lastInsertedId =
                linkedToInsert[linkedToInsert.length - 1].id;
              // Re-parent the streaming message to chain from the last inserted
              const updatedCurrent = currentMessages.map((m, idx) =>
                idx === currentStreamIndex
                  ? { ...m, parentId: lastInsertedId }
                  : m,
              );
              this.state.setMessages([
                ...updatedCurrent.slice(0, currentStreamIndex),
                ...linkedToInsert,
                ...updatedCurrent.slice(currentStreamIndex),
              ]);
            }
          }

          // Only execute client tools once the full done payload has been
          // merged into local state. Emitting earlier on the first tool_calls
          // chunk can race with recursive server-tool turns and produce an
          // invalid continuation order for OpenAI-compatible providers.
          this.debug("requiresAction check", {
            requiresAction: chunk.requiresAction,
            toolCallsEmitted,
            updatedMessageToolCallsCount: updatedMessage.toolCalls?.length ?? 0,
            messagesToInsertCount: messagesToInsert.length,
          });

          if (chunk.requiresAction && !toolCallsEmitted) {
            // When the server runs a multi-turn agent loop before handing off
            // to the client, the client tool calls arrive via done.messages
            // (messagesToInsert), NOT in the current streaming message's
            // toolCalls (which is always empty because action:start/args/end
            // chunks only fire callbacks and never update streamState.toolCalls).
            // Find the last assistant message in the inserted batch that carries
            // tool calls — that is the pending client tool dispatch.
            let clientToolCalls = updatedMessage.toolCalls;
            if (!clientToolCalls?.length && messagesToInsert.length > 0) {
              for (let i = messagesToInsert.length - 1; i >= 0; i--) {
                const m = messagesToInsert[i];
                if (m.role === "assistant" && m.toolCalls?.length) {
                  clientToolCalls = m.toolCalls;
                  this.debug("clientToolCalls from messagesToInsert", {
                    index: i,
                    count: clientToolCalls?.length,
                  });
                  break;
                }
              }
            }

            if (clientToolCalls?.length) {
              toolCallsEmitted = true;
              this.debug("emit toolCalls (normal done path)", {
                count: clientToolCalls.length,
                names: (
                  clientToolCalls as Array<{
                    function?: { name: string };
                    name?: string;
                  }>
                ).map((tc) => tc.function?.name ?? tc.name),
              });
              this.emit("toolCalls", { toolCalls: clientToolCalls });
            } else {
              this.debug("requiresAction=true but no clientToolCalls found", {
                updatedMessageToolCalls: updatedMessage.toolCalls,
                messagesToInsert: messagesToInsert.map((m) => ({
                  role: m.role,
                  hasToolCalls: !!m.toolCalls?.length,
                })),
              });
            }
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

      this.state.updateMessageById(this.streamState.messageId, (existing) => ({
        ...finalMessage,
        ...(existing.parentId !== undefined
          ? { parentId: existing.parentId }
          : {}),
        ...(existing.childrenIds !== undefined
          ? { childrenIds: existing.childrenIds }
          : {}),
      }));

      // Check if we got any content
      if (
        !finalMessage.content &&
        (!finalMessage.toolCalls || finalMessage.toolCalls.length === 0)
      ) {
        this.debug("warning", "Empty response - no content and no tool calls");
      }
    }

    this.callbacks.onMessagesChange?.(this._allMessages());

    // Close the stream group opened at the start of handleStreamResponse
    this.debugGroupEnd();

    // Only set status to "ready" if NO tool calls were emitted
    // If tool calls were emitted, the async handler will manage status
    // (it will set "submitted" then "streaming" for the continuation)
    this.debug("stream end", {
      toolCallsEmitted,
      totalChunks: chunkCount,
      messagesInState: this.state.messages.length,
    });
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
    // Track the current leaf as we insert messages so each message in a
    // multi-message response is correctly chained (child of the previous).
    let currentParentId: string | null | undefined =
      this.state.messages.length > 0
        ? this.state.messages[this.state.messages.length - 1].id
        : undefined;

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
        // Preserve branch tree structure: each message is a child of the
        // current leaf so the tree is not corrupted for non-streaming mode.
        ...(currentParentId !== undefined ? { parentId: currentParentId } : {}),
      } as T;

      this.state.pushMessage(message);
      // Next message in this batch is a child of the one we just pushed
      currentParentId = message.id;
    }

    this.callbacks.onMessagesChange?.(this._allMessages());

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

  // ─── Debug helpers ────────────────────────────────────────────────────────

  private _log?: import("../../core/utils/logger").ScopedLogger;

  private get log(): import("../../core/utils/logger").ScopedLogger {
    if (!this._log) {
      this._log = createLogger("streaming", () => this.config.debug ?? false);
    }
    return this._log;
  }

  protected debug(action: string, data?: unknown): void {
    this.log(action, data);
  }

  protected debugGroup(label: string, collapsed = true): void {
    if (collapsed) {
      this.log.groupCollapsed(label);
    } else {
      this.log.group(label);
    }
  }

  protected debugGroupEnd(): void {
    this.log.groupEnd();
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
