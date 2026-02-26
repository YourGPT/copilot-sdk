"use client";

import { useState, useCallback } from "react";
import {
  CopilotProvider,
  useMCPTools,
  useMCPUIIntents,
} from "@yourgpt/copilot-sdk/react";
import { CopilotChat } from "@yourgpt/copilot-sdk/ui";
import "@yourgpt/copilot-sdk/ui/styles.css";

/**
 * MCP Demo with MCP-UI Support
 *
 * Demonstrates:
 * 1. Connecting to an MCP server
 * 2. Auto-registering MCP tools with the Copilot
 * 3. MCP-UI: Interactive components (products, polls, charts)
 * 4. Handling UI intents (add_to_cart, poll_vote, etc.)
 */

// Toast notification component
function Toast({
  message,
  level,
  onDismiss,
}: {
  message: string;
  level: string;
  onDismiss: () => void;
}) {
  const bgColor =
    {
      success: "bg-emerald-500",
      error: "bg-red-500",
      warning: "bg-amber-500",
      info: "bg-blue-500",
    }[level] || "bg-blue-500";

  return (
    <div
      className={`${bgColor} text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 animate-slide-in`}
    >
      <span className="text-sm font-medium">{message}</span>
      <button onClick={onDismiss} className="ml-2 hover:opacity-80">
        ×
      </button>
    </div>
  );
}

function MCPStatusPanel() {
  // Read from env or fallback to local
  const [mcpUrl, setMcpUrl] = useState(
    process.env.NEXT_PUBLIC_MCP_SERVER_URL || "/api/mcp",
  );
  const [notifications, setNotifications] = useState<
    Array<{ id: string; message: string; level: string }>
  >([]);
  const [events, setEvents] = useState<
    Array<{ time: string; action: string; data: string }>
  >([]);

  // Add notification
  const addNotification = useCallback(
    (message: string, level: string = "info") => {
      const id = Date.now().toString();
      setNotifications((prev) => [...prev, { id, message, level }]);
      setTimeout(() => {
        setNotifications((prev) => prev.filter((n) => n.id !== id));
      }, 3000);
    },
    [],
  );

  // Add event to log
  const addEvent = useCallback((action: string, data: unknown) => {
    setEvents((prev) => [
      {
        time: new Date().toLocaleTimeString(),
        action,
        data: JSON.stringify(data),
      },
      ...prev.slice(0, 9), // Keep last 10
    ]);
  }, []);

  // Handle MCP-UI intents
  const { handleIntent } = useMCPUIIntents({
    onIntent: useCallback(
      (action: string, data?: Record<string, unknown>) => {
        console.log("[MCP-UI] Intent:", action, data);
        addEvent(action, data);

        // Handle specific actions
        if (action === "add_to_cart") {
          addNotification(`Added ${data?.quantity}x item to cart!`, "success");
        } else if (action === "poll_vote") {
          addNotification(`Vote recorded: ${data?.selected}`, "success");
        } else if (action === "submit_feedback") {
          addNotification(
            `Feedback submitted: ${data?.rating}/5 stars`,
            "success",
          );
        }
      },
      [addEvent, addNotification],
    ),

    onNotify: useCallback(
      (message: string, level?: string) => {
        addNotification(message, level || "info");
      },
      [addNotification],
    ),

    onPrompt: useCallback(
      (text: string) => {
        console.log("[MCP-UI] Prompt:", text);
        addEvent("prompt", { text });
      },
      [addEvent],
    ),
  });

  // Connect to MCP server
  const {
    state,
    isConnected,
    isLoading,
    toolDefinitions,
    connect,
    disconnect,
  } = useMCPTools({
    name: "demo",
    transport: "http",
    url: mcpUrl,
    autoConnect: false,
    prefixToolNames: true,
    onError: (error) => {
      console.error("MCP Error:", error);
      addNotification(`MCP Error: ${error.message}`, "error");
    },
  });

  // Count UI tools
  const uiTools = toolDefinitions.filter((t) => t.name.includes("show_"));
  const basicTools = toolDefinitions.filter((t) => !t.name.includes("show_"));

  return (
    <div className="space-y-4">
      {/* Notifications */}
      {notifications.length > 0 && (
        <div className="fixed top-4 right-4 z-50 space-y-2">
          {notifications.map((n) => (
            <Toast
              key={n.id}
              message={n.message}
              level={n.level}
              onDismiss={() =>
                setNotifications((prev) => prev.filter((x) => x.id !== n.id))
              }
            />
          ))}
        </div>
      )}

      {/* Connection Panel */}
      <div className="p-4 bg-card rounded-lg border border-border space-y-4">
        <h2 className="text-lg font-semibold">MCP Connection</h2>

        <div className="space-y-2">
          <label className="text-sm text-muted-foreground">
            MCP Server URL
          </label>
          <input
            type="text"
            value={mcpUrl}
            onChange={(e) => setMcpUrl(e.target.value)}
            className="w-full px-3 py-2 rounded border border-border bg-background text-sm"
            placeholder="/api/mcp"
            disabled={isConnected}
          />
        </div>

        <div className="flex items-center gap-2">
          <div
            className={`w-3 h-3 rounded-full ${
              isConnected
                ? "bg-green-500"
                : isLoading
                  ? "bg-yellow-500 animate-pulse"
                  : "bg-gray-400"
            }`}
          />
          <span className="text-sm">
            {isConnected
              ? `Connected to ${state.serverInfo?.name || "MCP Server"}`
              : isLoading
                ? "Connecting..."
                : "Disconnected"}
          </span>
        </div>

        {state.error && (
          <div className="text-sm text-red-500 bg-red-50 dark:bg-red-950 p-2 rounded">
            {state.error}
          </div>
        )}

        <div className="flex gap-2">
          {!isConnected ? (
            <button
              onClick={() => connect()}
              disabled={isLoading}
              className="px-4 py-2 bg-primary text-primary-foreground rounded text-sm hover:opacity-90 disabled:opacity-50"
            >
              {isLoading ? "Connecting..." : "Connect"}
            </button>
          ) : (
            <button
              onClick={() => disconnect()}
              className="px-4 py-2 bg-secondary text-secondary-foreground rounded text-sm hover:opacity-90"
            >
              Disconnect
            </button>
          )}
        </div>
      </div>

      {/* Tools Panel */}
      {isConnected && toolDefinitions.length > 0 && (
        <div className="p-4 bg-card rounded-lg border border-border space-y-3">
          <h3 className="text-sm font-semibold">
            Available Tools ({toolDefinitions.length})
          </h3>

          {/* Basic Tools */}
          {basicTools.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-2">Basic Tools</p>
              <div className="space-y-1">
                {basicTools.map((tool) => (
                  <div
                    key={tool.name}
                    className="text-xs p-2 bg-secondary/50 rounded"
                  >
                    <span className="font-medium">{tool.name}</span>
                    <p className="text-muted-foreground mt-0.5 line-clamp-1">
                      {tool.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* UI Tools */}
          {uiTools.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                <span className="text-purple-500">✦</span> MCP-UI Tools
                (Interactive)
              </p>
              <div className="space-y-1">
                {uiTools.map((tool) => (
                  <div
                    key={tool.name}
                    className="text-xs p-2 bg-purple-500/10 border border-purple-500/20 rounded"
                  >
                    <span className="font-medium text-purple-700 dark:text-purple-300">
                      {tool.name}
                    </span>
                    <p className="text-muted-foreground mt-0.5 line-clamp-1">
                      {tool.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Event Log */}
      {events.length > 0 && (
        <div className="p-4 bg-card rounded-lg border border-border space-y-2">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-semibold">UI Events</h3>
            <button
              onClick={() => setEvents([])}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Clear
            </button>
          </div>
          <div className="space-y-1 max-h-40 overflow-auto">
            {events.map((e, i) => (
              <div
                key={i}
                className="text-xs p-2 bg-secondary/50 rounded font-mono"
              >
                <span className="text-muted-foreground">{e.time}</span>
                <span className="text-blue-500 ml-2">{e.action}</span>
                <span className="text-muted-foreground ml-2 truncate block">
                  {e.data}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MCP Response Debug Panel */}
      {isConnected && (
        <div className="p-4 bg-card rounded-lg border border-border space-y-3">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-semibold">MCP Server Response</h3>
            <span className="text-xs text-emerald-500">Connected</span>
          </div>

          {/* Server Info */}
          {state.serverInfo && (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground font-medium">
                Server Info:
              </p>
              <pre className="text-xs bg-secondary/50 p-2 rounded overflow-auto max-h-20">
                {JSON.stringify(state.serverInfo, null, 2)}
              </pre>
            </div>
          )}

          {/* Capabilities */}
          {state.capabilities && (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground font-medium">
                Capabilities:
              </p>
              <pre className="text-xs bg-secondary/50 p-2 rounded overflow-auto max-h-20">
                {JSON.stringify(state.capabilities, null, 2)}
              </pre>
            </div>
          )}

          {/* Tools with Full Schema */}
          {toolDefinitions.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground font-medium">
                Tools ({toolDefinitions.length}):
              </p>
              <div className="space-y-2 max-h-60 overflow-auto">
                {toolDefinitions.map((tool) => (
                  <details
                    key={tool.name}
                    className="text-xs bg-secondary/50 rounded"
                  >
                    <summary className="p-2 cursor-pointer hover:bg-secondary/80 font-medium">
                      {tool.name}
                    </summary>
                    <pre className="p-2 border-t border-border overflow-auto">
                      {JSON.stringify(
                        {
                          name: tool.name,
                          description: tool.description,
                          parameters: tool.parameters,
                        },
                        null,
                        2,
                      )}
                    </pre>
                  </details>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* How to Test */}
      <div className="p-4 bg-card rounded-lg border border-border">
        <h3 className="font-medium mb-3">Try These Prompts</h3>
        <div className="space-y-3 text-sm text-muted-foreground">
          <div>
            <p className="font-medium text-foreground mb-1">Basic Tools:</p>
            <ul className="list-disc ml-4 space-y-0.5">
              <li>"What time is it?"</li>
              <li>"Calculate 15 * 7 + 3"</li>
              <li>"Generate a random number between 1 and 100"</li>
            </ul>
          </div>
          <div>
            <p className="font-medium text-purple-600 dark:text-purple-400 mb-1">
              MCP-UI Tools:
            </p>
            <ul className="list-disc ml-4 space-y-0.5">
              <li>"Show me product prod-001"</li>
              <li>"Create a poll: Favorite color? Red, Blue, Green"</li>
              <li>"Show a feedback form for this chat"</li>
              <li>"Display a chart of sales: Q1 100, Q2 150, Q3 200"</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

function CopilotWithMCP() {
  return (
    <CopilotProvider
      runtimeUrl="/api/chat"
      systemPrompt="You are a helpful assistant with MCP tools. When users ask about products, polls, charts, or feedback forms, use the appropriate MCP-UI tools (show_product, show_poll, show_chart, show_feedback_form). Keep responses brief."
    >
      <div className="flex h-screen bg-background">
        {/* Left Panel - MCP Controls */}
        <div className="w-96 border-r border-border p-4 overflow-auto">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white text-sm font-bold">
              M
            </div>
            <div>
              <h1 className="text-lg font-bold">MCP Demo</h1>
              <p className="text-xs text-muted-foreground">
                with MCP-UI Support
              </p>
            </div>
          </div>
          <MCPStatusPanel />
        </div>

        {/* Right Panel - Chat */}
        <div className="flex-1 h-full">
          <CopilotChat />
        </div>
      </div>
    </CopilotProvider>
  );
}

export default function Page() {
  return <CopilotWithMCP />;
}
