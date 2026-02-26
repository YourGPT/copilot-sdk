/**
 * Built-in Tools
 *
 * Pre-configured tools for common client-side operations.
 * These can be registered using the useTools() hook.
 *
 * @example
 * ```tsx
 * import { builtinTools } from '@yourgpt/copilot-sdk-core';
 *
 * // Register all built-in tools
 * useTools(builtinTools);
 *
 * // Or register specific tools
 * useTools({
 *   capture_screenshot: builtinTools.capture_screenshot,
 * });
 * ```
 */

import type { ToolDefinition } from "../../types/tools";

// Import tools for builtinTools object
import { screenshotTool, createScreenshotTool } from "./screenshot";
import { consoleLogsTool, createConsoleLogsTool } from "./console";
import { networkRequestsTool, createNetworkRequestsTool } from "./network";
import { webSearchTool, createWebSearchTool } from "./webSearch";

// Re-export individual tools
export {
  screenshotTool,
  createScreenshotTool,
  consoleLogsTool,
  createConsoleLogsTool,
  networkRequestsTool,
  createNetworkRequestsTool,
  // Web Search
  webSearchTool,
  createWebSearchTool,
};

/**
 * All built-in tools as a ToolSet
 *
 * @example
 * ```tsx
 * import { builtinTools } from '@yourgpt/copilot-sdk-core';
 *
 * // Use with useTools hook
 * useTools(builtinTools);
 *
 * // Or spread with custom tools
 * useTools({
 *   ...builtinTools,
 *   my_custom_tool: myTool,
 * });
 * ```
 */
export const builtinTools: Record<string, ToolDefinition> = {
  capture_screenshot: {
    name: "capture_screenshot",
    ...screenshotTool,
  } as ToolDefinition,
  get_console_logs: {
    name: "get_console_logs",
    ...consoleLogsTool,
  } as ToolDefinition,
  get_network_requests: {
    name: "get_network_requests",
    ...networkRequestsTool,
  } as ToolDefinition,
  web_search: {
    name: "web_search",
    ...webSearchTool,
  } as ToolDefinition,
};
