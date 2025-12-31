"use client";

import * as React from "react";
import { cn } from "../../lib/utils";
import { TextShimmerLoader } from "./loader";
import { useCopilotUI } from "../../context/copilot-ui-context";

// ============================================
// Types
// ============================================

export type ToolStepStatus =
  | "pending"
  | "executing"
  | "completed"
  | "error"
  | "failed"
  | "rejected";

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
  /** Human-readable title (resolved from tool definition) */
  title?: string;
  /** Title shown while executing */
  executingTitle?: string;
  /** Title shown after completion */
  completedTitle?: string;
}

// ============================================
// Title Utilities
// ============================================

/**
 * Convert snake_case or camelCase tool name to human-readable title
 * @example "get_order_details" -> "Get order details"
 * @example "fetchUserData" -> "Fetch user data"
 */
function toolNameToTitle(name: string): string {
  // Handle snake_case
  let result = name.replace(/_/g, " ");
  // Handle camelCase
  result = result.replace(/([a-z])([A-Z])/g, "$1 $2");
  // Capitalize first letter, lowercase rest
  return result.charAt(0).toUpperCase() + result.slice(1).toLowerCase();
}

/**
 * Get the display title based on tool step status
 */
function getDisplayTitle(step: ToolStepData): string {
  const fallbackTitle = toolNameToTitle(step.name);

  switch (step.status) {
    case "pending":
      return step.title ?? fallbackTitle;
    case "executing":
      if (step.executingTitle) return step.executingTitle;
      return step.title ? `${step.title}...` : `${fallbackTitle}...`;
    case "completed":
      return step.completedTitle ?? step.title ?? fallbackTitle;
    case "error":
    case "failed":
    case "rejected":
      return step.title ?? fallbackTitle;
    default:
      return fallbackTitle;
  }
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
      // Return null - shimmer text handles the loading state
      return null;

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
    case "failed":
    case "rejected":
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
  /** Override debug mode from context */
  debug?: boolean;
  /** Expanded by default (for debug mode) */
  defaultExpanded?: boolean;
  className?: string;
}

/**
 * Format result for display
 */
function formatResult(result: ToolStepData["result"]): string {
  if (!result) return "";
  if (result.message) return result.message;
  if (result.error) return result.error;
  if (result.data) {
    // Don't stringify image data - it's too long
    const data = result.data as Record<string, unknown>;
    if (
      data.image &&
      typeof data.image === "string" &&
      (data.image as string).startsWith("data:image")
    ) {
      return `Image (${data.width || "?"}x${data.height || "?"})`;
    }
    return JSON.stringify(result.data);
  }
  return result.success ? "Success" : "Failed";
}

/**
 * Check if result contains an image
 */
function getResultImage(result: ToolStepData["result"]): string | null {
  if (!result?.data) return null;
  const data = result.data as Record<string, unknown>;
  if (
    data.image &&
    typeof data.image === "string" &&
    (data.image as string).startsWith("data:image")
  ) {
    return data.image as string;
  }
  return null;
}

/**
 * Individual tool step with shimmer loading, status icons, and debug mode
 */
export function ToolStep({
  step,
  showLine = false,
  debug: debugProp,
  defaultExpanded,
  className,
}: ToolStepProps) {
  const { isDebug, defaultDebugExpanded } = useCopilotUI();
  const debug = debugProp ?? isDebug;

  const [expanded, setExpanded] = React.useState(
    defaultExpanded ?? defaultDebugExpanded ?? false,
  );

  const displayTitle = getDisplayTitle(step);
  const hasDebugContent =
    (step.args && Object.keys(step.args).length > 0) || step.result;
  const isExecuting = step.status === "executing";
  const isCompleted = step.status === "completed";
  const isError =
    step.status === "error" ||
    step.status === "failed" ||
    step.status === "rejected";

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
        {/* Status indicator - only show for non-executing states */}
        {!isExecuting && (
          <StatusIndicator status={step.status} className="mt-0.5" />
        )}

        <div className="flex-1 min-w-0">
          {/* Clickable trigger */}
          <button
            type="button"
            onClick={() => debug && hasDebugContent && setExpanded(!expanded)}
            disabled={!debug || !hasDebugContent}
            className={cn(
              "flex items-center gap-2 text-left min-w-0 w-full",
              debug &&
                hasDebugContent &&
                "cursor-pointer hover:text-foreground",
              !debug && "cursor-default",
            )}
          >
            {/* Title with shimmer for executing state */}
            {isExecuting ? (
              <TextShimmerLoader text={displayTitle} size="sm" />
            ) : (
              <span
                className={cn(
                  "text-sm truncate",
                  isCompleted && "text-foreground",
                  isError && "text-red-500",
                  step.status === "pending" && "text-muted-foreground/60",
                )}
              >
                {displayTitle}
              </span>
            )}

            {/* Expand indicator - only in debug mode with content */}
            {debug && hasDebugContent && (
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

          {/* Debug: Collapsible content (args + results) */}
          {debug && expanded && hasDebugContent && (
            <div className="mt-1.5 space-y-1.5">
              {/* Arguments */}
              {step.args && Object.keys(step.args).length > 0 && (
                <div className="text-[10px] font-mono bg-muted/50 rounded px-2 py-1 overflow-x-auto">
                  <span className="text-muted-foreground">args: </span>
                  {JSON.stringify(step.args)}
                </div>
              )}

              {/* Result */}
              {step.result && (
                <div
                  className={cn(
                    "text-[10px] font-mono rounded px-2 py-1 overflow-x-auto whitespace-pre-wrap break-all",
                    step.result.success !== false
                      ? "bg-green-500/10 text-green-600 dark:text-green-400"
                      : "bg-red-500/10 text-red-600 dark:text-red-400",
                  )}
                >
                  <span className="text-muted-foreground">result: </span>
                  {formatResult(step.result)}
                  {/* Render image if present */}
                  {getResultImage(step.result) && (
                    <img
                      src={getResultImage(step.result)!}
                      alt="Screenshot"
                      className="mt-1.5 rounded border border-border max-w-full max-h-48 object-contain"
                    />
                  )}
                </div>
              )}
            </div>
          )}

          {/* Error display (always visible, not just in debug) */}
          {isError && step.error && !step.result && (
            <div className="mt-0.5 text-[10px] font-mono bg-red-500/10 text-red-600 dark:text-red-400 rounded px-1.5 py-0.5">
              {step.error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================
// Tool Steps Container
// ============================================

export interface ToolStepsProps {
  steps: ToolStepData[];
  /** Override debug mode from context */
  debug?: boolean;
  /** Expand all by default (in debug mode) */
  defaultExpanded?: boolean;
  /** Class name */
  className?: string;
}

/**
 * Compact tool steps display with shimmer loading and debug mode
 *
 * @example
 * ```tsx
 * <ToolSteps
 *   steps={[
 *     { id: "1", name: "get_weather", status: "completed", title: "Get weather" },
 *     { id: "2", name: "navigate", status: "executing", executingTitle: "Navigating..." },
 *   ]}
 *   debug={true}
 * />
 * ```
 */
export function ToolSteps({
  steps,
  debug,
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
          debug={debug}
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
