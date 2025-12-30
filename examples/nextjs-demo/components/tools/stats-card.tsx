"use client";

import type { ToolRendererProps } from "@yourgpt/copilot-sdk-ui";
import type { StatsData } from "@/lib/tools/analytics";

/**
 * Loading skeleton for stats card
 */
function StatsCardSkeleton() {
  return (
    <div className="rounded-xl border bg-card p-4 w-[200px] animate-pulse">
      <div className="h-4 w-24 bg-muted rounded mb-2" />
      <div className="h-8 w-20 bg-muted rounded mb-2" />
      <div className="h-3 w-16 bg-muted rounded" />
    </div>
  );
}

/**
 * Error state for stats card
 */
function StatsCardError({ error }: { error?: string }) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 dark:bg-red-950 p-4 w-[200px]">
      <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
        <span>⚠️</span>
        <span className="text-sm font-medium">Error</span>
      </div>
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}

/**
 * StatsCard - Generative UI component for single metric display
 *
 * @example
 * ```tsx
 * <CopilotChat
 *   toolRenderers={{
 *     get_stats: StatsCard,
 *   }}
 * />
 * ```
 */
export function StatsCard({ execution }: ToolRendererProps) {
  // Loading state
  if (execution.status === "pending" || execution.status === "executing") {
    return <StatsCardSkeleton />;
  }

  // Error state
  if (execution.status === "error" || execution.status === "failed") {
    return <StatsCardError error={execution.error} />;
  }

  // Rejected state
  if (execution.status === "rejected") {
    return (
      <div className="rounded-xl border border-yellow-200 bg-yellow-50 dark:bg-yellow-950 p-4 w-[200px]">
        <span className="text-sm text-yellow-600 dark:text-yellow-400">
          Request declined
        </span>
      </div>
    );
  }

  // Success - render stats
  // Guard against undefined result (race condition safety)
  if (!execution.result) {
    return <StatsCardSkeleton />;
  }

  // execution.result is { success, data, _aiContext?, _aiResponseMode? }
  const result = execution.result as { success: boolean; data: StatsData };
  const data = result.data;
  const isPositive = data.change > 0;
  const isNegative = data.change < 0;

  return (
    <div className="rounded-xl border bg-card p-4 w-[200px] shadow-sm">
      <p className="text-sm text-muted-foreground">{data.label}</p>
      <p className="text-2xl font-bold text-foreground mt-1">{data.value}</p>
      <div className="flex items-center gap-1 mt-2">
        <span
          className={`text-sm font-medium ${
            isPositive
              ? "text-green-600 dark:text-green-400"
              : isNegative
                ? "text-red-600 dark:text-red-400"
                : "text-muted-foreground"
          }`}
        >
          {isPositive ? "↑" : isNegative ? "↓" : "→"} {isPositive ? "+" : ""}
          {data.change}%
        </span>
        <span className="text-xs text-muted-foreground">
          {data.changeLabel}
        </span>
      </div>
    </div>
  );
}
