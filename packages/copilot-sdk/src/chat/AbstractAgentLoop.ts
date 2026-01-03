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

  // Registered tools
  private registeredTools: Map<string, ToolDefinition> = new Map();

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
    return Array.from(this.registeredTools.values());
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
    this._toolExecutions = [...this._toolExecutions, execution];

    // Prune old executions if over limit (prevents memory leak)
    if (this._toolExecutions.length > this._maxExecutionHistory) {
      this._toolExecutions = this._toolExecutions.slice(
        -this._maxExecutionHistory,
      );
    }

    this.callbacks.onExecutionsChange?.(this._toolExecutions);
  }

  private updateToolExecution(
    id: string,
    update: Partial<ToolExecution>,
  ): void {
    this._toolExecutions = this._toolExecutions.map((exec) =>
      exec.id === id ? { ...exec, ...update } : exec,
    );
    this.callbacks.onExecutionsChange?.(this._toolExecutions);
  }

  // ============================================
  // Tool Registration
  // ============================================

  /**
   * Register a tool
   */
  registerTool(tool: ToolDefinition): void {
    this.registeredTools.set(tool.name, tool);
  }

  /**
   * Unregister a tool
   */
  unregisterTool(name: string): void {
    this.registeredTools.delete(name);
  }

  /**
   * Get a registered tool
   */
  getTool(name: string): ToolDefinition | undefined {
    return this.registeredTools.get(name);
  }

  // ============================================
  // Tool Execution
  // ============================================

  /**
   * Execute tool calls from LLM response
   * Returns tool results for sending back to LLM
   */
  async executeToolCalls(toolCalls: ToolCallInfo[]): Promise<ToolResponse[]> {
    // Check iteration limit
    if (this._iteration >= this._maxIterations) {
      this._maxIterationsReached = true;
      this.callbacks.onMaxIterationsReached?.();
      return [];
    }

    this.setIteration(this._iteration + 1);
    const results: ToolResponse[] = [];

    for (const toolCall of toolCalls) {
      const result = await this.executeSingleTool(toolCall);
      results.push(result);
    }

    return results;
  }

  /**
   * Execute a single tool
   */
  private async executeSingleTool(
    toolCall: ToolCallInfo,
  ): Promise<ToolResponse> {
    const tool = this.registeredTools.get(toolCall.name);

    // Create execution record
    const execution: ToolExecution = {
      id: toolCall.id,
      toolCallId: toolCall.id,
      name: toolCall.name,
      args: toolCall.args,
      status: "pending",
      approvalStatus: "none",
      startedAt: new Date(),
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
      // Get approval message (can be string or function)
      const approvalMessage =
        typeof tool.approvalMessage === "function"
          ? tool.approvalMessage(toolCall.args)
          : tool.approvalMessage;

      execution.approvalStatus = "required";
      execution.approvalMessage = approvalMessage;
      this.updateToolExecution(toolCall.id, {
        approvalStatus: "required",
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
      // Pass approvalData to handler via context
      const result = await tool.handler(toolCall.args, {
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
  // State Management
  // ============================================

  /**
   * Reset the agent loop for a new conversation
   */
  reset(): void {
    this.clearToolExecutions();
    this.pendingApprovals.clear();
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
  dispose(): void {
    // Reject all pending approvals
    for (const [_id, pending] of this.pendingApprovals) {
      pending.resolve({ approved: false });
    }
    this.pendingApprovals.clear();
    this.registeredTools.clear();
    this._toolExecutions = [];
  }
}
