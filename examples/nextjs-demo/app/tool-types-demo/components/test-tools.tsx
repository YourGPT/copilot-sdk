"use client";

import { useTools } from "@yourgpt/copilot-sdk/react";
import { tool, success } from "@yourgpt/copilot-sdk/core";
import {
  WeatherSkeleton,
  WeatherCard,
  SelectionSkeleton,
  SelectionCard,
  CompletedCard,
  ChartSkeleton,
  ToolRenderCard,
  ErrorCard,
} from "./test-cards";

/**
 * Test tools demonstrating all 6 tool type combinations
 */
export function TestTools() {
  useTools({
    // ============================================
    // TYPE 1: Basic Tool (no render, no approval)
    // Expected: Default ToolSteps UI
    // ============================================
    basic_tool: tool({
      description:
        "Simple tool with default UI - triggers default ToolSteps display",
      location: "client",
      inputSchema: {
        type: "object",
        properties: {
          message: { type: "string", description: "A message to process" },
        },
      },
      handler: async (params) => {
        await new Promise((r) => setTimeout(r, 1500));
        return success({
          processed: true,
          message: params.message || "Hello!",
          timestamp: new Date().toISOString(),
        });
      },
    }),

    // ============================================
    // TYPE 2: Tool with Built-in Render (no approval)
    // Expected: Custom skeleton → Custom card
    // ============================================
    weather_tool: tool({
      description: "Get weather with custom render - shows WeatherCard",
      location: "client",
      inputSchema: {
        type: "object",
        properties: {
          city: { type: "string", description: "City name" },
        },
        required: ["city"],
      },
      render: ({ status, args, result }) => {
        // Loading states
        if (status === "pending" || status === "executing") {
          return <WeatherSkeleton />;
        }
        // Completed
        if (status === "completed" && result?.data) {
          const data = result.data as {
            city: string;
            temp: string;
            condition: string;
          };
          return (
            <WeatherCard
              city={data.city}
              temp={data.temp}
              condition={data.condition}
            />
          );
        }
        // Error
        if (status === "error") {
          return <ErrorCard message="Failed to fetch weather" />;
        }
        return null;
      },
      handler: async (params) => {
        await new Promise((r) => setTimeout(r, 2000));
        return success({
          city: params.city as string,
          temp: "24°C",
          condition: "Partly Cloudy",
        });
      },
    }),

    // ============================================
    // TYPE 3: Default Approval (no custom render)
    // Expected: Default PermissionConfirmation modal
    // ============================================
    delete_tool: tool({
      description: "Delete item - shows default PermissionConfirmation",
      location: "client",
      needsApproval: true,
      approvalMessage:
        "Are you sure you want to delete this item? This action cannot be undone.",
      inputSchema: {
        type: "object",
        properties: {
          itemId: { type: "string", description: "Item ID to delete" },
        },
        required: ["itemId"],
      },
      handler: async (params) => {
        await new Promise((r) => setTimeout(r, 1000));
        return success({
          deleted: true,
          itemId: params.itemId,
          deletedAt: new Date().toISOString(),
        });
      },
    }),

    // ============================================
    // TYPE 4: Approval + Custom Render (interactive)
    // Expected: Custom selection UI → passes data to handler
    // ============================================
    assign_tool: tool({
      description:
        "Assign task with custom approval UI - user selects assignee",
      location: "client",
      needsApproval: true,
      inputSchema: {
        type: "object",
        properties: {
          taskName: { type: "string", description: "Task to assign" },
        },
        required: ["taskName"],
      },
      render: ({ status, args, approval, result }) => {
        // Waiting for user selection
        if (status === "approval-required" && approval) {
          const options = [
            { id: "1", name: "Alice Johnson", description: "Senior Developer" },
            { id: "2", name: "Bob Smith", description: "Project Manager" },
            { id: "3", name: "Carol White", description: "Designer" },
          ];
          return (
            <SelectionCard
              title={`Assign: ${args.taskName}`}
              options={options}
              onSelect={(assignee) => approval.onApprove({ assignee })}
              onCancel={() => approval.onReject("User cancelled")}
            />
          );
        }
        // Loading
        if (status === "pending" || status === "executing") {
          return <SelectionSkeleton />;
        }
        // Completed
        if (status === "completed" && result?.data) {
          const data = result.data as {
            taskName: string;
            assignee: { name: string };
          };
          return (
            <CompletedCard
              title="Task Assigned"
              message={`"${data.taskName}" assigned to ${data.assignee.name}`}
              data={data}
            />
          );
        }
        // Error
        if (status === "error") {
          return <ErrorCard message="Assignment failed" />;
        }
        return null;
      },
      handler: async (params, context) => {
        await new Promise((r) => setTimeout(r, 1000));
        // Get user's selection from approvalData
        const assignee = context?.approvalData?.assignee as
          | { id: string; name: string }
          | undefined;
        return success({
          taskName: params.taskName,
          assignee: assignee || { id: "unknown", name: "Unknown" },
          assignedAt: new Date().toISOString(),
        });
      },
    }),

    // ============================================
    // TYPE 5: For toolRenderers test (no render in tool)
    // Expected: App-level ChartCard from toolRenderers
    // ============================================
    chart_tool: tool({
      description: "Generate chart - uses app-level toolRenderers",
      location: "client",
      inputSchema: {
        type: "object",
        properties: {
          title: { type: "string", description: "Chart title" },
        },
      },
      // NO render function - will use toolRenderers from CopilotChat
      handler: async (params) => {
        await new Promise((r) => setTimeout(r, 1500));
        return success({
          title: params.title || "Sales Data",
          data: [65, 45, 78, 52, 89, 43, 67],
        });
      },
    }),

    // ============================================
    // TYPE 6: Override Priority Test
    // Expected: toolRenderers wins over tool.render
    // ============================================
    priority_tool: tool({
      description: "Test priority - toolRenderers should override this render",
      location: "client",
      inputSchema: {
        type: "object",
        properties: {},
      },
      // This render should NOT be used because toolRenderers overrides it
      render: ({ status }) => {
        if (status === "pending" || status === "executing") {
          return (
            <div className="p-4 bg-gray-100 rounded">
              Tool render loading...
            </div>
          );
        }
        return <ToolRenderCard />;
      },
      handler: async () => {
        await new Promise((r) => setTimeout(r, 1000));
        return success({ source: "handler" });
      },
    }),
  } as any);

  return null;
}
