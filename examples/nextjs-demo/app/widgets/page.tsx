"use client";

import { YourGPTProvider, useTools } from "@yourgpt/copilot-sdk-react";
import { CopilotChat } from "@yourgpt/copilot-sdk-ui";
import { weatherTool, analyticsChartTool, statsTool } from "@/lib/tools";
import { WeatherCard, ChartCard, StatsCard } from "@/components/tools";
import Link from "next/link";
import { builtinTools } from "@yourgpt/copilot-sdk-core";

/**
 * Inner component that registers tools and renders chat
 */
function WidgetsDemoChat() {
  // Register tools with the provider (object format, keyed by tool name)
  useTools({
    get_weather: weatherTool,
    get_analytics_chart: analyticsChartTool,
    get_stats: statsTool,
    capture_screenshot: builtinTools.capture_screenshot,
  });

  return (
    <CopilotChat
      className="h-full"
      title="AI Dashboard Assistant"
      placeholder="Ask about weather or SaaS metrics..."
      suggestions={[
        "What's the weather in San Francisco?",
        "Show me MRR for the last 30 days",
        "What's our current churn rate?",
      ]}
      toolRenderers={{
        get_weather: WeatherCard,
        get_analytics_chart: ChartCard,
        get_stats: StatsCard,
      }}
    />
  );
}

/**
 * Widgets Demo Page
 *
 * Showcases Generative UI with custom tool renderers.
 * AI can call tools that render as rich UI components instead of JSON.
 */
export default function WidgetsDemo() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Generative UI Demo</h1>
              <p className="text-muted-foreground text-sm mt-1">
                AI renders rich UI components from tool results
              </p>
            </div>
            <Link
              href="/"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              ← Back to Multi-Provider Demo
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto p-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-140px)]">
          {/* Chat Area */}
          <div className="lg:col-span-2 border rounded-xl overflow-hidden bg-card">
            <YourGPTProvider runtimeUrl="/api/chat/openai" debug>
              <WidgetsDemoChat />
            </YourGPTProvider>
          </div>

          {/* Info Sidebar */}
          <div className="space-y-4">
            {/* Available Tools */}
            <div className="border rounded-xl p-4 bg-card">
              <h2 className="font-semibold mb-3">Available Tools</h2>
              <div className="space-y-3">
                <ToolInfo
                  name="get_weather"
                  description="Get current weather for any city"
                  example="What's the weather in Miami?"
                />
                <ToolInfo
                  name="get_analytics_chart"
                  description="Get SaaS metrics chart (MRR, ARR, Churn, etc.)"
                  example="Show me ARR for the last 90 days"
                />
                <ToolInfo
                  name="get_stats"
                  description="Get a single metric value with trend"
                  example="What's our LTV?"
                />
              </div>
            </div>

            {/* Try These */}
            <div className="border rounded-xl p-4 bg-card">
              <h2 className="font-semibold mb-3">Try These Prompts</h2>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• "What's the weather in New York and Seattle?"</li>
                <li>• "Show me MRR and churn rate for Q4"</li>
                <li>• "Compare weather in Miami vs Denver"</li>
                <li>• "Get all our key SaaS metrics"</li>
                <li>• "What's the 7-day trend for ARPU?"</li>
              </ul>
            </div>

            {/* How It Works */}
            <div className="border rounded-xl p-4 bg-card">
              <h2 className="font-semibold mb-3">How It Works</h2>
              <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
                <li>AI decides which tool to call based on your question</li>
                <li>Tool executes and returns structured data</li>
                <li>Custom React component renders the result</li>
                <li>AI can call multiple tools in one response</li>
              </ol>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

/**
 * Tool info component for sidebar
 */
function ToolInfo({
  name,
  description,
  example,
}: {
  name: string;
  description: string;
  example: string;
}) {
  return (
    <div className="p-3 rounded-lg bg-muted/50">
      <code className="text-xs font-mono text-primary">{name}</code>
      <p className="text-sm text-muted-foreground mt-1">{description}</p>
      <p className="text-xs text-muted-foreground/70 mt-1 italic">
        Try: "{example}"
      </p>
    </div>
  );
}
