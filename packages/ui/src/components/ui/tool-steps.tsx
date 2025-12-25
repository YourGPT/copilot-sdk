"use client";

import * as React from "react";
import { cn } from "../../lib/utils";

// ============================================
// Types
// ============================================

export type ToolStepStatus = "pending" | "executing" | "completed" | "error";

export interface ToolStepData {
  id: string;
  name: string;
  args?: Record<string, unknown>;
  status: ToolStepStatus;
  result?: {
    success: boolean;
    message?: string;
    error?: string;
    data?: unknown;
  };
  error?: string;
}

// ============================================
// Status Indicator
// ============================================

interface StatusIndicatorProps {
  status: ToolStepStatus;
  className?: string;
}

function StatusIndicator({ status, className }: StatusIndicatorProps) {
  const baseClasses = "flex-shrink-0";

  switch (status) {
    case "pending":
      return (
        <div
          className={cn(
            baseClasses,
            "size-3 flex items-center justify-center",
            className,
          )}
        >
          <div className="size-1.5 rounded-full bg-muted-foreground/40" />
        </div>
      );

    case "executing":
      return (
        <div
          className={cn(
            baseClasses,
            "size-3 flex items-center justify-center",
            className,
          )}
        >
          <svg
            className="size-3 animate-spin text-primary"
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
        </div>
      );

    case "completed":
      return (
        <div
          className={cn(
            baseClasses,
            "size-3 flex items-center justify-center",
            className,
          )}
        >
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
      return (
        <div
          className={cn(
            baseClasses,
            "size-3 flex items-center justify-center",
            className,
          )}
        >
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

// ============================================
// Tool Step
// ============================================

export interface ToolStepProps {
  step: ToolStepData;
  /** Show connecting line to next step */
  showLine?: boolean;
  /** Expanded by default */
  defaultExpanded?: boolean;
  className?: string;
}

/**
 * Individual tool step with expandable details
 */
export function ToolStep({
  step,
  showLine = false,
  defaultExpanded = false,
  className,
}: ToolStepProps) {
  const [expanded, setExpanded] = React.useState(defaultExpanded);
  const hasDetails =
    (step.args && Object.keys(step.args).length > 0) ||
    step.result ||
    step.error;

  return (
    <div className={cn("relative", className)}>
      {/* Connecting line */}
      {showLine && (
        <div
          className="absolute left-[5px] top-4 bottom-0 w-px bg-border"
          aria-hidden="true"
        />
      )}

      {/* Step row */}
      <div className="flex items-start gap-2">
        <StatusIndicator status={step.status} className="mt-0.5" />

        <button
          type="button"
          onClick={() => hasDetails && setExpanded(!expanded)}
          disabled={!hasDetails}
          className={cn(
            "flex-1 flex items-center gap-2 text-left min-w-0",
            hasDetails && "cursor-pointer hover:text-foreground",
            !hasDetails && "cursor-default",
          )}
        >
          {/* Tool name */}
          <span
            className={cn(
              "font-mono text-xs truncate",
              step.status === "executing" && "text-primary",
              step.status === "completed" && "text-muted-foreground",
              step.status === "error" && "text-red-500",
              step.status === "pending" && "text-muted-foreground/60",
            )}
          >
            {step.name}
          </span>

          {/* Status text */}
          <span className="text-[10px] text-muted-foreground/60">
            {step.status === "executing" && "running..."}
            {step.status === "error" && "failed"}
          </span>

          {/* Expand indicator */}
          {hasDetails && (
            <svg
              className={cn(
                "size-3 text-muted-foreground/40 transition-transform ml-auto flex-shrink-0",
                expanded && "rotate-90",
              )}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 5l7 7-7 7"
              />
            </svg>
          )}
        </button>
      </div>

      {/* Expandable details */}
      {expanded && hasDetails && (
        <div className="ml-5 mt-1 space-y-1 text-[10px]">
          {/* Arguments */}
          {step.args && Object.keys(step.args).length > 0 && (
            <div className="text-muted-foreground font-mono bg-muted/50 rounded px-1.5 py-0.5 overflow-x-auto">
              {JSON.stringify(step.args)}
            </div>
          )}

          {/* Result */}
          {step.result && (
            <div
              className={cn(
                "font-mono rounded px-1.5 py-0.5 overflow-x-auto",
                step.result.success
                  ? "bg-green-500/10 text-green-600 dark:text-green-400"
                  : "bg-red-500/10 text-red-600 dark:text-red-400",
              )}
            >
              {step.result.message ||
                step.result.error ||
                (step.result.data ? JSON.stringify(step.result.data) : null) ||
                (step.result.success ? "Success" : "Failed")}
            </div>
          )}

          {/* Error */}
          {step.error && !step.result && (
            <div className="font-mono bg-red-500/10 text-red-600 dark:text-red-400 rounded px-1.5 py-0.5 overflow-x-auto">
              {step.error}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================
// Tool Steps Container
// ============================================

export interface ToolStepsProps {
  steps: ToolStepData[];
  /** Expand all by default */
  defaultExpanded?: boolean;
  /** Class name */
  className?: string;
}

/**
 * Compact tool steps display (chain-of-thought style)
 *
 * @example
 * ```tsx
 * <ToolSteps
 *   steps={[
 *     { id: "1", name: "get_weather", status: "completed", args: { city: "NYC" } },
 *     { id: "2", name: "navigate", status: "executing", args: { path: "/home" } },
 *   ]}
 * />
 * ```
 */
export function ToolSteps({
  steps,
  defaultExpanded = false,
  className,
}: ToolStepsProps) {
  if (steps.length === 0) return null;

  return (
    <div className={cn("space-y-1.5", className)}>
      {steps.map((step, index) => (
        <ToolStep
          key={step.id}
          step={step}
          showLine={index < steps.length - 1}
          defaultExpanded={defaultExpanded}
        />
      ))}
    </div>
  );
}

// ============================================
// Inline Tool Steps (super compact, single line)
// ============================================

export interface InlineToolStepsProps {
  steps: ToolStepData[];
  /** Max steps to show before collapsing */
  maxVisible?: number;
  className?: string;
}

/**
 * Ultra-compact inline display showing just status icons
 *
 * @example
 * ```tsx
 * <InlineToolSteps steps={toolExecutions} />
 * // Shows: ✓ ✓ ⟳ ○
 * ```
 */
export function InlineToolSteps({
  steps,
  maxVisible = 5,
  className,
}: InlineToolStepsProps) {
  if (steps.length === 0) return null;

  const visibleSteps = steps.slice(0, maxVisible);
  const hiddenCount = steps.length - maxVisible;

  return (
    <div className={cn("flex items-center gap-1", className)}>
      {visibleSteps.map((step) => (
        <div
          key={step.id}
          title={`${step.name}: ${step.status}`}
          className="flex items-center"
        >
          <StatusIndicator status={step.status} />
        </div>
      ))}
      {hiddenCount > 0 && (
        <span className="text-[10px] text-muted-foreground">
          +{hiddenCount}
        </span>
      )}
    </div>
  );
}
