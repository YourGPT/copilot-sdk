"use client";

import * as React from "react";
import { cn } from "../../lib/utils";
import { Button } from "./button";
import { CheckIcon, XIcon, AlertTriangleIcon } from "../icons";

// ============================================
// Types
// ============================================

/**
 * Permission level for tool execution
 */
export type PermissionLevel =
  | "ask"
  | "allow_always"
  | "deny_always"
  | "session";

/**
 * Permission option for dropdown/selection
 */
export interface PermissionOption {
  value: PermissionLevel;
  label: string;
  description?: string;
}

/**
 * Default permission options
 */
export const DEFAULT_PERMISSION_OPTIONS: PermissionOption[] = [
  {
    value: "ask",
    label: "Ask every time",
    description: "Always prompt before this tool runs",
  },
  {
    value: "allow_always",
    label: "Allow always",
    description: "Never ask again, always approve",
  },
  {
    value: "session",
    label: "Allow this session",
    description: "Allow until you close this page",
  },
  {
    value: "deny_always",
    label: "Deny always",
    description: "Never ask again, always deny",
  },
];

export type ConfirmationState = "pending" | "approved" | "rejected";

// ============================================
// PermissionConfirmation Component
// ============================================

export interface PermissionConfirmationProps {
  /** Current state: pending, approved, or rejected */
  state: ConfirmationState;
  /** Tool name */
  toolName?: string;
  /** Message to display */
  message?: string;
  /** Called when user approves with permission level */
  onApprove?: (permissionLevel: PermissionLevel) => void;
  /** Called when user rejects with permission level */
  onReject?: (permissionLevel?: PermissionLevel) => void;
  /** Show permission options (default: true) */
  showPermissionOptions?: boolean;
  /** Available permission options */
  permissionOptions?: PermissionOption[];
  /** Additional class name */
  className?: string;
}

/**
 * PermissionConfirmation - Enhanced confirmation with permission level selection
 *
 * Shows a confirmation dialog for tool approval with options to remember the choice.
 *
 * @example
 * ```tsx
 * <PermissionConfirmation
 *   state="pending"
 *   toolName="capture_screenshot"
 *   message="Take a screenshot of the current screen?"
 *   onApprove={(level) => approveToolExecution(tool.id, level)}
 *   onReject={(level) => rejectToolExecution(tool.id, undefined, level)}
 * />
 * ```
 */
export function PermissionConfirmation({
  state,
  toolName,
  message,
  onApprove,
  onReject,
  showPermissionOptions = true,
  permissionOptions = DEFAULT_PERMISSION_OPTIONS,
  className,
}: PermissionConfirmationProps) {
  const [selectedPermission, setSelectedPermission] =
    React.useState<PermissionLevel>("ask");
  const [showOptions, setShowOptions] = React.useState(false);

  const handleApprove = () => {
    onApprove?.(selectedPermission);
  };

  const handleReject = () => {
    // Only pass permission level if it's "deny_always"
    onReject?.(
      selectedPermission === "deny_always" ? "deny_always" : undefined,
    );
  };

  // Approved state
  if (state === "approved") {
    return (
      <div
        className={cn(
          "flex items-center gap-2 px-4 py-2 text-sm text-green-600 dark:text-green-400 rounded-lg border bg-green-50 dark:bg-green-950/20",
          className,
        )}
      >
        <CheckIcon className="h-4 w-4" />
        <span>Approved</span>
      </div>
    );
  }

  // Rejected state
  if (state === "rejected") {
    return (
      <div
        className={cn(
          "flex items-center gap-2 px-4 py-2 text-sm text-red-600 dark:text-red-400 rounded-lg border bg-red-50 dark:bg-red-950/20",
          className,
        )}
      >
        <XIcon className="h-4 w-4" />
        <span>Rejected</span>
      </div>
    );
  }

  // Pending state - show confirmation UI
  return (
    <div
      className={cn(
        "rounded-lg border bg-card text-card-foreground p-4",
        className,
      )}
    >
      {/* Header with tool name */}
      <div className="flex items-start gap-3 mb-3">
        <AlertTriangleIcon className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-500" />
        <div className="flex-1 min-w-0">
          {toolName && (
            <p className="text-sm font-medium text-foreground">{toolName}</p>
          )}
          <p className="text-sm text-muted-foreground">
            {message || "This tool requires your approval to execute."}
          </p>
        </div>
      </div>

      {/* Permission options */}
      {showPermissionOptions && (
        <div className="mb-4">
          <button
            type="button"
            onClick={() => setShowOptions(!showOptions)}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <span>
              {
                permissionOptions.find((o) => o.value === selectedPermission)
                  ?.label
              }
            </span>
            <svg
              className={cn(
                "h-4 w-4 transition-transform",
                showOptions && "rotate-180",
              )}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>

          {showOptions && (
            <div className="mt-2 space-y-1 pl-1">
              {permissionOptions.map((option) => (
                <label
                  key={option.value}
                  className={cn(
                    "flex items-start gap-2 p-2 rounded-md cursor-pointer transition-colors",
                    selectedPermission === option.value
                      ? "bg-primary/10"
                      : "hover:bg-muted/50",
                  )}
                >
                  <input
                    type="radio"
                    name="permission"
                    value={option.value}
                    checked={selectedPermission === option.value}
                    onChange={() => setSelectedPermission(option.value)}
                    className="mt-0.5"
                  />
                  <div>
                    <div className="text-sm font-medium">{option.label}</div>
                    {option.description && (
                      <div className="text-xs text-muted-foreground">
                        {option.description}
                      </div>
                    )}
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={handleReject}>
          Deny
        </Button>
        <Button variant="default" size="sm" onClick={handleApprove}>
          Allow
        </Button>
      </div>
    </div>
  );
}

// ============================================
// CompactPermissionConfirmation Component
// ============================================

export interface CompactPermissionConfirmationProps {
  /** Current state: pending, approved, or rejected */
  state: ConfirmationState;
  /** Message to display */
  message?: string;
  /** Called when user approves */
  onApprove?: (permissionLevel: PermissionLevel) => void;
  /** Called when user rejects */
  onReject?: (permissionLevel?: PermissionLevel) => void;
  /** Additional class name */
  className?: string;
}

/**
 * CompactPermissionConfirmation - Simpler version with "Don't ask again" checkbox
 *
 * @example
 * ```tsx
 * <CompactPermissionConfirmation
 *   state="pending"
 *   message="Take a screenshot?"
 *   onApprove={(level) => approveToolExecution(tool.id, level)}
 *   onReject={(level) => rejectToolExecution(tool.id, undefined, level)}
 * />
 * ```
 */
export function CompactPermissionConfirmation({
  state,
  message,
  onApprove,
  onReject,
  className,
}: CompactPermissionConfirmationProps) {
  const [rememberChoice, setRememberChoice] = React.useState(false);

  const handleApprove = () => {
    onApprove?.(rememberChoice ? "allow_always" : "ask");
  };

  const handleReject = () => {
    onReject?.(rememberChoice ? "deny_always" : undefined);
  };

  // Approved state
  if (state === "approved") {
    return (
      <div
        className={cn(
          "flex items-center gap-2 px-4 py-2 text-sm text-green-600 dark:text-green-400",
          className,
        )}
      >
        <CheckIcon className="h-4 w-4" />
        <span>Approved</span>
      </div>
    );
  }

  // Rejected state
  if (state === "rejected") {
    return (
      <div
        className={cn(
          "flex items-center gap-2 px-4 py-2 text-sm text-red-600 dark:text-red-400",
          className,
        )}
      >
        <XIcon className="h-4 w-4" />
        <span>Rejected</span>
      </div>
    );
  }

  // Pending state
  return (
    <div
      className={cn(
        "rounded-lg border bg-card text-card-foreground p-4",
        className,
      )}
    >
      <div className="flex items-start gap-3 mb-3">
        <AlertTriangleIcon className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-500" />
        <p className="text-sm text-foreground">
          {message || "This action requires your approval."}
        </p>
      </div>

      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
          <input
            type="checkbox"
            checked={rememberChoice}
            onChange={(e) => setRememberChoice(e.target.checked)}
            className="rounded border-gray-300"
          />
          Don't ask again
        </label>

        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleReject}>
            Deny
          </Button>
          <Button variant="default" size="sm" onClick={handleApprove}>
            Allow
          </Button>
        </div>
      </div>
    </div>
  );
}
