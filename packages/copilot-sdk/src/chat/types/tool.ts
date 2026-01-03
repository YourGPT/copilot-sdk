/**
 * Tool Types
 *
 * Types for tool execution and agent loop.
 */

import type { ToolDefinition, PermissionLevel } from "../../core";

/**
 * Tool call from LLM
 */
export interface ToolCallInfo {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

/**
 * Raw tool call from API
 */
export interface RawToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

/**
 * Tool execution status
 */
export type ToolExecutionStatus =
  | "pending"
  | "executing"
  | "completed"
  | "failed"
  | "rejected";

/**
 * Tool approval status
 */
export type ToolApprovalStatus = "none" | "required" | "approved" | "rejected";

/**
 * Tool execution record
 */
export interface ToolExecution {
  id: string;
  toolCallId: string;
  name: string;
  args: Record<string, unknown>;
  status: ToolExecutionStatus;
  approvalStatus: ToolApprovalStatus;
  result?: unknown;
  error?: string;
  startedAt?: Date;
  completedAt?: Date;
  /** Custom approval message from tool definition */
  approvalMessage?: string;
  /** Data passed from user's approval action (e.g., selected supervisor) */
  approvalData?: Record<string, unknown>;
}

/**
 * Tool response
 */
export interface ToolResponse {
  toolCallId: string;
  success: boolean;
  result?: unknown;
  error?: string;
}

/**
 * Agent loop configuration
 */
export interface AgentLoopConfig {
  /** Maximum iterations */
  maxIterations?: number;
  /** Auto-approve all tools */
  autoApprove?: boolean;
  /** Initial tools */
  tools?: ToolDefinition[];
  /** Max tool executions to keep in memory (default: 100). Oldest are pruned. */
  maxExecutionHistory?: number;
}

/**
 * Agent loop callbacks
 */
export interface AgentLoopCallbacks {
  /** Called when tool executions change */
  onExecutionsChange?: (executions: ToolExecution[]) => void;
  /** Called when a tool needs approval */
  onApprovalRequired?: (execution: ToolExecution) => void;
  /** Called when a tool starts */
  onToolStart?: (execution: ToolExecution) => void;
  /** Called when a tool completes */
  onToolComplete?: (execution: ToolExecution) => void;
  /** Called to continue chat with tool results */
  onContinue?: (results: ToolResponse[]) => Promise<void>;
  /** Called when max iterations reached */
  onMaxIterationsReached?: () => void;
}

/**
 * Permission check result
 */
export type PermissionCheckResult =
  | { action: "auto-approve" }
  | { action: "auto-reject"; reason: string }
  | { action: "require-approval" };

/**
 * Agent loop state
 */
export interface AgentLoopState {
  toolExecutions: ToolExecution[];
  iteration: number;
  maxIterations: number;
  maxIterationsReached: boolean;
  isProcessing: boolean;
}

/**
 * Agent loop actions interface
 */
export interface AgentLoopActions {
  /**
   * Approve a tool execution with optional extra data.
   * The extraData is passed to the tool handler via context.approvalData.
   *
   * @param executionId - The tool execution ID
   * @param extraData - Optional data from user's approval action (e.g., selected item)
   * @param permissionLevel - Optional permission level for persistence
   */
  approveToolExecution: (
    executionId: string,
    extraData?: Record<string, unknown>,
    permissionLevel?: PermissionLevel,
  ) => void;

  /**
   * Reject a tool execution.
   *
   * @param executionId - The tool execution ID
   * @param reason - Optional rejection reason
   * @param permissionLevel - Optional permission level for persistence
   */
  rejectToolExecution: (
    executionId: string,
    reason?: string,
    permissionLevel?: PermissionLevel,
  ) => void;

  clearToolExecutions: () => void;
}

/**
 * Initial agent loop state
 */
export const initialAgentLoopState: AgentLoopState = {
  toolExecutions: [],
  iteration: 0,
  maxIterations: 20,
  maxIterationsReached: false,
  isProcessing: false,
};
