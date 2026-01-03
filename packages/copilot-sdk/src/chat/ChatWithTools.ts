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
  ToolDefinition,
  MessageAttachment,
  PermissionLevel,
} from "../core";
import { AbstractChat } from "./classes/AbstractChat";
import { AbstractAgentLoop } from "./AbstractAgentLoop";
import type { ChatConfig, ChatCallbacks } from "./types";
import type { UIMessage } from "./types/message";
import type { ToolExecution, AgentLoopCallbacks } from "./types/tool";
import type { ChatState } from "./interfaces/ChatState";
import type { ChatTransport } from "./interfaces/ChatTransport";

/**
 * Configuration for ChatWithTools
 */
export interface ChatWithToolsConfig {
  /** Runtime API endpoint */
  runtimeUrl: string;
  /** LLM configuration */
  llm?: ChatConfig["llm"];
  /** System prompt */
  systemPrompt?: string;
  /** Enable streaming (default: true) */
  streaming?: boolean;
  /** Request headers */
  headers?: Record<string, string>;
  /** Thread ID for conversation persistence */
  threadId?: string;
  /** Debug mode */
  debug?: boolean;
  /** Initial messages */
  initialMessages?: UIMessage[];
  /** Initial tools to register */
  tools?: ToolDefinition[];
  /** Max tool execution iterations (default: 20) */
  maxIterations?: number;
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
      },
    });

    // Wire up internal events
    this.wireEvents();
  }

  /**
   * Wire up internal events between chat and agent loop
   */
  private wireEvents(): void {
    // Handle tool calls from chat
    this.chat.on("toolCalls", async (event) => {
      const toolCalls = event.toolCalls;
      if (!toolCalls?.length) return;

      this.debug("Tool calls received:", toolCalls);

      // NOTE: We do NOT clear previous executions here.
      // Each message filters executions by its toolCallIds (in connected-chat.tsx),
      // so executions accumulate but each message shows only its own tools.
      // This preserves tool results for rendering. Full data is also in messages.

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

        // Continue chat with tool results
        if (results.length > 0) {
          const toolResults = results.map((r) => ({
            toolCallId: r.toolCallId,
            result: r.success ? r.result : { success: false, error: r.error },
          }));

          await this.chat.continueWithToolResults(toolResults);
        }
      } catch (error) {
        this.debug("Error executing tools:", error);
        console.error("[ChatWithTools] Tool execution error:", error);
      }
    });

    // NOTE: We do NOT clear tool executions on "done" event or "toolCalls" event.
    // Tool results need to persist so UI cards can continue rendering them.
    // Full data is also stored in tool messages (Vercel-style) for persistence.
    // Each message filters executions by toolCallIds, so accumulation is safe.
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
   */
  async sendMessage(
    content: string,
    attachments?: MessageAttachment[],
  ): Promise<void> {
    await this.chat.sendMessage(content, attachments);
  }

  /**
   * Stop generation
   */
  stop(): void {
    this.chat.stop();
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
   * Set dynamic context (from useAIContext hook)
   */
  setContext(context: string): void {
    this.chat.setContext(context);
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
    if (this.config.debug) {
      console.log(`[ChatWithTools] ${message}`, ...args);
    }
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
