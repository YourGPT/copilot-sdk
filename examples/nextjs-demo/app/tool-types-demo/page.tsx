"use client";

import { CopilotProvider } from "@yourgpt/copilot-sdk/react";
import { CopilotChat, type ToolRendererProps } from "@yourgpt/copilot-sdk/ui";
import { TestTools } from "./components/test-tools";
import {
  ChartCard,
  ChartSkeleton,
  AppOverrideCard,
} from "./components/test-cards";

/**
 * Tool Types Demo Page
 *
 * Tests all 6 combinations of tool rendering:
 * 1. Basic tool - default ToolSteps
 * 2. Tool with render - custom UI for all states
 * 3. Default approval - PermissionConfirmation
 * 4. Approval + render - interactive custom UI
 * 5. toolRenderers only - app-level override
 * 6. Override priority - toolRenderers > tool.render
 */
export default function ToolTypesDemoPage() {
  // App-level toolRenderers for testing
  const toolRenderers: Record<
    string,
    React.ComponentType<ToolRendererProps>
  > = {
    // TYPE 5: App-level renderer for chart_tool (tool has no render)
    chart_tool: ({ execution }) => {
      if (execution.status === "pending" || execution.status === "executing") {
        return <ChartSkeleton />;
      }
      if (execution.status === "completed" && execution.result) {
        const data = execution.result as {
          data?: { title: string; data: number[] };
        };
        return (
          <ChartCard
            title={data.data?.title || "Chart"}
            data={data.data?.data || [1, 2, 3]}
          />
        );
      }
      return null;
    },

    // TYPE 6: Override priority test - this should WIN over tool.render
    priority_tool: ({ execution }) => {
      if (execution.status === "pending" || execution.status === "executing") {
        return (
          <div className="p-4 bg-orange-100 dark:bg-orange-900/20 rounded-lg border border-orange-300">
            <span className="text-orange-600">App override loading...</span>
          </div>
        );
      }
      return <AppOverrideCard />;
    },
  };

  return (
    <CopilotProvider runtimeUrl="/api/chat/anthropic">
      {/* Register test tools */}
      <TestTools />

      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-10">
          <div className="container mx-auto px-4 py-4">
            <h1 className="text-2xl font-bold text-center">Tool Types Demo</h1>
            <p className="text-center text-muted-foreground text-sm mt-1">
              Test all 6 combinations of tool rendering
            </p>
          </div>
        </header>

        {/* Main Content */}
        <main className="container mx-auto p-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: Test Cases List */}
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Test Cases</h2>

              <div className="space-y-3">
                <TestCaseCard
                  number={1}
                  title="Basic Tool"
                  trigger="Call basic_tool"
                  expected="Default ToolSteps UI (pending → executing → completed)"
                  color="gray"
                />
                <TestCaseCard
                  number={2}
                  title="Tool with Render"
                  trigger="Call weather_tool with city='Tokyo'"
                  expected="WeatherSkeleton → WeatherCard (custom UI)"
                  color="blue"
                />
                <TestCaseCard
                  number={3}
                  title="Default Approval"
                  trigger="Call delete_tool with itemId='123'"
                  expected="PermissionConfirmation modal → then executes"
                  color="red"
                />
                <TestCaseCard
                  number={4}
                  title="Approval + Custom Render"
                  trigger="Call assign_tool with taskName='Review PR'"
                  expected="SelectionCard → user picks → CompletedCard with selection"
                  color="yellow"
                />
                <TestCaseCard
                  number={5}
                  title="toolRenderers Only"
                  trigger="Call chart_tool with title='Sales'"
                  expected="ChartSkeleton → ChartCard (from toolRenderers prop)"
                  color="purple"
                />
                <TestCaseCard
                  number={6}
                  title="Override Priority"
                  trigger="Call priority_tool"
                  expected="AppOverrideCard (toolRenderers wins over tool.render)"
                  color="orange"
                />
              </div>

              {/* Quick Test Prompts */}
              <div className="mt-6 p-4 bg-muted rounded-lg">
                <h3 className="font-medium mb-2">Quick Test Prompts:</h3>
                <ul className="text-sm space-y-1 text-muted-foreground">
                  <li>• "Run the basic tool"</li>
                  <li>• "Get weather for Tokyo"</li>
                  <li>• "Delete item 123"</li>
                  <li>• "Assign task 'Review PR'"</li>
                  <li>• "Generate a sales chart"</li>
                  <li>• "Run priority tool"</li>
                </ul>
              </div>
            </div>

            {/* Right: Chat */}
            <div className="h-[calc(100vh-180px)] border border-border rounded-lg overflow-hidden">
              <CopilotChat
                placeholder="Try: 'Get weather for Tokyo' or 'Assign task Review PR'"
                toolRenderers={toolRenderers}
              />
            </div>
          </div>
        </main>
      </div>
    </CopilotProvider>
  );
}

// Test case card component
function TestCaseCard({
  number,
  title,
  trigger,
  expected,
  color,
}: {
  number: number;
  title: string;
  trigger: string;
  expected: string;
  color: "gray" | "blue" | "red" | "yellow" | "purple" | "orange";
}) {
  const colors = {
    gray: "border-gray-300 bg-gray-50 dark:bg-gray-900/20",
    blue: "border-blue-300 bg-blue-50 dark:bg-blue-900/20",
    red: "border-red-300 bg-red-50 dark:bg-red-900/20",
    yellow: "border-yellow-300 bg-yellow-50 dark:bg-yellow-900/20",
    purple: "border-purple-300 bg-purple-50 dark:bg-purple-900/20",
    orange: "border-orange-300 bg-orange-50 dark:bg-orange-900/20",
  };

  return (
    <div className={`p-3 rounded-lg border ${colors[color]}`}>
      <div className="flex items-center gap-2 mb-1">
        <span className="w-6 h-6 rounded-full bg-foreground/10 flex items-center justify-center text-xs font-bold">
          {number}
        </span>
        <span className="font-medium">{title}</span>
      </div>
      <div className="text-xs text-muted-foreground ml-8">
        <div>
          <strong>Trigger:</strong> {trigger}
        </div>
        <div>
          <strong>Expected:</strong> {expected}
        </div>
      </div>
    </div>
  );
}
