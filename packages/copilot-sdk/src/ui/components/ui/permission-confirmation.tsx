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
          "inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium",
          "rounded-2xl border border-green-200/60 dark:border-green-800/40",
          "bg-green-50/80 dark:bg-green-950/20 text-green-700 dark:text-green-400",
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
          "inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium",
          "rounded-2xl border border-red-200/60 dark:border-red-800/40",
          "bg-red-50/80 dark:bg-red-950/20 text-red-700 dark:text-red-400",
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
        "w-full rounded-2xl overflow-hidden",
        "border border-border/60",
        "bg-card text-card-foreground shadow-sm",
        className,
      )}
    >
      {/* Body */}
      <div className="flex items-start gap-3 p-4 pb-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-muted">
          <AlertTriangleIcon className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        </div>
        <div className="flex-1 min-w-0 pt-0.5">
          {toolName && (
            <p className="text-[10px] font-semibold uppercase tracking-widest text-amber-600/80 dark:text-amber-400/70 mb-1">
              {toolName}
            </p>
          )}
          <p className="text-sm text-foreground leading-snug">
            {message || "This tool requires your approval to execute."}
          </p>
        </div>
      </div>

      {/* Divider */}
      <div className="mx-4 border-t border-border/40" />

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 px-4 py-3">
        <button
          type="button"
          onClick={handleReject}
          className={cn(
            "csdk-confirm-btn",
            "px-4 py-1.5 text-sm font-medium rounded-xl",
            "border border-border/80 bg-transparent text-muted-foreground",
            "hover:bg-muted/80 hover:text-foreground hover:border-border",
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
            "hover:bg-primary/90",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
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
          "inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium",
          "rounded-2xl border border-green-200/60 dark:border-green-800/40",
          "bg-green-50/80 dark:bg-green-950/20 text-green-700 dark:text-green-400",
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
          "inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium",
          "rounded-2xl border border-red-200/60 dark:border-red-800/40",
          "bg-red-50/80 dark:bg-red-950/20 text-red-700 dark:text-red-400",
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
        "w-full rounded-2xl overflow-hidden",
        "border border-border/60",
        "bg-card text-card-foreground shadow-sm",
        className,
      )}
    >
      <div className="flex items-start gap-3 p-4 pb-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-muted">
          <AlertTriangleIcon className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        </div>
        <p className="flex-1 min-w-0 pt-0.5 text-sm text-foreground leading-snug">
          {message || "This action requires your approval."}
        </p>
      </div>

      {/* Divider */}
      <div className="mx-4 border-t border-border/40" />

      <div className="flex items-center justify-end gap-2 px-4 py-3">
        <button
          type="button"
          onClick={handleReject}
          className={cn(
            "csdk-confirm-btn",
            "px-4 py-1.5 text-sm font-medium rounded-xl",
            "border border-border/80 bg-transparent text-muted-foreground",
            "hover:bg-muted/80 hover:text-foreground hover:border-border",
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
            "hover:bg-primary/90",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
          )}
        >
          Allow
        </button>
      </div>
    </div>
  );
}
