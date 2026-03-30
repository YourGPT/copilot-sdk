"use client";

import { useState } from "react";
import { CopilotProvider, useTools, tool } from "@yourgpt/copilot-sdk/react";
import { CopilotChat } from "@yourgpt/copilot-sdk/ui";
import "@yourgpt/copilot-sdk/ui/styles.css";
import "@yourgpt/copilot-sdk/ui/themes/claude.css";

// ============================================
// CUSTOM TOOL RENDERERS
// ============================================

/**
 * Custom renderer for get_current_time tool (server-side)
 */
function TimeCard({
  execution,
}: {
  execution: { status: string; result?: unknown; error?: string };
}) {
  if (execution.status === "executing") {
    return (
      <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 animate-pulse">
        <span className="text-lg">🕐</span>
        <span className="text-sm text-muted-foreground">Getting time...</span>
      </div>
    );
  }

  if (execution.status === "error" || execution.status === "failed") {
    return (
      <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive">
        <span className="text-lg">❌</span>
        <span className="text-sm">
          {execution.error || "Failed to get time"}
        </span>
      </div>
    );
  }

  const result = execution.result as {
    time?: string;
    timezone?: string;
  } | null;

  if (!result?.time) {
    return null;
  }

  const date = new Date(result.time);
  const formattedTime = date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  const formattedDate = date.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="flex items-center gap-3 p-4 rounded-xl bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20">
      <div className="text-4xl">🕐</div>
      <div className="flex flex-col">
        <span className="text-2xl font-bold tracking-tight">
          {formattedTime}
        </span>
        <span className="text-sm text-muted-foreground">{formattedDate}</span>
        {result.timezone && (
          <span className="text-xs text-muted-foreground/70 mt-1">
            📍 {result.timezone}
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * Custom renderer for calculate_expression tool (frontend)
 */
function CalculatorCard({
  execution,
}: {
  execution: {
    status: string;
    result?: unknown;
    error?: string;
    args: Record<string, unknown>;
  };
}) {
  if (execution.status === "executing") {
    return (
      <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 animate-pulse">
        <span className="text-lg">🧮</span>
        <span className="text-sm text-muted-foreground">Calculating...</span>
      </div>
    );
  }

  if (execution.status === "error" || execution.status === "failed") {
    return (
      <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive">
        <span className="text-lg">❌</span>
        <span className="text-sm">
          {execution.error || "Calculation failed"}
        </span>
      </div>
    );
  }

  const result = execution.result as {
    expression?: string;
    result?: number;
  } | null;
  const expression =
    (execution.args?.expression as string) || result?.expression || "";

  return (
    <div className="flex items-center gap-3 p-4 rounded-xl bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/20">
      <div className="text-4xl">🧮</div>
      <div className="flex flex-col">
        <span className="text-sm text-muted-foreground font-mono">
          {expression}
        </span>
        <span className="text-3xl font-bold tracking-tight">
          {result?.result}
        </span>
      </div>
    </div>
  );
}

/**
 * Custom renderer for get_user_location tool (frontend)
 */
function LocationCard({
  execution,
}: {
  execution: { status: string; result?: unknown; error?: string };
}) {
  if (execution.status === "executing") {
    return (
      <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 animate-pulse">
        <span className="text-lg">📍</span>
        <span className="text-sm text-muted-foreground">
          Getting location...
        </span>
      </div>
    );
  }

  if (execution.status === "error" || execution.status === "failed") {
    return (
      <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive">
        <span className="text-lg">❌</span>
        <span className="text-sm">
          {execution.error || "Failed to get location"}
        </span>
      </div>
    );
  }

  const result = execution.result as {
    city?: string;
    country?: string;
    coordinates?: { lat: number; lng: number };
  } | null;

  if (!result) {
    return null;
  }

  return (
    <div className="flex items-center gap-3 p-4 rounded-xl bg-gradient-to-r from-orange-500/10 to-amber-500/10 border border-orange-500/20">
      <div className="text-4xl">📍</div>
      <div className="flex flex-col">
        <span className="text-xl font-bold">{result.city}</span>
        <span className="text-sm text-muted-foreground">{result.country}</span>
        {result.coordinates && (
          <span className="text-xs text-muted-foreground/70 mt-1 font-mono">
            {result.coordinates.lat.toFixed(4)},{" "}
            {result.coordinates.lng.toFixed(4)}
          </span>
        )}
      </div>
    </div>
  );
}

// ============================================
// FRONTEND TOOLS REGISTRATION
// ============================================

/**
 * Component that registers frontend tools
 */
function FrontendToolsRegistration() {
  useTools({
    calculate_expression: tool({
      description:
        "Calculate a mathematical expression. Use this when the user asks to compute math.",
      location: "client",
      inputSchema: {
        type: "object",
        properties: {
          expression: {
            type: "string",
            description:
              "The math expression to evaluate (e.g., '2 + 2', '10 * 5')",
          },
        },
        required: ["expression"],
      },
      handler: async (params) => {
        const { expression } = params as { expression: string };
        try {
          // Safe math evaluation using Function constructor (safer than eval)
          const sanitized = expression.replace(/[^0-9+\-*/().%\s]/g, "");
          // eslint-disable-next-line @typescript-eslint/no-implied-eval
          const result = new Function(`return ${sanitized}`)();
          return {
            success: true,
            expression,
            result: Number(result),
          };
        } catch (error) {
          return {
            success: false,
            error: `Invalid expression: ${error instanceof Error ? error.message : "Unknown error"}`,
          };
        }
      },
    }),
    get_user_location: tool({
      description:
        "Get the user's current location (simulated). Use this when user asks about their location.",
      location: "client",
      inputSchema: {
        type: "object",
        properties: {},
      },
      handler: async () => {
        // Simulate async location lookup
        await new Promise((resolve) => setTimeout(resolve, 500));

        // Simulated location data
        return {
          success: true,
          city: "San Francisco",
          country: "United States",
          coordinates: {
            lat: 37.7749,
            lng: -122.4194,
          },
        };
      },
    }),
  });

  return null;
}

// ============================================
// MAIN PAGE COMPONENT
// ============================================

/**
 * Test page for Express Demo with server-side + frontend tools
 *
 * Make sure express-demo is running on port 3001:
 *   cd examples/express-demo && pnpm dev
 *
 * Then run experimental:
 *   cd examples/experimental && pnpm dev
 *
 * Visit: http://localhost:3000/test-express-demo
 */
export default function TestExpressDemoPage() {
  const [isStreaming, setIsStreaming] = useState(true);

  const runtimeUrl = isStreaming
    ? "http://localhost:3001/api/copilot/stream"
    : "http://localhost:3001/api/copilot/chat";

  return (
    <div className="h-screen w-full flex flex-col">
      <header className="p-4 border-b bg-card">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold">
              Express Demo - Full Tools Test
            </h1>
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-purple-500">Server:</span>{" "}
              search_knowledge_base (hidden), get_current_time
              {" | "}
              <span className="font-medium text-green-500">Frontend:</span>{" "}
              calculate_expression, get_user_location
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-muted-foreground">Mode:</label>
            <button
              onClick={() => setIsStreaming(!isStreaming)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${isStreaming ? "bg-green-500/20 text-green-600 border border-green-500/30" : "bg-blue-500/20 text-blue-600 border border-blue-500/30"}`}
            >
              {isStreaming ? "🔴 Streaming" : "📦 Non-Streaming"}
            </button>
          </div>
        </div>
        <div className="mt-2 text-xs text-muted-foreground">
          <code>{runtimeUrl}</code>
        </div>
      </header>

      <div className="flex-1" key={isStreaming ? "stream" : "chat"}>
        <CopilotProvider
          runtimeUrl={runtimeUrl}
          streaming={isStreaming}
          systemPrompt={`You are a helpful assistant with access to multiple tools:

SERVER-SIDE TOOLS (executed on the server):
- search_knowledge_base: Search for information about YourGPT SDK
- get_current_time: Get the current server time

FRONTEND TOOLS (executed in the browser):
- calculate_expression: Evaluate math expressions
- get_user_location: Get the user's location

Use these tools when appropriate to help the user.`}
          debug={true}
          maxIterations={5}
        >
          <FrontendToolsRegistration />
          <CopilotChat
            showHeader
            showThreadPicker
            persistence
            className="h-full csdk-theme-claude"
            placeholder="Try: 'What is YourGPT SDK?', 'Calculate 25 * 4', 'What's my location?', 'What time is it?'"
            suggestions={[
              "What is YourGPT SDK?",
              "Calculate 25 * 4 + 10",
              "What's my location?",
              "What time is it?",
            ]}
            toolRenderers={{
              get_current_time: TimeCard,
              calculate_expression: CalculatorCard,
              get_user_location: LocationCard,
            }}
          />
        </CopilotProvider>
      </div>
    </div>
  );
}
