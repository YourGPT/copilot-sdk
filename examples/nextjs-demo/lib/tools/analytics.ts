import type { ToolDefinition } from "@yourgpt/copilot-sdk-core";

/**
 * Chart data point
 */
export interface ChartDataPoint {
  name: string;
  value: number;
}

/**
 * Analytics chart data returned by the tool
 */
export interface AnalyticsChartData {
  title: string;
  type: "line" | "bar" | "area";
  data: ChartDataPoint[];
  trend: { value: number; label: string };
  currentValue: string;
}

/**
 * Single metric stat data
 */
export interface StatsData {
  label: string;
  value: string;
  change: number;
  changeLabel: string;
}

type MetricType = "mrr" | "arr" | "churn" | "ltv" | "arpu" | "customers";
type PeriodType = "7d" | "30d" | "90d" | "12m";

/**
 * Generate mock chart data for a metric
 */
function generateMockChartData(
  metric: MetricType,
  period: PeriodType,
): ChartDataPoint[] {
  const points =
    period === "7d" ? 7 : period === "30d" ? 30 : period === "90d" ? 90 : 12;
  const baseValues: Record<MetricType, number> = {
    mrr: 100000,
    arr: 1200000,
    churn: 2,
    ltv: 5000,
    arpu: 150,
    customers: 2500,
  };

  const base = baseValues[metric];
  const variance = metric === "churn" ? 0.5 : base * 0.1;

  return Array.from({ length: points }, (_, i) => {
    const trend = metric === "churn" ? -0.02 : 0.03;
    const value = base + base * trend * i + (Math.random() - 0.5) * variance;
    return {
      name: period === "12m" ? `Month ${i + 1}` : `Day ${i + 1}`,
      value: Math.round(value * 100) / 100,
    };
  });
}

/**
 * Format metric value for display
 */
function formatMetricValue(metric: MetricType, value: number): string {
  switch (metric) {
    case "mrr":
    case "arr":
    case "ltv":
      return `$${(value / 1000).toFixed(0)}k`;
    case "arpu":
      return `$${value.toFixed(0)}`;
    case "churn":
      return `${value.toFixed(1)}%`;
    case "customers":
      return value.toLocaleString();
    default:
      return value.toString();
  }
}

/**
 * Get metric title
 */
function getMetricTitle(metric: MetricType): string {
  const titles: Record<MetricType, string> = {
    mrr: "Monthly Recurring Revenue",
    arr: "Annual Recurring Revenue",
    churn: "Churn Rate",
    ltv: "Customer Lifetime Value",
    arpu: "Average Revenue Per User",
    customers: "Total Customers",
  };
  return titles[metric];
}

/**
 * Analytics Chart Tool
 *
 * AI can call this to get SaaS metrics chart data.
 * Returns mock data for demo purposes.
 */
export const analyticsChartTool: ToolDefinition = {
  name: "get_analytics_chart",
  description:
    "Get analytics chart data for SaaS metrics. Supports MRR, ARR, Churn Rate, LTV, ARPU, and customer count.",
  location: "client",
  inputSchema: {
    type: "object",
    properties: {
      metric: {
        type: "string",
        enum: ["mrr", "arr", "churn", "ltv", "arpu", "customers"],
        description:
          "The metric to chart: mrr, arr, churn, ltv, arpu, or customers",
      },
      period: {
        type: "string",
        enum: ["7d", "30d", "90d", "12m"],
        description:
          "Time period: 7d (week), 30d (month), 90d (quarter), 12m (year)",
      },
    },
    required: ["metric"],
  },
  handler: async ({
    metric,
    period = "30d",
  }: {
    metric: MetricType;
    period?: PeriodType;
  }) => {
    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 800));

    const data = generateMockChartData(metric, period);
    const currentValue = data[data.length - 1].value;
    const previousValue = data[0].value;
    const trendValue = ((currentValue - previousValue) / previousValue) * 100;

    const chartData: AnalyticsChartData = {
      title: `${getMetricTitle(metric)} - Last ${period}`,
      type: metric === "churn" ? "area" : "line",
      data,
      trend: {
        value: Math.round(trendValue * 10) / 10,
        label: "vs start of period",
      },
      currentValue: formatMetricValue(metric, currentValue),
    };

    // AI Response Control: Use brief mode with context summary
    // The chart UI handles the visual display, AI just acknowledges with key metrics
    const trendSign = trendValue > 0 ? "+" : "";
    return {
      success: true,
      data: chartData,
      // Tell AI we're showing a chart so it doesn't repeat all the data
      _aiResponseMode: "brief" as const,
      _aiContext: `[Chart displayed: ${getMetricTitle(metric)} over ${period}, Current: ${formatMetricValue(metric, currentValue)}, Trend: ${trendSign}${Math.round(trendValue * 10) / 10}%]`,
    };
  },
};

/**
 * Stats Tool
 *
 * AI can call this to get a single SaaS metric value with trend.
 */
export const statsTool: ToolDefinition = {
  name: "get_stats",
  description:
    "Get a single SaaS metric value with trend comparison. Good for quick metric checks.",
  location: "client",
  inputSchema: {
    type: "object",
    properties: {
      metric: {
        type: "string",
        enum: ["mrr", "arr", "churn", "ltv", "customers"],
        description: "The metric to get: mrr, arr, churn, ltv, or customers",
      },
    },
    required: ["metric"],
  },
  handler: async ({ metric }: { metric: MetricType }) => {
    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 300));

    const stats: Record<MetricType, Omit<StatsData, "label">> = {
      mrr: { value: "$125,430", change: 8.2, changeLabel: "vs last month" },
      arr: { value: "$1.5M", change: 15.3, changeLabel: "vs last year" },
      churn: { value: "2.3%", change: -0.5, changeLabel: "vs last month" },
      ltv: { value: "$4,850", change: 12.1, changeLabel: "vs last quarter" },
      arpu: { value: "$149", change: 3.5, changeLabel: "vs last month" },
      customers: { value: "2,847", change: 5.1, changeLabel: "vs last month" },
    };

    const metricStats = stats[metric] || stats.mrr;
    const statsData: StatsData = {
      label: getMetricTitle(metric),
      ...metricStats,
    };

    // AI Response Control: Use brief mode - UI shows the stat card, AI gives minimal response
    const changeSign = metricStats.change > 0 ? "+" : "";
    return {
      success: true,
      data: statsData,
      _aiResponseMode: "brief" as const,
      _aiContext: `[Stat displayed: ${getMetricTitle(metric)} = ${metricStats.value}, ${changeSign}${metricStats.change}% ${metricStats.changeLabel}]`,
    };
  },
};
