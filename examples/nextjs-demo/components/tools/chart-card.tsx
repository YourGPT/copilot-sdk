"use client";

import type { ToolRendererProps } from "@yourgpt/copilot-sdk-ui";
import type { AnalyticsChartData } from "@/lib/tools/analytics";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

/**
 * Loading skeleton for chart card
 */
function ChartCardSkeleton() {
  return (
    <div className="rounded-xl border bg-card p-4 w-full max-w-md animate-pulse">
      <div className="flex items-center justify-between mb-4">
        <div className="h-5 w-40 bg-muted rounded" />
        <div className="h-4 w-20 bg-muted rounded" />
      </div>
      <div className="h-[200px] bg-muted rounded" />
    </div>
  );
}

/**
 * Error state for chart card
 */
function ChartCardError({ error }: { error?: string }) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 dark:bg-red-950 p-4 w-full max-w-md">
      <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
        <span>⚠️</span>
        <span className="text-sm font-medium">Chart unavailable</span>
      </div>
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}

/**
 * Trend indicator component
 */
function TrendIndicator({ value, label }: { value: number; label: string }) {
  const isPositive = value > 0;
  const isNegative = value < 0;

  return (
    <div className="flex items-center gap-1">
      <span
        className={`text-sm font-medium ${
          isPositive
            ? "text-green-600 dark:text-green-400"
            : isNegative
              ? "text-red-600 dark:text-red-400"
              : "text-muted-foreground"
        }`}
      >
        {isPositive ? "+" : ""}
        {value}%
      </span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

/**
 * ChartCard - Generative UI component for analytics chart tool results
 *
 * Uses Recharts (shadcn pattern) for rendering charts.
 *
 * @example
 * ```tsx
 * <CopilotChat
 *   toolRenderers={{
 *     get_analytics_chart: ChartCard,
 *   }}
 * />
 * ```
 */
export function ChartCard({ execution }: ToolRendererProps) {
  // Loading state
  if (execution.status === "pending" || execution.status === "executing") {
    return <ChartCardSkeleton />;
  }

  // Error state
  if (execution.status === "error" || execution.status === "failed") {
    return <ChartCardError error={execution.error} />;
  }

  // Rejected state
  if (execution.status === "rejected") {
    return (
      <div className="rounded-xl border border-yellow-200 bg-yellow-50 dark:bg-yellow-950 p-4 w-full max-w-md">
        <div className="flex items-center gap-2 text-yellow-600 dark:text-yellow-400">
          <span>🚫</span>
          <span className="text-sm font-medium">
            Analytics request declined
          </span>
        </div>
      </div>
    );
  }

  // Success - render chart
  // Guard against undefined result (race condition safety)
  if (!execution.result) {
    return <ChartCardSkeleton />;
  }

  // execution.result is { success, data, _aiContext?, _aiResponseMode? }
  const result = execution.result as {
    success: boolean;
    data: AnalyticsChartData;
  };
  const data = result.data;

  // Chart color based on CSS variables
  const chartColor = "hsl(var(--primary))";
  const chartColorFill = "hsl(var(--primary) / 0.2)";

  return (
    <div className="rounded-xl border bg-card p-4 w-full max-w-md shadow-sm">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="font-semibold text-foreground">{data.title}</h3>
          <p className="text-2xl font-bold text-foreground mt-1">
            {data.currentValue}
          </p>
        </div>
        <TrendIndicator value={data.trend.value} label={data.trend.label} />
      </div>

      {/* Chart */}
      <div className="h-[200px] mt-4">
        <ResponsiveContainer width="100%" height="100%">
          {data.type === "area" ? (
            <AreaChart data={data.data}>
              <XAxis
                dataKey="name"
                tick={{ fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />
              <YAxis hide />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke={chartColor}
                fill={chartColorFill}
                strokeWidth={2}
              />
            </AreaChart>
          ) : data.type === "bar" ? (
            <BarChart data={data.data}>
              <XAxis
                dataKey="name"
                tick={{ fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />
              <YAxis hide />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
              />
              <Bar dataKey="value" fill={chartColor} radius={[4, 4, 0, 0]} />
            </BarChart>
          ) : (
            <LineChart data={data.data}>
              <XAxis
                dataKey="name"
                tick={{ fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />
              <YAxis hide />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke={chartColor}
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
