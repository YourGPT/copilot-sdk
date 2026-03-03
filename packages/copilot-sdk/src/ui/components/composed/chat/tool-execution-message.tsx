"use client";

import * as React from "react";
import { cn } from "../../../lib/utils";
import { Message, MessageAvatar } from "../../ui/message";
import { ToolSteps, type ToolStepData } from "../../ui/tool-steps";
import {
  PermissionConfirmation,
  type PermissionLevel,
} from "../../ui/permission-confirmation";
import { MCPUIFrameList } from "../../ui/mcp-ui-frame";
import type { MCPUIIntent } from "../../../../mcp/ui/types";
import type { ToolExecutionData } from "../tools/tool-execution-list";

interface ToolExecutionMessageProps {
  executions: ToolExecutionData[];
  assistantAvatar?: { src?: string; fallback?: string };
  /** Called when user approves with optional extraData from custom UI */
  onApprove?: (
    executionId: string,
    extraData?: Record<string, unknown>,
    permissionLevel?: PermissionLevel,
  ) => void;
  onReject?: (
    executionId: string,
    reason?: string,
    permissionLevel?: PermissionLevel,
  ) => void;
  /** Custom tool renderers that can handle approval UI */
  toolRenderers?: Record<
    string,
    React.ComponentType<{
      execution: ToolExecutionData;
      approval?: {
        onApprove: (extraData?: Record<string, unknown>) => void;
        onReject: (reason?: string) => void;
        message?: string;
      };
    }>
  >;
  /**
   * Callback when an MCP-UI intent is received from an interactive UI component.
   * Use this with useMCPUIIntents hook to handle tool calls, actions, etc.
   */
  onUIIntent?: (
    intent: MCPUIIntent,
    context: { toolName: string; toolCallId: string },
  ) => void;
  className?: string;
}

/**
 * Standalone tool execution message shown during agentic loop
 * Displays tool calls with status, progress, and approval UI
 */
export function ToolExecutionMessage({
  executions,
  assistantAvatar = { fallback: "AI" },
  onApprove,
  onReject,
  toolRenderers,
  onUIIntent,
  className,
}: ToolExecutionMessageProps) {
  if (!executions || executions.length === 0) return null;

  // Separate pending approvals from other executions
  const pendingApprovals = executions.filter(
    (exec) => exec.approvalStatus === "required",
  );
  const otherExecutions = executions.filter(
    (exec) => exec.approvalStatus !== "required",
  );

  // Convert to ToolStepData format
  const toolSteps: ToolStepData[] = otherExecutions.map((exec) => ({
    id: exec.id,
    name: exec.name,
    args: exec.args,
    status: exec.status,
    result: exec.result,
    error: exec.error,
  }));

  // Check if any tool is currently executing
  const hasExecuting = executions.some((exec) => exec.status === "executing");
  const hasCompleted = executions.some((exec) => exec.status === "completed");
  const allCompleted = executions.every(
    (exec) => exec.status === "completed" || exec.status === "error",
  );

  return (
    <Message className={cn("flex gap-2", className)}>
      <MessageAvatar
        src={assistantAvatar.src || ""}
        alt="Assistant"
        fallback={assistantAvatar.fallback}
        className="bg-primary text-primary-foreground"
      />
      <div className="flex-1 min-w-0 max-w-[85%]">
        {/* Header with status */}
        <div className="flex items-center gap-2 mb-2">
          <div className="flex items-center gap-1.5">
            {hasExecuting && (
              <svg
                className="size-3.5 animate-spin text-primary"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            )}
            {!hasExecuting && allCompleted && (
              <svg
                className="size-3.5 text-green-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5 13l4 4L19 7"
                />
              </svg>
            )}
            <span className="text-xs font-medium text-muted-foreground">
              {hasExecuting
                ? "Running tools..."
                : allCompleted
                  ? `${executions.length} tool${executions.length > 1 ? "s" : ""} completed`
                  : "Tools"}
            </span>
          </div>
        </div>

        {/* Tool Approval Confirmations */}
        {pendingApprovals.length > 0 && (
          <div className="mb-2 space-y-2">
            {pendingApprovals.map((tool) => {
              // Check if there's a custom renderer for this tool
              const CustomRenderer = toolRenderers?.[tool.name];

              if (CustomRenderer) {
                // Use custom renderer with approval callbacks
                return (
                  <CustomRenderer
                    key={tool.id}
                    execution={tool}
                    approval={{
                      onApprove: (extraData) => onApprove?.(tool.id, extraData),
                      onReject: (reason) => onReject?.(tool.id, reason),
                      message: tool.approvalMessage,
                    }}
                  />
                );
              }

              // Default: use PermissionConfirmation
              return (
                <PermissionConfirmation
                  key={tool.id}
                  state="pending"
                  toolName={tool.name}
                  message={
                    tool.approvalMessage ||
                    `This tool wants to execute. Do you approve?`
                  }
                  onApprove={(permissionLevel) =>
                    onApprove?.(tool.id, undefined, permissionLevel)
                  }
                  onReject={(permissionLevel) =>
                    onReject?.(tool.id, undefined, permissionLevel)
                  }
                />
              );
            })}
          </div>
        )}

        {/* Tool Steps */}
        {toolSteps.length > 0 && (
          <div className="rounded-lg border bg-card px-3 py-2.5 shadow-sm">
            <ToolSteps steps={toolSteps} />
          </div>
        )}

        {/* MCP-UI Resources - render interactive UI components from tool results */}
        {otherExecutions.map((exec) => {
          const uiResources = exec.result?._uiResources;
          if (!uiResources || uiResources.length === 0) return null;

          return (
            <MCPUIFrameList
              key={`${exec.id}-ui`}
              resources={uiResources}
              onIntent={(intent) =>
                onUIIntent?.(intent, {
                  toolName: exec.name,
                  toolCallId: exec.id,
                })
              }
              className="mt-2"
            />
          );
        })}
      </div>
    </Message>
  );
}
