"use client";

import { useRef } from "react";
import { useTheme } from "next-themes";
import { useTool, useTools } from "@yourgpt/copilot-sdk/react";
import { builtinTools } from "@yourgpt/copilot-sdk/core";
import {
  Plus,
  Minus,
  RotateCcw,
  Palette,
  ShoppingCart,
  Trash2,
  Activity,
  Check,
} from "lucide-react";
import type {
  DashboardState,
  ToolsEnabledConfig,
  GenerativeUIConfig,
} from "@/lib/types";
import type { DashboardActions } from "@/hooks/useDashboardState";
import { WeatherCard } from "./cards/WeatherCard";
import { StockCard } from "./cards/StockCard";
import { NotificationCard } from "./cards/NotificationCard";

interface DashboardToolsProps {
  dashboardState: DashboardState;
  actions: DashboardActions;
  toolsEnabled: ToolsEnabledConfig;
  generativeUI: GenerativeUIConfig;
}

// Helper hook to get latest ref values (avoids stale closures)
function useLatest<T>(value: T) {
  const ref = useRef(value);
  ref.current = value;
  return ref;
}

// ===========================================
// Individual Tool Components
// When these unmount, useTool cleanup runs
// and the tool is unregistered from the AI
// ===========================================

function CounterTool({
  dashboardState,
  actions,
}: {
  dashboardState: DashboardState;
  actions: DashboardActions;
}) {
  const dashboardStateRef = useLatest(dashboardState);
  const actionsRef = useLatest(actions);

  useTool({
    name: "updateCounter",
    description:
      "Update the dashboard counter. Use this to increment, decrement, or reset the counter value.",
    inputSchema: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["increment", "decrement", "reset"],
          description:
            "The action to perform: increment adds 1, decrement subtracts 1, reset sets to 0",
        },
      },
      required: ["action"],
    },
    handler: async ({
      action,
    }: {
      action: "increment" | "decrement" | "reset";
    }) => {
      const currentCount = dashboardStateRef.current.counter;
      const newValue =
        action === "increment"
          ? currentCount + 1
          : action === "decrement"
            ? currentCount - 1
            : 0;

      if (action === "increment") {
        actionsRef.current.incrementCounter();
      } else if (action === "decrement") {
        actionsRef.current.decrementCounter();
      } else {
        actionsRef.current.resetCounter();
      }

      return {
        success: true,
        action,
        newValue,
        message: `Counter ${action}ed successfully`,
      };
    },
    render: ({ status, args, result }) => {
      if (status === "completed" && result?.success) {
        const actionIcons = {
          increment: <Plus className="h-4 w-4" />,
          decrement: <Minus className="h-4 w-4" />,
          reset: <RotateCcw className="h-4 w-4" />,
        };
        return (
          <div className="p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                  {actionIcons[args.action as keyof typeof actionIcons] || (
                    <Activity className="h-4 w-4" />
                  )}
                </div>
                <div>
                  <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                    Counter Update
                  </p>
                  <p className="text-[10px] text-zinc-500">{args.action}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-indigo-600 dark:text-indigo-400">
                  {(result as { newValue?: number }).newValue}
                </p>
              </div>
            </div>
          </div>
        );
      }
      return null;
    },
  });

  return null; // This component only registers the tool
}

function PreferenceTool({ actions }: { actions: DashboardActions }) {
  const actionsRef = useLatest(actions);
  const { setTheme } = useTheme();
  const setThemeRef = useLatest(setTheme);

  useTool({
    name: "updatePreference",
    description:
      "Update the app theme/preference. Use 'dark' for dark mode, 'light' for light mode, or 'system' for system preference.",
    inputSchema: {
      type: "object",
      properties: {
        preference: {
          type: "string",
          enum: ["dark", "light", "system"],
          description: "The theme preference: dark, light, or system",
        },
      },
      required: ["preference"],
    },
    handler: async ({ preference }: { preference: string }) => {
      // Update dashboard state
      actionsRef.current.setPreference(preference);
      // Actually change the app theme
      setThemeRef.current(preference);
      return {
        success: true,
        preference,
        message: `Theme set to ${preference} mode`,
      };
    },
    render: ({ status, args, result }) => {
      if (status === "completed" && result?.success) {
        return (
          <div className="p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center text-violet-600 dark:text-violet-400">
                  <Palette className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                    Theme Changed
                  </p>
                  <p className="text-[10px] text-zinc-500">
                    Switched to {args.preference} mode
                  </p>
                </div>
              </div>
              <Check className="h-4 w-4 text-emerald-500" />
            </div>
          </div>
        );
      }
      return null;
    },
  });

  return null;
}

function NotificationTool({
  dashboardState,
  actions,
}: {
  dashboardState: DashboardState;
  actions: DashboardActions;
}) {
  const dashboardStateRef = useLatest(dashboardState);
  const actionsRef = useLatest(actions);

  useTool({
    name: "addNotification",
    description:
      "Add a notification message to the dashboard notification queue.",
    inputSchema: {
      type: "object",
      properties: {
        message: {
          type: "string",
          description: "The notification message to display",
        },
      },
      required: ["message"],
    },
    handler: async ({ message }: { message: string }) => {
      const queueSize = dashboardStateRef.current.notifications.length + 1;
      actionsRef.current.addNotification(message);
      return { success: true, notificationMessage: message, queueSize };
    },
    render: ({ status, args, result }) => {
      const isLoading = status === "pending" || status === "executing";
      const data =
        status === "completed" && result?.success
          ? (result as { notificationMessage?: string; queueSize?: number })
          : null;
      return (
        <NotificationCard
          message={data?.notificationMessage || args?.message}
          queueSize={data?.queueSize}
          isLoading={isLoading}
          error={status === "error"}
        />
      );
    },
  });

  return null;
}

function CartTool({
  dashboardState,
  actions,
}: {
  dashboardState: DashboardState;
  actions: DashboardActions;
}) {
  const dashboardStateRef = useLatest(dashboardState);
  const actionsRef = useLatest(actions);

  useTool({
    name: "updateCart",
    description:
      "Update shopping cart items. Can add items, remove items, or clear the entire cart.",
    inputSchema: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["add", "remove", "clear"],
          description:
            "The cart action: add increases count, remove decreases count, clear empties cart",
        },
        count: {
          type: "number",
          description:
            "Number of items to add or remove (defaults to 1 if not specified)",
        },
      },
      required: ["action"],
    },
    handler: async ({
      action,
      count,
    }: {
      action: "add" | "remove" | "clear";
      count?: number;
    }) => {
      const prevCount = dashboardStateRef.current.cartItems;
      const newCount =
        action === "add"
          ? prevCount + (count || 1)
          : action === "remove"
            ? Math.max(0, prevCount - (count || 1))
            : 0;
      actionsRef.current.updateCart(action, count || 1);
      return {
        success: true,
        action,
        count: count || 1,
        prevCount,
        newCount,
        message: `Cart updated: ${action} ${count || 1} item(s)`,
      };
    },
    render: ({ status, args, result }) => {
      if (status === "completed" && result?.success) {
        const actionConfig = {
          add: {
            icon: <Plus className="h-4 w-4" />,
            color: "emerald",
            label: "Add to Cart",
          },
          remove: {
            icon: <Minus className="h-4 w-4" />,
            color: "orange",
            label: "Remove from Cart",
          },
          clear: {
            icon: <Trash2 className="h-4 w-4" />,
            color: "rose",
            label: "Clear Cart",
          },
        };
        const config =
          actionConfig[args.action as keyof typeof actionConfig] ||
          actionConfig.add;
        const colorClasses = {
          emerald:
            "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30",
          orange:
            "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-500/30",
          rose: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-500/30",
        };

        return (
          <div
            className={`p-3 rounded-lg border ${colorClasses[config.color as keyof typeof colorClasses]}`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className={`w-8 h-8 rounded-lg bg-${config.color}-500/20 flex items-center justify-center`}
                >
                  {config.icon}
                </div>
                <div>
                  <p className="text-xs font-medium">{config.label}</p>
                  <p className="text-[10px] opacity-70">
                    {args.count || 1} item(s)
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <ShoppingCart className="h-4 w-4" />
                <span className="text-sm font-bold">
                  {(result as { newCount?: number }).newCount}
                </span>
              </div>
            </div>
          </div>
        );
      }
      return null;
    },
  });

  return null;
}

// ===========================================
// Hidden Tool Example
// ===========================================

/**
 * Example of a hidden tool that executes but doesn't show in the UI.
 * Useful for navigation, analytics, or background operations.
 */
function NavigationTool() {
  useTool({
    name: "navigate",
    description:
      "Navigate to a page section on the dashboard. Use this to help users find features.",
    hidden: true, // This tool won't show in the chat UI
    inputSchema: {
      type: "object",
      properties: {
        section: {
          type: "string",
          enum: ["counter", "cart", "settings", "tools"],
          description: "The dashboard section to navigate to",
        },
      },
      required: ["section"],
    },
    handler: async ({ section }: { section: string }) => {
      // In a real app, this would scroll to or highlight the section
      console.log(`[Hidden Tool] Navigating to: ${section}`);
      return {
        success: true,
        section,
        message: `Navigated to ${section} section`,
      };
    },
  });

  return null;
}

// ===========================================
// Built-in Tools Components
// ===========================================

function ScreenshotTool() {
  useTools({
    capture_screenshot: builtinTools.capture_screenshot,
  });
  return null;
}

function ConsoleLogsTool() {
  useTools({
    get_console_logs: builtinTools.get_console_logs,
  });
  return null;
}

// ===========================================
// Generative UI Tools
// ===========================================

function WeatherTool() {
  useTool({
    name: "getWeather",
    description:
      "Get current weather information for a location. Returns temperature, conditions, and forecast.",
    inputSchema: {
      type: "object",
      properties: {
        location: {
          type: "string",
          description:
            "City name or location (e.g., 'San Francisco', 'New York')",
        },
      },
      required: ["location"],
    },
    handler: async ({ location }: { location: string }) => {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const conditions = ["Sunny", "Partly Cloudy", "Cloudy", "Rainy", "Clear"];
      const temp = Math.floor(Math.random() * 30) + 50;
      const humidity = Math.floor(Math.random() * 40) + 40;
      return {
        success: true,
        data: {
          location,
          temperature: temp,
          unit: "°F",
          condition: conditions[Math.floor(Math.random() * conditions.length)],
          humidity,
        },
      };
    },
    render: ({ status, result, args }) => {
      const isLoading = status === "pending" || status === "executing";
      const data =
        status === "completed" && result?.success
          ? (result.data as {
              temperature?: number;
              condition?: string;
              humidity?: number;
            })
          : null;
      return (
        <WeatherCard
          location={args?.location}
          temperature={data?.temperature}
          condition={data?.condition}
          humidity={data?.humidity}
          isLoading={isLoading}
          error={status === "error"}
        />
      );
    },
  });

  return null;
}

function StockTool() {
  useTool({
    name: "getStockPrice",
    description: "Get current stock price and market data for a ticker symbol.",
    inputSchema: {
      type: "object",
      properties: {
        symbol: {
          type: "string",
          description: "Stock ticker symbol (e.g., 'AAPL', 'GOOGL', 'TSLA')",
        },
      },
      required: ["symbol"],
    },
    handler: async ({ symbol }: { symbol: string }) => {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const basePrice =
        symbol.toUpperCase() === "AAPL"
          ? 187
          : symbol.toUpperCase() === "GOOGL"
            ? 142
            : symbol.toUpperCase() === "TSLA"
              ? 248
              : Math.floor(Math.random() * 200) + 50;
      const change = (Math.random() * 6 - 3).toFixed(2);
      const changePercent = (Math.random() * 4 - 2).toFixed(2);
      return {
        success: true,
        data: {
          symbol: symbol.toUpperCase(),
          price: basePrice + Math.random() * 5,
          change: parseFloat(change),
          changePercent: parseFloat(changePercent),
          volume: Math.floor(Math.random() * 50000000) + 10000000,
          marketCap: `${(basePrice * 15).toFixed(0)}B`,
        },
      };
    },
    render: ({ status, args, result }) => {
      const isLoading = status === "pending" || status === "executing";
      const data =
        status === "completed" && result?.success
          ? (result.data as {
              price?: number;
              change?: number;
              changePercent?: number;
              volume?: number;
              marketCap?: string;
            })
          : null;
      return (
        <StockCard
          symbol={args?.symbol?.toUpperCase()}
          price={data?.price}
          change={data?.change}
          changePercent={data?.changePercent}
          volume={data?.volume}
          marketCap={data?.marketCap}
          isLoading={isLoading}
          error={status === "error"}
        />
      );
    },
  });

  return null;
}

// ===========================================
// Main Component - Conditionally renders tools
// ===========================================

export function DashboardTools({
  dashboardState,
  actions,
  toolsEnabled,
  generativeUI,
}: DashboardToolsProps) {
  return (
    <>
      {/* Conditionally render tools - when disabled, component unmounts and tool unregisters */}
      {toolsEnabled.updateCounter && (
        <CounterTool dashboardState={dashboardState} actions={actions} />
      )}
      {toolsEnabled.updatePreference && <PreferenceTool actions={actions} />}
      {toolsEnabled.updateCart && (
        <CartTool dashboardState={dashboardState} actions={actions} />
      )}

      {/* Hidden tool example - always enabled but invisible in UI */}
      <NavigationTool />

      {/* Built-in tools - screenshot and console logs */}
      {toolsEnabled.captureScreenshot && <ScreenshotTool />}
      {toolsEnabled.getConsoleLogs && <ConsoleLogsTool />}

      {/* Generative UI tools - conditionally rendered based on generativeUI config */}
      {generativeUI.weather && <WeatherTool />}
      {generativeUI.stock && <StockTool />}
      {generativeUI.notification && (
        <NotificationTool dashboardState={dashboardState} actions={actions} />
      )}
    </>
  );
}
