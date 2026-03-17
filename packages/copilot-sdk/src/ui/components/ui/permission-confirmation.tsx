"use client";

import { cn } from "../../lib/utils";
import { CheckIcon, XIcon, AlertTriangleIcon } from "../icons";

// ============================================
// Types
// ============================================

export type PermissionLevel =
  | "ask"
  | "allow_always"
  | "deny_always"
  | "session";

export interface PermissionOption {
  value: PermissionLevel;
  label: string;
  description?: string;
}

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
  state: ConfirmationState;
  toolName?: string;
  message?: string;
  onApprove?: (permissionLevel: PermissionLevel) => void;
  onReject?: (permissionLevel?: PermissionLevel) => void;
  // showPermissionOptions disabled for now — causes issues
  // showPermissionOptions?: boolean;
  // permissionOptions?: PermissionOption[];
  className?: string;
}

export function PermissionConfirmation({
  state,
  toolName,
  message,
  onApprove,
  onReject,
  className,
}: PermissionConfirmationProps) {
  const handleApprove = () => {
    onApprove?.("ask");
  };

  const handleReject = () => {
    onReject?.(undefined);
  };

  if (state === "approved") {
    return (
      <div
        className={cn(
          "csdk-confirm-result",
          "inline-flex items-center gap-2 px-3 py-1.5 text-sm",
          "rounded-2xl border border-green-200/70 dark:border-green-900/40",
          "bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-400",
          className,
        )}
      >
        <CheckIcon className="h-3.5 w-3.5 shrink-0" />
        <span>Approved</span>
      </div>
    );
  }

  if (state === "rejected") {
    return (
      <div
        className={cn(
          "csdk-confirm-result",
          "inline-flex items-center gap-2 px-3 py-1.5 text-sm",
          "rounded-2xl border border-red-200/70 dark:border-red-900/40",
          "bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400",
          className,
        )}
      >
        <XIcon className="h-3.5 w-3.5 shrink-0" />
        <span>Rejected</span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "csdk-confirm-card",
        "w-full rounded-2xl border border-border/60 bg-card text-card-foreground shadow-sm overflow-hidden",
        className,
      )}
    >
      {/* Body */}
      <div className="flex items-start gap-3 p-4">
        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-950/50">
          <AlertTriangleIcon className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
        </div>
        <div className="flex-1 min-w-0 pt-0.5">
          {toolName && (
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">
              {toolName}
            </p>
          )}
          <p className="text-sm text-foreground leading-snug">
            {message || "This tool requires your approval to execute."}
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 px-4 pb-4">
        <button
          type="button"
          onClick={handleReject}
          className={cn(
            "csdk-confirm-btn",
            "px-4 py-1.5 text-sm font-medium rounded-xl",
            "border border-border bg-transparent text-muted-foreground",
            "hover:bg-muted/60 hover:text-foreground",
          )}
        >
          Deny
        </button>
        <button
          type="button"
          onClick={handleApprove}
          className={cn(
            "csdk-confirm-btn",
            "px-4 py-1.5 text-sm font-medium rounded-xl",
            "bg-primary text-primary-foreground",
            "hover:opacity-90",
          )}
        >
          Allow
        </button>
      </div>
    </div>
  );
}

// ============================================
// CompactPermissionConfirmation Component
// ============================================

export interface CompactPermissionConfirmationProps {
  state: ConfirmationState;
  message?: string;
  onApprove?: (permissionLevel: PermissionLevel) => void;
  onReject?: (permissionLevel?: PermissionLevel) => void;
  className?: string;
}

export function CompactPermissionConfirmation({
  state,
  message,
  onApprove,
  onReject,
  className,
}: CompactPermissionConfirmationProps) {
  // "Don't ask again" checkbox disabled for now
  // const [rememberChoice, setRememberChoice] = React.useState(false);

  const handleApprove = () => {
    onApprove?.("ask");
  };

  const handleReject = () => {
    onReject?.(undefined);
  };

  if (state === "approved") {
    return (
      <div
        className={cn(
          "csdk-confirm-result",
          "inline-flex items-center gap-2 px-3 py-1.5 text-sm",
          "rounded-2xl border border-green-200/70 dark:border-green-900/40",
          "bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-400",
          className,
        )}
      >
        <CheckIcon className="h-3.5 w-3.5 shrink-0" />
        <span>Approved</span>
      </div>
    );
  }

  if (state === "rejected") {
    return (
      <div
        className={cn(
          "csdk-confirm-result",
          "inline-flex items-center gap-2 px-3 py-1.5 text-sm",
          "rounded-2xl border border-red-200/70 dark:border-red-900/40",
          "bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400",
          className,
        )}
      >
        <XIcon className="h-3.5 w-3.5 shrink-0" />
        <span>Rejected</span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "csdk-confirm-card",
        "w-full rounded-2xl border border-border/60 bg-card text-card-foreground shadow-sm overflow-hidden",
        className,
      )}
    >
      <div className="flex items-start gap-3 p-4">
        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-950/50">
          <AlertTriangleIcon className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
        </div>
        <p className="flex-1 min-w-0 pt-0.5 text-sm text-foreground leading-snug">
          {message || "This action requires your approval."}
        </p>
      </div>

      <div className="flex items-center justify-end gap-2 px-4 pb-4">
        {/* Don't ask again — disabled for now */}
        {/* <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer mr-auto">
          <input
            type="checkbox"
            checked={rememberChoice}
            onChange={(e) => setRememberChoice(e.target.checked)}
            className="rounded border-gray-300"
          />
          Don't ask again
        </label> */}
        <button
          type="button"
          onClick={handleReject}
          className={cn(
            "csdk-confirm-btn",
            "px-4 py-1.5 text-sm font-medium rounded-xl",
            "border border-border bg-transparent text-muted-foreground",
            "hover:bg-muted/60 hover:text-foreground",
          )}
        >
          Deny
        </button>
        <button
          type="button"
          onClick={handleApprove}
          className={cn(
            "csdk-confirm-btn",
            "px-4 py-1.5 text-sm font-medium rounded-xl",
            "bg-primary text-primary-foreground",
            "hover:opacity-90",
          )}
        >
          Allow
        </button>
      </div>
    </div>
  );
}
