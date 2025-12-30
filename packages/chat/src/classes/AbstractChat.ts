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
} from "@yourgpt/copilot-sdk-core";
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
 * Build tool result content for AI based on _aiResponseMode and _aiContext
 * This transforms client-side tool results before sending to the LLM
 *
 * @param result - The tool result (may include _aiResponseMode, _aiContext, _aiContent)
 * @returns The content string to send to the AI
 */
function buildToolResultContentForAI(result: unknown): string {
  if (typeof result === "string") return result;

  const typedResult = result as {
    _aiResponseMode?: AIResponseMode;
    _aiContext?: string;
    _aiContent?: Array<{ type: string; data?: string; text?: string }>;
    [key: string]: unknown;
  } | null;

  const responseMode = typedResult?._aiResponseMode ?? "full";

  // Check for multimodal content
  if (typedResult?._aiContent) {
    return JSON.stringify(typedResult._aiContent);
  }

  switch (responseMode) {
    case "none":
      return typedResult?._aiContext ?? "[Result displayed to user]";

    case "brief":
      return typedResult?._aiContext ?? "[Tool executed successfully]";

    case "full":
    default:
      if (typedResult?._aiContext) {
        // Include context as prefix, then full data (without the control fields)
        const { _aiResponseMode, _aiContext, _aiContent, ...dataOnly } =
          typedResult;
        return `${_aiContext}\n\nFull data: ${JSON.stringify(dataOnly)}`;
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
   * Send a message
   */
  async sendMessage(
    content: string,
    attachments?: MessageAttachment[],
  ): Promise<void> {
    this.debug("sendMessage", { content, attachments });

    try {
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
    } catch (error) {
      this.handleError(error as Error);
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
      const attachmentsToAdd: import("@yourgpt/copilot-sdk-core").MessageAttachment[] =
        [];

      for (const { toolCallId, result } of toolResults) {
        // Check if result wants to be added as user message (e.g., screenshot)
        const typedResult = result as {
          success?: boolean;
          message?: string;
          addAsUserMessage?: boolean;
          data?: {
            attachment?: import("@yourgpt/copilot-sdk-core").MessageAttachment;
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
  setTools(tools: import("@yourgpt/copilot-sdk-core").ToolDefinition[]): void {
    this.config.tools = tools;
  }

  /**
   * Build the request payload
   */
  protected buildRequest() {
    // Send tools in SDK format - runtime handles conversion to LLM format
    const tools = this.config.tools?.map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
    }));

    return {
      messages: this.state.messages.map((m) => {
        // For tool messages, transform based on _aiResponseMode at SEND time
        // This preserves full data in storage while sending brief to AI
        if (m.role === "tool" && m.content) {
          try {
            const fullResult = JSON.parse(m.content);
            const transformedContent = buildToolResultContentForAI(fullResult);
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
      systemPrompt: this.config.systemPrompt,
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

      // Update message in state
      const updatedMessage = streamStateToMessage(this.streamState) as T;
      this.state.updateLastMessage(() => updatedMessage);

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

    // Finalize
    const finalMessage = streamStateToMessage(this.streamState) as T;
    this.state.updateLastMessage(() => finalMessage);
    this.state.status = "ready";

    // Check if we got any content
    if (
      !finalMessage.content &&
      (!finalMessage.toolCalls || finalMessage.toolCalls.length === 0)
    ) {
      this.debug("warning", "Empty response - no content and no tool calls");
    }

    this.callbacks.onMessageFinish?.(finalMessage);
    this.callbacks.onStatusChange?.("ready");
    this.callbacks.onMessagesChange?.(this.state.messages);
    this.callbacks.onFinish?.(this.state.messages);

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

    this.state.status = "ready";
    this.callbacks.onStatusChange?.("ready");
    this.callbacks.onMessagesChange?.(this.state.messages);
    this.callbacks.onFinish?.(this.state.messages);

    // Check for tool calls (with bounds check)
    if (response.requiresAction && this.state.messages.length > 0) {
      const lastMessage = this.state.messages[this.state.messages.length - 1];
      if (lastMessage?.toolCalls?.length) {
        this.emit("toolCalls", { toolCalls: lastMessage.toolCalls });
      }
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

  /**
   * Dispose and cleanup
   */
  dispose(): void {
    this.stop();
    this.eventHandlers.clear();
  }
}
