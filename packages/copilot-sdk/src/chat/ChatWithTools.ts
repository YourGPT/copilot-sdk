/**
 * ChatWithTools - Framework-agnostic coordinator for chat + tool execution
 *
 * This class combines AbstractChat and AbstractAgentLoop, handling all the
 * internal wiring so framework adapters don't need to manage it.
 *
 * Benefits:
 * - Single class to instantiate
 * - All event wiring handled internally
 * - Tool execution lifecycle managed automatically
 * - Framework-agnostic - works with React, Vue, Svelte, etc.
 */

import type {
  ContextUsage,
  ToolDefinition,
  MessageAttachment,
  PermissionLevel,
} from "../core";
import type { Resolvable } from "../core/utils/resolvable";
import { createLogger } from "../core/utils/logger";
import { AbstractChat } from "./classes/AbstractChat";
import { AbstractAgentLoop } from "./AbstractAgentLoop";
import type { ChatConfig, ChatCallbacks } from "./types";
import type { UIMessage } from "./types/message";
import type { ToolExecution, AgentLoopCallbacks } from "./types/tool";
import type { ChatState } from "./interfaces/ChatState";
import type { ChatTransport } from "./interfaces/ChatTransport";

/**
 * Configuration for ChatWithTools
 *
 * Supports both static values and getter functions for dynamic configuration.
 * Getter functions are resolved at request time, ensuring fresh values.
 */
export interface ChatWithToolsConfig {
  /** Runtime API endpoint - can be static or getter function */
  runtimeUrl: Resolvable<string>;
  /** LLM configuration */
  llm?: ChatConfig["llm"];
  /** System prompt */
  systemPrompt?: string;
  /** Enable streaming (default: true) */
  streaming?: boolean;
  /** Request headers - can be static or getter function */
  headers?: Resolvable<Record<string, string>>;
  /** Additional body properties - can be static or getter function */
  body?: Resolvable<Record<string, unknown>>;
  /** Thread ID for conversation persistence */
  threadId?: string;
  /** Enable debug logging */
  debug?: boolean;
  /** Initial messages */
  initialMessages?: UIMessage[];
  /** Initial tools to register */
  tools?: ToolDefinition[];
  /** Max tool execution iterations (default: 20) */
  maxIterations?: number;
  /** Optional prompt/tool optimization controls */
  optimization?: ChatConfig["optimization"];
  /** Custom error message when max iterations reached (sent to AI as tool result) */
  maxIterationsMessage?: string;
  /** State implementation (injected by framework adapter) */
  state?: ChatState<UIMessage>;
  /** Transport implementation */
  transport?: ChatTransport;
}

/**
 * Callbacks for ChatWithTools
 */
export interface ChatWithToolsCallbacks extends ChatCallbacks<UIMessage> {
  /** Called when tool executions change */
  onToolExecutionsChange?: (executions: ToolExecution[]) => void;
  /** Called when a tool requires approval */
  onApprovalRequired?: (execution: ToolExecution) => void;
  /** Called when prompt context usage changes */
  onContextUsageChange?: (usage: ContextUsage) => void;
}

/**
 * ChatWithTools - Coordinated chat + tool execution
 *
 * @example
 * ```typescript
 * const chat = new ChatWithTools({
 *   runtimeUrl: '/api/chat',
 *   tools: [myTool],
 *   debug: true,
 * }, {
 *   onToolExecutionsChange: (execs) => setToolExecutions(execs),
 * });
 *
 * // Register more tools
 * chat.registerTool(anotherTool);
 *
 * // Send message - tool execution handled automatically
 * await chat.sendMessage('Take a screenshot');
 *
 * // Approve/reject tool execution
 * chat.approveToolExecution(executionId);
 * ```
 */
export class ChatWithTools {
  private chat: AbstractChat<UIMessage>;
  private agentLoop: AbstractAgentLoop;
  private config: ChatWithToolsConfig;
  private callbacks: ChatWithToolsCallbacks;

  constructor(
    config: ChatWithToolsConfig,
    callbacks: ChatWithToolsCallbacks = {},
  ) {
    this.config = config;
    this.callbacks = callbacks;

    // Create agent loop
    this.agentLoop = new AbstractAgentLoop(
      {
        maxIterations: config.maxIterations ?? 20,
        tools: config.tools,
      },
      {
        onExecutionsChange: (executions) => {
          callbacks.onToolExecutionsChange?.(executions);
        },
        onApprovalRequired: (execution) => {
          callbacks.onApprovalRequired?.(execution);
        },
      },
    );

    // Create chat
    this.chat = new AbstractChat<UIMessage>({
      runtimeUrl: config.runtimeUrl,
      llm: config.llm,
      systemPrompt: config.systemPrompt,
      streaming: config.streaming,
      headers: config.headers,
      body: config.body,
      optimization: config.optimization,
      threadId: config.threadId,
      debug: config.debug,
      initialMessages: config.initialMessages,
      state: config.state,
      transport: config.transport,
      callbacks: {
        onMessagesChange: callbacks.onMessagesChange,
        onStatusChange: callbacks.onStatusChange,
        onError: callbacks.onError,
        onMessageStart: callbacks.onMessageStart,
        onMessageDelta: callbacks.onMessageDelta,
        onMessageFinish: callbacks.onMessageFinish,
        onToolCalls: callbacks.onToolCalls,
        onFinish: callbacks.onFinish,
        onContextUsageChange: callbacks.onContextUsageChange,
        // Server-side tool callbacks - track in agentLoop for UI display
        // IMPORTANT: Only track tools that are NOT registered client-side
        // Client-side tools are tracked via executeToolCalls() path
        onServerToolStart: (info) => {
          // Check if execution with this ID already exists
          const existingExecution = this.agentLoop.toolExecutions.find(
            (e) => e.id === info.id,
          );
          if (existingExecution) {
            // Update hidden flag if this event has it (agent-loop sends hidden, adapter doesn't)
            if (
              info.hidden !== undefined &&
              existingExecution.hidden !== info.hidden
            ) {
              this.debug(
                "Updating hidden flag for existing execution:",
                info.name,
                info.hidden,
              );
              this.agentLoop.updateToolExecution(info.id, {
                hidden: info.hidden,
              });
            }
            return;
          }
          // Skip if this tool is registered client-side (will be tracked via executeToolCalls)
          const isClientTool = this.agentLoop.tools.some(
            (t) => t.name === info.name && t.location === "client",
          );
          if (isClientTool) {
            this.debug("Skipping server tracking for client tool:", info.name);
            return;
          }
          this.debug("Server tool started:", info.name, {
            hidden: info.hidden,
            id: info.id,
          });
          this.agentLoop.addServerToolExecution(info);
        },
        onServerToolArgs: (info) => {
          // Skip if this tool is registered client-side
          const isClientTool = this.agentLoop.tools.some(
            (t) => t.name === info.name && t.location === "client",
          );
          if (isClientTool) return;
          this.debug("Server tool args:", info.name, info.args);
          this.agentLoop.updateServerToolArgs(info.id, info.args ?? {});
        },
        onServerToolEnd: (info) => {
          // Skip if this tool is registered client-side
          const isClientTool = this.agentLoop.tools.some(
            (t) => t.name === info.name && t.location === "client",
          );
          if (isClientTool) return;
          this.debug("Server tool ended:", info.name, {
            error: info.error,
            hasResult: !!info.result,
          });
          this.agentLoop.completeServerToolExecution(info);
        },
      },
    });

    // Wire up internal events
    this.wireEvents();
  }

  /**
   * Wire up internal events between chat and agent loop
   */
  private wireEvents(): void {
    this.debug("Wiring up toolCalls event handler");

    // Handle tool calls from chat
    this.chat.on("toolCalls", async (event) => {
      const toolCalls = event.toolCalls;
      if (!toolCalls?.length) {
        return;
      }

      this.debug("Tool calls received:", toolCalls.length);

      // Convert tool calls to the format expected by agent loop
      const toolCallInfos = toolCalls.map((tc) => {
        const tcAny = tc as {
          id: string;
          function?: { name: string; arguments: string };
          name?: string;
          args?: Record<string, unknown>;
        };
        const name = tcAny.function?.name ?? tcAny.name ?? "";
        let args: Record<string, unknown> = {};

        if (tcAny.function?.arguments) {
          try {
            args = JSON.parse(tcAny.function.arguments);
          } catch {
            args = {};
          }
        } else if (tcAny.args) {
          args = tcAny.args;
        }

        return { id: tc.id, name, args };
      });

      // Execute tools
      try {
        const results = await this.agentLoop.executeToolCalls(toolCallInfos);
        this.debug("Tool results:", results);

        // If stop() was called while tools were executing, don't restart the loop
        if (this.agentLoop.isCancelled) {
          this.debug("Skipping continueWithToolResults — loop was cancelled");
          return;
        }

        // Continue chat with tool results
        if (results.length > 0) {
          const toolResults = results.map((r) => ({
            toolCallId: r.toolCallId,
            result: r.success ? r.result : { success: false, error: r.error },
          }));

          await this.chat.continueWithToolResults(toolResults);
        } else if (
          this.agentLoop.maxIterationsReached &&
          toolCallInfos.length > 0
        ) {
          // Max iterations reached — close out the pending tool_use blocks (so the
          // conversation history stays valid for the next request) but do NOT trigger
          // another LLM call.  Previously we called continueWithToolResults() here,
          // which sent the error to the AI and started a new LLM request; the AI
          // responded "let me retry" + new tool_use blocks → the same limit fired
          // again → continueWithToolResults again → infinite loop.
          this.debug(
            "Max iterations reached, stopping loop without new LLM request",
          );

          const errorMessage =
            this.config.maxIterationsMessage ||
            "Tool execution paused: iteration limit reached. User can say 'continue' to resume.";

          const blockedResults = toolCallInfos.map((tc) => ({
            toolCallId: tc.id,
            result: {
              success: false,
              error: errorMessage,
            },
          }));

          // Adds tool_result messages + a final assistant stop-message, then sets
          // status → "ready".  No new API request is made.
          await this.chat.addToolResultMessages(blockedResults, errorMessage);
        }
      } catch (error) {
        this.debug("Error executing tools:", error);
        console.error("[ChatWithTools] Tool execution error:", error);
      }
    });
  }

  // ============================================
  // Chat Getters
  // ============================================

  get messages(): UIMessage[] {
    return this.chat.messages;
  }

  get status() {
    return this.chat.status;
  }

  get error() {
    return this.chat.error;
  }

  get isStreaming(): boolean {
    return this.chat.isStreaming;
  }

  /**
   * Whether any operation is in progress (chat or tools)
   * Use this to show loading indicators and disable send button
   */
  get isLoading(): boolean {
    const chatBusy = this.status === "submitted" || this.status === "streaming";
    const toolsBusy = this.agentLoop.isProcessing;
    const hasPendingApprovals =
      this.agentLoop.pendingApprovalExecutions.length > 0;
    return chatBusy || toolsBusy || hasPendingApprovals;
  }

  /**
   * Check if a request is currently in progress (excludes pending approvals)
   * Use this to prevent sending new messages
   */
  get isBusy(): boolean {
    const chatBusy = this.status === "submitted" || this.status === "streaming";
    const toolsBusy = this.agentLoop.isProcessing;
    return chatBusy || toolsBusy;
  }

  // ============================================
  // Tool Execution Getters
  // ============================================

  get toolExecutions(): ToolExecution[] {
    return this.agentLoop.toolExecutions;
  }

  get tools(): ToolDefinition[] {
    return this.agentLoop.tools;
  }

  get iteration(): number {
    return this.agentLoop.iteration;
  }

  get maxIterations(): number {
    return this.agentLoop.maxIterations;
  }

  get isProcessing(): boolean {
    return this.agentLoop.isProcessing;
  }

  // ============================================
  // Chat Actions
  // ============================================

  /**
   * Send a message
   * Returns false if a request is already in progress
   *
   * @param options.editMessageId - Edit flow: new message branches from the
   *   same parent as this message ID
   */
  async sendMessage(
    content: string,
    attachments?: MessageAttachment[],
    options?: { editMessageId?: string },
  ): Promise<boolean> {
    // Guard: Don't send if already processing
    if (this.isLoading) {
      this.debug("sendMessage blocked - request already in progress");
      return false;
    }

    // Reset iteration counter so user can continue after max iterations
    this.agentLoop.resetIterations();
    return await this.chat.sendMessage(content, attachments, options);
  }

  /**
   * Stop generation and cancel any running tools
   */
  stop(): void {
    // 1. Cancel all pending/executing tools
    this.agentLoop.cancel();

    // 2. Stop the HTTP stream
    this.chat.stop();

    this.debug("Stopped - cancelled tools and aborted stream");
  }

  /**
   * Clear all messages
   */
  clearMessages(): void {
    this.chat.clearMessages();
    this.agentLoop.clearToolExecutions();
  }

  /**
   * Set messages directly
   */
  setMessages(messages: UIMessage[]): void {
    this.chat.setMessages(messages);
  }

  /**
   * Regenerate last response
   */
  async regenerate(messageId?: string): Promise<void> {
    await this.chat.regenerate(messageId);
  }

  /**
   * Set tools available for the LLM
   */
  setTools(tools: ToolDefinition[]): void {
    this.chat.setTools(tools);
  }

  /**
   * Update prompt/tool optimization controls.
   */
  setOptimizationConfig(config?: ChatConfig["optimization"]): void {
    this.config.optimization = config;
    this.chat.setOptimizationConfig(config);
  }

  /**
   * Set the active tool profile used for request-time tool selection.
   */
  setToolProfile(profile?: string): void {
    this.chat.setToolProfile(profile);
  }

  /**
   * Get the most recent prompt context usage snapshot.
   */
  getContextUsage(): ContextUsage | null {
    return this.chat.getContextUsage();
  }

  /**
   * Set dynamic context (from useAIContext hook)
   */
  setContext(context: string): void {
    this.chat.setContext(context);
  }

  /**
   * Set system prompt dynamically
   */
  setSystemPrompt(prompt: string): void {
    this.chat.setSystemPrompt(prompt);
  }

  /**
   * Set headers configuration
   * Can be static headers or a getter function for dynamic resolution
   */
  setHeaders(headers: ChatWithToolsConfig["headers"]): void {
    this.chat.setHeaders(headers);
  }

  /**
   * Set URL configuration
   * Can be static URL or a getter function for dynamic resolution
   */
  setUrl(url: ChatWithToolsConfig["runtimeUrl"]): void {
    this.chat.setUrl(url);
  }

  /**
   * Set body configuration
   * Additional properties merged into every request body
   */
  setBody(body: ChatWithToolsConfig["body"]): void {
    this.chat.setBody(body);
  }

  setRequestMessageTransform(
    fn: ((messages: UIMessage[]) => UIMessage[]) | null,
  ): void {
    this.chat.setRequestMessageTransform(fn);
  }

  /**
   * Set inline skills (forwarded to underlying chat instance)
   */
  setInlineSkills(
    skills: Array<{
      name: string;
      description: string;
      content: string;
      strategy?: string;
    }>,
  ): void {
    this.chat.setInlineSkills(skills);
  }

  // ============================================
  // Tool Registration
  // ============================================

  /**
   * Register a tool
   */
  registerTool(tool: ToolDefinition): void {
    this.agentLoop.registerTool(tool);
    // Sync to chat so tools are included in requests
    this.chat.setTools(this.agentLoop.tools);
  }

  /**
   * Unregister a tool
   */
  unregisterTool(name: string): void {
    this.agentLoop.unregisterTool(name);
    // Sync to chat
    this.chat.setTools(this.agentLoop.tools);
  }

  // ============================================
  // Tool Approval
  // ============================================

  /**
   * Approve a tool execution with optional extra data
   */
  approveToolExecution(
    id: string,
    extraData?: Record<string, unknown>,
    permissionLevel?: PermissionLevel,
  ): void {
    this.agentLoop.approveToolExecution(id, extraData, permissionLevel);
  }

  /**
   * Reject a tool execution
   */
  rejectToolExecution(
    id: string,
    reason?: string,
    permissionLevel?: PermissionLevel,
  ): void {
    this.agentLoop.rejectToolExecution(id, reason, permissionLevel);
  }

  /**
   * Clear tool executions
   */
  clearToolExecutions(): void {
    this.agentLoop.clearToolExecutions();
  }

  // ============================================
  // Event Subscriptions (for framework adapters)
  // ============================================

  /**
   * Subscribe to chat events
   */
  on<E extends "toolCalls" | "done" | "error">(
    event: E,
    handler: (event: unknown) => void,
  ): () => void {
    return this.chat.on(event, handler as never);
  }

  // ============================================
  // Cleanup
  // ============================================

  /**
   * Whether this instance has been disposed
   */
  get disposed(): boolean {
    return this.chat.disposed;
  }

  /**
   * Revive a disposed instance (for React StrictMode compatibility)
   * This allows reusing an instance after dispose() was called,
   * preserving registered tools and state
   */
  revive(): void {
    this.chat.revive();
    this.agentLoop.revive();
  }

  /**
   * Dispose and cleanup
   */
  dispose(): void {
    this.chat.dispose();
    this.agentLoop.dispose();
  }

  // ============================================
  // Private
  // ============================================

  private debug(message: string, ...args: unknown[]): void {
    createLogger("tools", () => this.config.debug ?? false)(
      message,
      args.length === 1 ? args[0] : args.length > 1 ? args : undefined,
    );
  }
}

/**
 * Create a ChatWithTools instance
 */
export function createChatWithTools(
  config: ChatWithToolsConfig,
  callbacks?: ChatWithToolsCallbacks,
): ChatWithTools {
  return new ChatWithTools(config, callbacks);
}
