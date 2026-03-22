"use client";

import * as React from "react";
import { cn } from "../../lib/utils";
import { CheckIcon, XIcon, AlertTriangleIcon } from "../icons";

// ============================================
// Types
// ============================================

export type ConfirmationState =
  | "pending" // Waiting for user decision
  | "approved" // User approved
  | "rejected"; // User rejected

export interface ConfirmationContextValue {
  state: ConfirmationState;
  message?: string;
  onApprove?: () => void;
  onReject?: () => void;
}

// ============================================
// Context
// ============================================

const ConfirmationContext =
  React.createContext<ConfirmationContextValue | null>(null);

function useConfirmationContext() {
  const context = React.useContext(ConfirmationContext);
  if (!context) {
    throw new Error(
      "Confirmation components must be used within a Confirmation provider",
    );
  }
  return context;
}

// ============================================
// Confirmation Root
// ============================================

export interface ConfirmationProps {
  children?: React.ReactNode;
  /** Current approval state */
  state?: ConfirmationState;
  /** Message to display */
  message?: string;
  /** Called when user approves */
  onApprove?: () => void;
  /** Called when user rejects */
  onReject?: () => void;
  /** Additional class name */
  className?: string;
}

/**
 * Confirmation component - Tool approval/rejection UI
 *
 * Similar to Vercel AI SDK's Confirmation component for human-in-the-loop patterns.
 *
 * @example
 * ```tsx
 * <Confirmation
 *   state={execution.approvalStatus}
 *   message="This tool wants to delete a file."
 *   onApprove={() => approveToolExecution(execution.id)}
 *   onReject={() => rejectToolExecution(execution.id)}
 * >
 *   <ConfirmationPending>
 *     <ConfirmationMessage />
 *     <ConfirmationActions />
 *   </ConfirmationPending>
 *   <ConfirmationApproved />
 *   <ConfirmationRejected />
 * </Confirmation>
 * ```
 */
export function Confirmation({
  children,
  state = "pending",
  message,
  onApprove,
  onReject,
  className,
}: ConfirmationProps) {
  return (
    <ConfirmationContext.Provider
      value={{ state, message, onApprove, onReject }}
    >
      <div
        className={cn(
          "csdk-confirm-card",
          "confirmation rounded-2xl overflow-hidden",
          "border border-amber-200/50 dark:border-amber-900/30",
          "bg-card text-card-foreground shadow-sm",
          className,
        )}
      >
        {children}
      </div>
    </ConfirmationContext.Provider>
  );
}

// ============================================
// Conditional Rendering Components
// ============================================

export interface ConfirmationPendingProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Renders children only when state is "pending"
 */
export function ConfirmationPending({
  children,
  className,
}: ConfirmationPendingProps) {
  const { state } = useConfirmationContext();
  if (state !== "pending") return null;

  return <div className={cn("pl-5 pr-4 pt-4 pb-3", className)}>{children}</div>;
}

export interface ConfirmationApprovedProps {
  children?: React.ReactNode;
  className?: string;
}

/**
 * Renders children (or default approved message) when state is "approved"
 */
export function ConfirmationApproved({
  children,
  className,
}: ConfirmationApprovedProps) {
  const { state } = useConfirmationContext();
  if (state !== "approved") return null;

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
      {children || <span>Approved</span>}
    </div>
  );
}

export interface ConfirmationRejectedProps {
  children?: React.ReactNode;
  className?: string;
}

/**
 * Renders children (or default rejected message) when state is "rejected"
 */
export function ConfirmationRejected({
  children,
  className,
}: ConfirmationRejectedProps) {
  const { state } = useConfirmationContext();
  if (state !== "rejected") return null;

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
      {children || <span>Rejected</span>}
    </div>
  );
}

// ============================================
// Content Components
// ============================================

export interface ConfirmationMessageProps {
  children?: React.ReactNode;
  className?: string;
}

/**
 * Displays the approval message
 */
export function ConfirmationMessage({
  children,
  className,
}: ConfirmationMessageProps) {
  const { message } = useConfirmationContext();

  return (
    <div className={cn("flex items-start gap-3", className)}>
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-950/50 ring-1 ring-amber-200/60 dark:ring-amber-800/40">
        <AlertTriangleIcon className="h-4 w-4 text-amber-600 dark:text-amber-400" />
      </div>
      <p className="flex-1 min-w-0 pt-0.5 text-sm text-foreground leading-snug">
        {children || message || "This action requires your approval."}
      </p>
    </div>
  );
}

export interface ConfirmationActionsProps {
  children?: React.ReactNode;
  className?: string;
  /** Label for reject button */
  rejectLabel?: string;
  /** Label for approve button */
  approveLabel?: string;
}

/**
 * Renders approval/rejection action buttons
 */
export function ConfirmationActions({
  children,
  className,
  rejectLabel = "Reject",
  approveLabel = "Approve",
}: ConfirmationActionsProps) {
  const { onApprove, onReject } = useConfirmationContext();

  // Allow custom buttons via children
  if (children) {
    return (
      <div className={cn("mt-3 flex justify-end gap-2", className)}>
        {children}
      </div>
    );
  }

  return (
    <>
      <div className="mx-0 border-t border-border/40 mt-3" />
      <div className={cn("flex justify-end gap-2 pt-3", className)}>
        <button
          type="button"
          onClick={onReject}
          className={cn(
            "csdk-confirm-btn",
            "px-4 py-1.5 text-sm font-medium rounded-xl",
            "border border-border/80 bg-transparent text-muted-foreground",
            "hover:bg-muted/80 hover:text-foreground hover:border-border",
          )}
        >
          {rejectLabel}
        </button>
        <button
          type="button"
          onClick={onApprove}
          className={cn(
            "csdk-confirm-btn",
            "px-4 py-1.5 text-sm font-medium rounded-xl",
            "bg-primary text-primary-foreground",
            "hover:bg-primary/90",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
          )}
        >
          {approveLabel}
        </button>
      </div>
    </>
  );
}

// ============================================
// Simple Confirmation (Convenience Component)
// ============================================

export interface SimpleConfirmationProps {
  /** Current approval state */
  state: ConfirmationState;
  /** Message to display */
  message?: string;
  /** Called when user approves */
  onApprove?: () => void;
  /** Called when user rejects */
  onReject?: () => void;
  /** Label for reject button */
  rejectLabel?: string;
  /** Label for approve button */
  approveLabel?: string;
  /** Additional class name */
  className?: string;
}

/**
 * SimpleConfirmation - Convenience wrapper with all states built-in
 *
 * @example
 * ```tsx
 * <SimpleConfirmation
 *   state={execution.approvalStatus === "required" ? "pending" : execution.approvalStatus}
 *   message="Delete file /tmp/example.txt?"
 *   onApprove={() => approveToolExecution(execution.id)}
 *   onReject={() => rejectToolExecution(execution.id)}
 * />
 * ```
 */
export function SimpleConfirmation({
  state,
  message,
  onApprove,
  onReject,
  rejectLabel,
  approveLabel,
  className,
}: SimpleConfirmationProps) {
  return (
    <Confirmation
      state={state}
      message={message}
      onApprove={onApprove}
      onReject={onReject}
      className={className}
    >
      <ConfirmationPending>
        <ConfirmationMessage />
        <ConfirmationActions
          rejectLabel={rejectLabel}
          approveLabel={approveLabel}
        />
      </ConfirmationPending>
      <ConfirmationApproved />
      <ConfirmationRejected />
    </Confirmation>
  );
}
