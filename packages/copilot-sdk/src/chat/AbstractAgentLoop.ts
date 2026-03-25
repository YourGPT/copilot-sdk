/**
 * AbstractAgentLoop - Framework-agnostic agent loop for tool execution
 *
 * Handles the agentic loop where the LLM can call tools, receive results,
 * and continue processing until completion.
 */

import type { ToolDefinition, PermissionLevel } from "../core";

import type {
  AgentLoopState,
  AgentLoopConfig,
  AgentLoopCallbacks,
  AgentLoopActions,
  ToolExecution,
  ToolResponse,
} from "./types/index";

/**
 * Tool call info from LLM response
 */
export interface ToolCallInfo {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

/**
 * AbstractAgentLoop - Core agent loop functionality
 *
 * @example
 * ```typescript
 * const agentLoop = new AbstractAgentLoop(config, {
 *   onToolExecutionsChange: setToolExecutions,
 *   onToolApprovalRequired: handleApproval,
 * });
 *
 * // Register tools
 * agentLoop.registerTool(myTool);
 *
 * // Execute tool calls from LLM
 * await agentLoop.executeToolCalls(toolCalls);
 * ```
 */
export class AbstractAgentLoop implements AgentLoopActions {
  // Internal state
  private _toolExecutions: ToolExecution[] = [];
  private _iteration = 0;
  private _maxIterations: number;
  private _maxIterationsReached = false;
  private _isProcessing = false;
  private _isCancelled = false;

  // Cancellation support
  private abortController: AbortController | null = null;

  // Registered tools with reference counting for React StrictMode compatibility
  // Tools are never fully removed during a session - only marked as inactive
  private registeredTools: Map<
    string,
    { tool: ToolDefinition; refCount: number; active: boolean }
  > = new Map();

  // Pending approvals - resolve with approval result including extraData
  private pendingApprovals: Map<
    string,
    {
      resolve: (result: {
        approved: boolean;
        extraData?: Record<string, unknown>;
      }) => void;
      execution: ToolExecution;
    }
  > = new Map();

  // Configuration
  private config: AgentLoopConfig;
  private callbacks: AgentLoopCallbacks;

  // Max executions to keep in memory (prevents memory leak)
  private _maxExecutionHistory: number;

  constructor(
    config: AgentLoopConfig = {},
    callbacks: AgentLoopCallbacks = {},
  ) {
    this.config = config;
    this.callbacks = callbacks;
    this._maxIterations = config.maxIterations ?? 20;
    this._maxExecutionHistory = config.maxExecutionHistory ?? 100;

    // Register initial tools
    if (config.tools) {
      for (const tool of config.tools) {
        this.registerTool(tool);
      }
    }
  }

  // ============================================
  // Getters
  // ============================================

  get toolExecutions(): ToolExecution[] {
    return this._toolExecutions;
  }

  get iteration(): number {
    return this._iteration;
  }

  get maxIterations(): number {
    return this._maxIterations;
  }

  get maxIterationsReached(): boolean {
    return this._maxIterationsReached;
  }

  get isProcessing(): boolean {
    return this._isProcessing;
  }

  get isCancelled(): boolean {
    return this._isCancelled;
  }

  get signal(): AbortSignal | undefined {
    return this.abortController?.signal;
  }

  get state(): AgentLoopState {
    return {
      toolExecutions: this._toolExecutions,
      iteration: this._iteration,
      maxIterations: this._maxIterations,
      maxIterationsReached: this._maxIterationsReached,
      isProcessing: this._isProcessing,
    };
  }

  get pendingApprovalExecutions(): ToolExecution[] {
    return this._toolExecutions.filter(
      (exec) => exec.approvalStatus === "required",
    );
  }

  get tools(): ToolDefinition[] {
    // Only return active tools for API requests
    return Array.from(this.registeredTools.values())
      .filter((entry) => entry.active)
      .map((entry) => entry.tool);
  }

  // ============================================
  // Private setters with callbacks
  // ============================================

  private setToolExecutions(executions: ToolExecution[]): void {
    this._toolExecutions = executions;
    this.callbacks.onExecutionsChange?.(executions);
  }

  private setIteration(iteration: number): void {
    this._iteration = iteration;
  }

  private setProcessing(processing: boolean): void {
    this._isProcessing = processing;
  }

  private addToolExecution(execution: ToolExecution): void {
    // Check for duplicate by ID - skip if already exists
    const existingIndex = this._toolExecutions.findIndex(
      (e) => e.id === execution.id,
    );
    if (existingIndex !== -1) {
      // Skip duplicate - don't add or merge
      return;
    }

    this._toolExecutions = [...this._toolExecutions, execution];

    // Prune old executions if over limit (prevents memory leak)
    if (this._toolExecutions.length > this._maxExecutionHistory) {
      this._toolExecutions = this._toolExecutions.slice(
        -this._maxExecutionHistory,
      );
    }

    this.callbacks.onExecutionsChange?.(this._toolExecutions);
  }

  /**
   * Update a tool execution with partial data
   */
  updateToolExecution(id: string, update: Partial<ToolExecution>): void {
    this._toolExecutions = this._toolExecutions.map((exec) =>
      exec.id === id ? { ...exec, ...update } : exec,
    );
    this.callbacks.onExecutionsChange?.(this._toolExecutions);
  }

  // ============================================
  // Tool Registration
  // ============================================

  /**
   * Register a tool (reference counted for React StrictMode compatibility)
   * Tools are never fully removed - ref counting ensures StrictMode works correctly
   */
  registerTool(tool: ToolDefinition): void {
    const existing = this.registeredTools.get(tool.name);
    if (existing) {
      // Update the tool definition and increment ref count
      existing.tool = tool;
      existing.refCount++;
      existing.active = true;
    } else {
      // New tool
      this.registeredTools.set(tool.name, {
        tool,
        refCount: 1,
        active: true,
      });
    }
  }

  /**
   * Unregister a tool (reference counted for React StrictMode compatibility)
   * Tool is only marked inactive when refCount reaches 0, never deleted
   */
  unregisterTool(name: string): void {
    const entry = this.registeredTools.get(name);
    if (entry) {
      entry.refCount = Math.max(0, entry.refCount - 1);
      if (entry.refCount === 0) {
        entry.active = false;
      }
    }
  }

  /**
   * Get a registered tool (returns active tools, or inactive if forExecution=true)
   */
  getTool(name: string): ToolDefinition | undefined {
    const entry = this.registeredTools.get(name);
    // Always return the tool if it exists - handler execution should work
    // even if the component temporarily unmounted (StrictMode)
    return entry?.tool;
  }

  // ============================================
  // Tool Execution
  // ============================================

  /**
   * Execute tool calls from LLM response
   * Returns tool results for sending back to LLM
   */
  async executeToolCalls(toolCalls: ToolCallInfo[]): Promise<ToolResponse[]> {
    // Check if cancelled
    if (this._isCancelled) {
      return [];
    }

    // Check iteration limit
    if (this._iteration >= this._maxIterations) {
      this._maxIterationsReached = true;
      this.callbacks.onMaxIterationsReached?.();
      return [];
    }

    // Create new abort controller for this batch
    // Do NOT reset _isCancelled here — if stop() was called between the
    // iteration check above and this line, we must not wipe that signal.
    // _isCancelled is only reset in resetIterations() (called by sendMessage).
    this.abortController = new AbortController();
    this._isProcessing = true;

    this.setIteration(this._iteration + 1);

    // Run all tools in parallel so approval-required tools don't block
    // non-approval tools. All results are still collected together before
    // returning (Anthropic API requires results for every tool_use block).
    const results = await Promise.all(
      toolCalls.map((toolCall) => {
        if (this._isCancelled || this.abortController!.signal.aborted) {
          return Promise.resolve<ToolResponse>({
            toolCallId: toolCall.id,
            success: false,
            error: "Tool execution cancelled",
          });
        }
        return this.executeSingleTool(toolCall);
      }),
    );

    this._isProcessing = false;
    return results;
  }

  /**
   * Execute a single tool
   */
  private async executeSingleTool(
    toolCall: ToolCallInfo,
  ): Promise<ToolResponse> {
    const tool = this.getTool(toolCall.name);

    // Create execution record
    const execution: ToolExecution = {
      id: toolCall.id,
      toolCallId: toolCall.id,
      name: toolCall.name,
      args: toolCall.args,
      status: "pending",
      approvalStatus: "none",
      startedAt: new Date(),
      hidden: tool?.hidden,
    };

    this.addToolExecution(execution);
    this.callbacks.onToolStart?.(execution);

    // Tool not found
    if (!tool) {
      const errorResult: ToolResponse = {
        toolCallId: toolCall.id,
        success: false,
        error: `Tool "${toolCall.name}" not found`,
      };
      this.updateToolExecution(toolCall.id, {
        status: "failed",
        error: errorResult.error,
        completedAt: new Date(),
      });
      return errorResult;
    }

    // Track approval data for passing to handler
    let approvalData: Record<string, unknown> | undefined;

    // Check if approval is needed
    if (tool.needsApproval && !this.config.autoApprove) {
      // Get approval title and message (can be string or function)
      const approvalTitle =
        typeof tool.approvalTitle === "function"
          ? tool.approvalTitle(toolCall.args)
          : tool.approvalTitle;

      const approvalMessage =
        typeof tool.approvalMessage === "function"
          ? tool.approvalMessage(toolCall.args)
          : tool.approvalMessage;

      execution.approvalStatus = "required";
      execution.approvalTitle = approvalTitle;
      execution.approvalMessage = approvalMessage;
      this.updateToolExecution(toolCall.id, {
        approvalStatus: "required",
        approvalTitle,
        approvalMessage,
      });
      this.callbacks.onApprovalRequired?.(execution);

      // Wait for approval - now returns { approved, extraData }
      const approvalResult = await this.waitForApproval(toolCall.id, execution);

      if (!approvalResult.approved) {
        const rejectedResult: ToolResponse = {
          toolCallId: toolCall.id,
          success: false,
          error: "Tool execution was rejected by user",
        };
        this.updateToolExecution(toolCall.id, {
          status: "rejected",
          approvalStatus: "rejected",
          error: rejectedResult.error,
          completedAt: new Date(),
        });
        return rejectedResult;
      }

      // Store approval data for handler
      approvalData = approvalResult.extraData;

      // Note: approvalStatus is already set to "approved" in approveToolExecution
    }

    // Execute the tool
    this.updateToolExecution(toolCall.id, { status: "executing" });

    try {
      if (!tool.handler) {
        throw new Error(`Tool "${toolCall.name}" has no handler`);
      }

      // Check if cancelled before executing
      if (this._isCancelled || this.abortController?.signal.aborted) {
        throw new Error("Tool execution cancelled");
      }

      // Pass signal and approvalData to handler via context
      const result = await tool.handler(toolCall.args, {
        signal: this.abortController?.signal,
        data: { toolCallId: toolCall.id },
        approvalData,
      });

      this.updateToolExecution(toolCall.id, {
        status: "completed",
        result,
        completedAt: new Date(),
      });

      const updatedExecution = this._toolExecutions.find(
        (e) => e.id === toolCall.id,
      );
      if (updatedExecution) {
        this.callbacks.onToolComplete?.(updatedExecution);
      }

      return {
        toolCallId: toolCall.id,
        success: true,
        result,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      this.updateToolExecution(toolCall.id, {
        status: "failed",
        error: errorMessage,
        completedAt: new Date(),
      });

      return {
        toolCallId: toolCall.id,
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Wait for user approval
   * Returns approval result with optional extraData from user's action
   */
  private waitForApproval(
    executionId: string,
    execution: ToolExecution,
  ): Promise<{ approved: boolean; extraData?: Record<string, unknown> }> {
    return new Promise((resolve) => {
      this.pendingApprovals.set(executionId, { resolve, execution });
    });
  }

  // ============================================
  // Actions (implements AgentLoopActions)
  // ============================================

  /**
   * Approve a tool execution with optional extra data
   */
  approveToolExecution(
    executionId: string,
    extraData?: Record<string, unknown>,
    _permissionLevel?: PermissionLevel,
  ): void {
    const pending = this.pendingApprovals.get(executionId);
    if (pending) {
      pending.resolve({ approved: true, extraData });
      this.pendingApprovals.delete(executionId);

      // Store approvalData in execution record
      this.updateToolExecution(executionId, {
        approvalStatus: "approved",
        approvalData: extraData,
      });
    }
  }

  /**
   * Reject a tool execution
   */
  rejectToolExecution(
    executionId: string,
    reason?: string,
    _permissionLevel?: PermissionLevel,
  ): void {
    const pending = this.pendingApprovals.get(executionId);
    if (pending) {
      if (reason) {
        this.updateToolExecution(executionId, {
          error: reason,
        });
      }
      pending.resolve({ approved: false });
      this.pendingApprovals.delete(executionId);
    }
  }

  /**
   * Clear all tool executions
   */
  clearToolExecutions(): void {
    this.setToolExecutions([]);
    this.setIteration(0);
    this._maxIterationsReached = false;
  }

  // ============================================
  // Server-Side Tool Tracking
  // ============================================

  /**
   * Add a server-side tool execution (from streaming action:start event)
   * Used to track tools executed on the server (not client-side)
   */
  addServerToolExecution(info: {
    id: string;
    name: string;
    hidden?: boolean;
  }): void {
    const execution: ToolExecution = {
      id: info.id,
      toolCallId: info.id,
      name: info.name,
      args: {},
      status: "executing",
      approvalStatus: "none",
      startedAt: new Date(),
      hidden: info.hidden,
    };
    this.addToolExecution(execution);
  }

  /**
   * Update a server-side tool execution with args (from action:args event)
   */
  updateServerToolArgs(id: string, args: Record<string, unknown>): void {
    this.updateToolExecution(id, { args });
  }

  /**
   * Complete a server-side tool execution (from action:end event)
   */
  completeServerToolExecution(info: {
    id: string;
    result?: unknown;
    error?: string;
  }): void {
    this.updateToolExecution(info.id, {
      status: info.error ? "failed" : "completed",
      result: info.result,
      error: info.error,
      completedAt: new Date(),
    });
  }

  /**
   * Cancel all pending and executing tools
   * This will:
   * 1. Abort the current abort controller (signals tools to stop)
   * 2. Reject all pending approvals
   * 3. Mark executing tools as cancelled
   */
  cancel(): void {
    this._isCancelled = true;
    this._isProcessing = false;

    // Abort the controller to signal tools
    this.abortController?.abort();

    // Reject all pending approvals
    for (const [id, pending] of this.pendingApprovals) {
      pending.resolve({ approved: false });
      this.updateToolExecution(id, {
        status: "failed",
        approvalStatus: "rejected",
        error: "Cancelled by user",
        completedAt: new Date(),
      });
    }
    this.pendingApprovals.clear();

    // Mark any executing tools as failed
    for (const exec of this._toolExecutions) {
      if (exec.status === "executing" || exec.status === "pending") {
        this.updateToolExecution(exec.id, {
          status: "failed",
          error: "Cancelled by user",
          completedAt: new Date(),
        });
      }
    }
  }

  // ============================================
  // State Management
  // ============================================

  /**
   * Reset the agent loop for a new conversation
   */
  reset(): void {
    this.clearToolExecutions();
    this.pendingApprovals.clear();
    this._isCancelled = false;
    this.abortController = null;
  }

  /**
   * Reset iteration counter only (allows continuing after max iterations)
   * Called when user sends a new message
   */
  resetIterations(): void {
    this.setIteration(0);
    this._maxIterationsReached = false;
    this._isCancelled = false;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<AgentLoopConfig>): void {
    this.config = { ...this.config, ...config };
    if (config.maxIterations !== undefined) {
      this._maxIterations = config.maxIterations;
    }
  }

  /**
   * Update callbacks
   */
  updateCallbacks(callbacks: Partial<AgentLoopCallbacks>): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  // ============================================
  // Cleanup
  // ============================================

  /**
   * Dispose of resources
   */
  private _isDisposed = false;

  /**
   * Whether this instance has been disposed
   */
  get disposed(): boolean {
    return this._isDisposed;
  }

  /**
   * Dispose and cleanup
   * Note: Tools are NOT cleared to support React StrictMode revive()
   */
  dispose(): void {
    if (this._isDisposed) {
      return;
    }
    this._isDisposed = true;

    // Reject all pending approvals
    for (const [_id, pending] of this.pendingApprovals) {
      pending.resolve({ approved: false });
    }
    this.pendingApprovals.clear();

    // Tools persist for React StrictMode revive() - ref counting handles lifecycle
    this._toolExecutions = [];
  }

  /**
   * Revive a disposed instance (for React StrictMode compatibility)
   * Tools are preserved across dispose/revive cycle
   */
  revive(): void {
    if (!this._isDisposed) {
      return;
    }
    this._isDisposed = false;
    this._isCancelled = false;
    this._maxIterationsReached = false;
  }
}
