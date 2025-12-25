"use client";

import * as React from "react";
import { cn } from "../../lib/utils";
import { Button } from "./button";
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
          "confirmation rounded-lg border bg-card text-card-foreground",
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

  return <div className={cn("p-4", className)}>{children}</div>;
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
        "flex items-center gap-2 px-4 py-2 text-sm text-green-600 dark:text-green-400",
        className,
      )}
    >
      <CheckIcon className="h-4 w-4" />
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
        "flex items-center gap-2 px-4 py-2 text-sm text-red-600 dark:text-red-400",
        className,
      )}
    >
      <XIcon className="h-4 w-4" />
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
      <AlertTriangleIcon className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-500" />
      <p className="text-sm text-foreground">
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
    <div className={cn("mt-3 flex justify-end gap-2", className)}>
      <Button variant="outline" size="sm" onClick={onReject}>
        {rejectLabel}
      </Button>
      <Button variant="default" size="sm" onClick={onApprove}>
        {approveLabel}
      </Button>
    </div>
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
