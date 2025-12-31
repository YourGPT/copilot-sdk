"use client";

import { useEffect, useRef } from "react";
import type {
  ToolDefinition,
  ToolResponse,
  ToolContext,
  ToolRenderProps,
  ToolSet,
} from "@yourgpt/copilot-sdk-core";
import { useCopilot } from "../provider/CopilotProvider";

/**
 * Configuration for registering a tool (legacy format)
 */
export interface UseToolConfig<TParams = Record<string, unknown>> {
  /** Unique tool name */
  name: string;
  /** Tool description for LLM */
  description: string;
  /** JSON Schema for input parameters */
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
  /** Handler function */
  handler: (
    params: TParams,
    context?: ToolContext,
  ) => Promise<ToolResponse> | ToolResponse;
  /** Optional render function for UI */
  render?: (props: ToolRenderProps<TParams>) => React.ReactNode;
  /** Whether the tool is available */
  available?: boolean;
  /** Require user approval */
  needsApproval?: boolean;
  /** Custom approval message */
  approvalMessage?: string;
}

/**
 * Register a client-side tool
 *
 * This hook registers a tool that can be called by the AI during a conversation.
 * The tool will execute on the client side.
 *
 * @example
 * ```tsx
 * useTool({
 *   name: "navigate_to_page",
 *   description: "Navigate to a specific page in the app",
 *   inputSchema: {
 *     type: "object",
 *     properties: {
 *       path: { type: "string", description: "The path to navigate to" },
 *     },
 *     required: ["path"],
 *   },
 *   handler: async ({ path }) => {
 *     router.push(path);
 *     return { success: true, message: `Navigated to ${path}` };
 *   },
 * });
 * ```
 */
export function useTool<TParams = Record<string, unknown>>(
  config: UseToolConfig<TParams>,
  dependencies: unknown[] = [],
): void {
  const { registerTool, unregisterTool } = useCopilot();
  const configRef = useRef(config);

  // Update ref when config changes
  configRef.current = config;

  useEffect(() => {
    // Create tool definition
    const tool: ToolDefinition = {
      name: config.name,
      description: config.description,
      location: "client",
      inputSchema: config.inputSchema as ToolDefinition["inputSchema"],
      handler: async (params, context) => {
        return configRef.current.handler(params as TParams, context);
      },
      render: config.render as ToolDefinition["render"],
      available: config.available ?? true,
      needsApproval: config.needsApproval,
      approvalMessage: config.approvalMessage,
    };

    // Register tool
    registerTool(tool);

    // Cleanup on unmount
    return () => {
      unregisterTool(config.name);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.name, ...dependencies]);
}

/**
 * Register multiple tools using a ToolSet (Vercel AI SDK pattern)
 *
 * This is the recommended way to register tools as it follows
 * the Vercel AI SDK pattern with explicit tool definitions.
 *
 * @example
 * ```tsx
 * import { useTools } from '@yourgpt/copilot-sdk-react';
 * import { builtinTools, tool, success } from '@yourgpt/copilot-sdk-core';
 *
 * function MyApp() {
 *   // Register built-in tools
 *   useTools({
 *     capture_screenshot: builtinTools.capture_screenshot,
 *     get_console_logs: builtinTools.get_console_logs,
 *   });
 *
 *   // Or create custom tools
 *   useTools({
 *     get_weather: tool({
 *       description: 'Get weather for a location',
 *       inputSchema: {
 *         type: 'object',
 *         properties: {
 *           location: { type: 'string' },
 *         },
 *         required: ['location'],
 *       },
 *       handler: async ({ location }) => {
 *         const weather = await fetchWeather(location);
 *         return success(weather);
 *       },
 *     }),
 *   });
 *
 *   return <CopilotChat />;
 * }
 * ```
 */
export function useTools(tools: ToolSet): void {
  const { registerTool, unregisterTool } = useCopilot();

  // Track which tools we've registered to clean up properly
  const registeredToolsRef = useRef<string[]>([]);
  const toolsRef = useRef(tools);

  // Update ref when tools change
  toolsRef.current = tools;

  // Create a stable key from tool names to detect actual changes
  const toolsKey = Object.keys(tools).sort().join(",");

  useEffect(() => {
    const currentTools = toolsRef.current;
    const toolNames: string[] = [];

    // Register all tools from the toolset
    for (const [name, toolDef] of Object.entries(currentTools)) {
      // Create full tool definition with name (override if toolDef has different name)
      const fullTool: ToolDefinition = {
        ...toolDef,
        name, // Use the key as the name
      };

      registerTool(fullTool);
      toolNames.push(name);
    }

    registeredToolsRef.current = toolNames;

    // Cleanup: unregister tools when unmounting or when tools change
    return () => {
      for (const name of registeredToolsRef.current) {
        unregisterTool(name);
      }
      registeredToolsRef.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toolsKey]); // Only re-run when tool names change, not on every render
}

/**
 * Register multiple client-side tools (legacy array format)
 *
 * @deprecated Use useTools with ToolSet (object) format instead
 *
 * @example
 * ```tsx
 * useToolsArray([
 *   { name: "navigate", ... },
 *   { name: "open_modal", ... },
 * ]);
 * ```
 */
export function useToolsArray<TParams = Record<string, unknown>>(
  tools: UseToolConfig<TParams>[],
  dependencies: unknown[] = [],
): void {
  const { registerTool, unregisterTool } = useCopilot();
  const toolsRef = useRef(tools);

  // Update ref when tools change
  toolsRef.current = tools;

  useEffect(() => {
    // Register all tools
    const toolNames: string[] = [];

    for (const config of tools) {
      const tool: ToolDefinition = {
        name: config.name,
        description: config.description,
        location: "client",
        inputSchema: config.inputSchema as ToolDefinition["inputSchema"],
        handler: async (params, context) => {
          const currentConfig = toolsRef.current.find(
            (t) => t.name === config.name,
          );
          if (currentConfig) {
            return currentConfig.handler(params as TParams, context);
          }
          return { success: false, error: "Tool handler not found" };
        },
        available: config.available ?? true,
        needsApproval: config.needsApproval,
        approvalMessage: config.approvalMessage,
      };

      registerTool(tool);
      toolNames.push(config.name);
    }

    // Cleanup on unmount
    return () => {
      for (const name of toolNames) {
        unregisterTool(name);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tools.map((t) => t.name).join(","), ...dependencies]);
}

export type { ToolDefinition, ToolResponse, ToolContext, ToolSet };
