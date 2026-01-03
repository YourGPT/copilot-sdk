"use client";

import React, { useState } from "react";
import { cn } from "../../../lib/utils";
import { CircularLoader } from "../../ui/loader";

/**
 * Tool execution status
 */
export type ToolExecutionStatus =
  | "pending"
  | "executing"
  | "completed"
  | "error"
  | "failed"
  | "rejected";

/**
 * Tool approval status (for human-in-the-loop)
 */
export type ToolApprovalStatus =
  | "none" // No approval needed (default)
  | "required" // Waiting for user decision
  | "approved" // User approved
  | "rejected"; // User rejected

/**
 * Tool execution data
 */
export interface ToolExecutionData {
  id: string;
  name: string;
  args: Record<string, unknown>;
  status: ToolExecutionStatus;
  result?: {
    success: boolean;
    message?: string;
    error?: string;
    data?: unknown;
  };
  error?: string;
  timestamp: number;
  duration?: number;
  /** Approval status for human-in-the-loop tools */
  approvalStatus?: ToolApprovalStatus;
  /** Message shown in approval UI */
  approvalMessage?: string;
  /** Data passed from user's approval action (e.g., selected item) */
  approvalData?: Record<string, unknown>;
}

/**
 * Props for ToolExecutionList
 */
export interface ToolExecutionListProps {
  /** List of tool executions to display */
  executions: ToolExecutionData[];
  /** Whether to expand args by default */
  defaultExpanded?: boolean;
  /** Class name for the container */
  className?: string;
  /** Title for the list */
  title?: string;
  /** Show timestamps */
  showTimestamp?: boolean;
  /** Empty state message */
  emptyMessage?: string;
}

/**
 * Status icon component
 */
function StatusIcon({ status }: { status: ToolExecutionStatus }) {
  switch (status) {
    case "pending":
      return (
        <div className="size-4 rounded-full bg-yellow-500/20 flex items-center justify-center">
          <div className="size-2 rounded-full bg-yellow-500" />
        </div>
      );
    case "executing":
      return <CircularLoader size="sm" className="text-blue-500" />;
    case "completed":
      return (
        <div className="size-4 rounded-full bg-green-500/20 flex items-center justify-center">
          <svg
            className="size-3 text-green-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={3}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
      );
    case "error":
    case "failed":
    case "rejected":
      return (
        <div className="size-4 rounded-full bg-red-500/20 flex items-center justify-center">
          <svg
            className="size-3 text-red-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={3}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </div>
      );
  }
}

/**
 * Chevron icon component
 */
function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      className={cn(
        "size-4 text-muted-foreground transition-transform duration-200",
        expanded && "rotate-90",
      )}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  );
}

/**
 * Single tool execution item
 */
function ToolExecutionItem({
  execution,
  defaultExpanded = false,
  showTimestamp = false,
}: {
  execution: ToolExecutionData;
  defaultExpanded?: boolean;
  showTimestamp?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const hasDetails =
    Object.keys(execution.args).length > 0 ||
    execution.result ||
    execution.error;

  const statusLabel = {
    pending: "Pending",
    executing: "Running",
    completed: "Done",
    error: "Failed",
    failed: "Failed",
    rejected: "Rejected",
  }[execution.status];

  return (
    <div
      className={cn(
        "border rounded-lg overflow-hidden transition-colors",
        execution.status === "error" ||
          execution.status === "failed" ||
          execution.status === "rejected"
          ? "border-red-500/30 bg-red-500/5"
          : execution.status === "completed"
            ? "border-green-500/30 bg-green-500/5"
            : execution.status === "executing"
              ? "border-blue-500/30 bg-blue-500/5"
              : "border-border bg-background",
      )}
    >
      {/* Header */}
      <button
        type="button"
        onClick={() => hasDetails && setExpanded(!expanded)}
        disabled={!hasDetails}
        className={cn(
          "w-full flex items-center gap-3 px-3 py-2 text-left",
          hasDetails && "hover:bg-muted/50 cursor-pointer",
        )}
      >
        <StatusIcon status={execution.status} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-medium truncate">
              {execution.name}
            </span>
            <span className="text-xs text-muted-foreground">{statusLabel}</span>
          </div>
          {showTimestamp && (
            <span className="text-xs text-muted-foreground">
              {new Date(execution.timestamp).toLocaleTimeString()}
            </span>
          )}
        </div>

        {execution.duration !== undefined && (
          <span className="text-xs text-muted-foreground">
            {execution.duration}ms
          </span>
        )}

        {hasDetails && <ChevronIcon expanded={expanded} />}
      </button>

      {/* Expandable content */}
      {expanded && hasDetails && (
        <div className="border-t border-border px-3 py-2 space-y-2">
          {/* Arguments */}
          {Object.keys(execution.args).length > 0 && (
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-1">
                Arguments
              </div>
              <pre className="text-xs bg-muted rounded p-2 overflow-x-auto">
                {JSON.stringify(execution.args, null, 2)}
              </pre>
            </div>
          )}

          {/* Result */}
          {execution.result && (
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-1">
                Result
              </div>
              <pre
                className={cn(
                  "text-xs rounded p-2 overflow-x-auto",
                  execution.result.success
                    ? "bg-green-500/10 text-green-700 dark:text-green-300"
                    : "bg-red-500/10 text-red-700 dark:text-red-300",
                )}
              >
                {execution.result.message ||
                  execution.result.error ||
                  JSON.stringify(execution.result.data, null, 2) ||
                  (execution.result.success ? "Success" : "Failed")}
              </pre>
            </div>
          )}

          {/* Error */}
          {execution.error && !execution.result && (
            <div>
              <div className="text-xs font-medium text-red-500 mb-1">Error</div>
              <pre className="text-xs bg-red-500/10 text-red-700 dark:text-red-300 rounded p-2 overflow-x-auto">
                {execution.error}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Tool Execution List Component
 *
 * Displays a list of tool executions with their status, arguments, and results.
 * Supports expandable items to show detailed information.
 *
 * @example
 * ```tsx
 * <ToolExecutionList
 *   executions={[
 *     {
 *       id: "1",
 *       name: "navigate",
 *       args: { path: "/dashboard" },
 *       status: "completed",
 *       result: { success: true, message: "Navigated to /dashboard" },
 *       timestamp: Date.now(),
 *       duration: 150,
 *     },
 *   ]}
 * />
 * ```
 */
export function ToolExecutionList({
  executions,
  defaultExpanded = false,
  className,
  title = "Tool Executions",
  showTimestamp = false,
  emptyMessage = "No tool executions yet",
}: ToolExecutionListProps) {
  if (executions.length === 0) {
    return (
      <div
        className={cn(
          "text-sm text-muted-foreground text-center py-4",
          className,
        )}
      >
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      {title && (
        <div className="flex items-center justify-between px-1">
          <h3 className="text-sm font-medium text-foreground">{title}</h3>
          <span className="text-xs text-muted-foreground">
            {executions.length} execution{executions.length !== 1 ? "s" : ""}
          </span>
        </div>
      )}

      <div className="space-y-2">
        {executions.map((execution) => (
          <ToolExecutionItem
            key={execution.id}
            execution={execution}
            defaultExpanded={defaultExpanded}
            showTimestamp={showTimestamp}
          />
        ))}
      </div>
    </div>
  );
}
