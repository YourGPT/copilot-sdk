"use client";

import { useEffect, useRef, useMemo } from "react";
import type {
  ToolDefinition,
  ToolResponse,
  ToolContext,
  ToolRenderProps,
  ToolSet,
  ToolInputSchema,
  AIResponseMode,
  ToolResultConfig,
} from "../../core";
import { zodToJsonSchema } from "../../core";
import { useCopilot } from "../provider/CopilotProvider";

/**
 * Check if value is a Zod schema
 */
function isZodSchema(value: unknown): boolean {
  if (value === null || typeof value !== "object") return false;
  const obj = value as Record<string, unknown>;
  return (
    ("_def" in obj && typeof obj._def === "object") ||
    ("_zod" in obj && typeof obj._zod === "object") ||
    "~standard" in obj
  );
}

/**
 * Configuration for registering a tool
 */
export interface UseToolConfig<TParams = Record<string, unknown>> {
  /** Unique tool name */
  name: string;
  /** Tool description for LLM */
  description: string;
  /**
   * Input schema - accepts either:
   * - Zod schema: z.object({ name: z.string() })
   * - JSON Schema: { type: "object", properties: { name: { type: "string" } } }
   *
   * Zod schemas are automatically converted to JSON Schema at runtime.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  inputSchema: any;
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
  /** Custom approval title shown in the approval UI */
  approvalTitle?: string | ((params: TParams) => string);
  /** Custom approval message (can be string or function that receives params) */
  approvalMessage?: string | ((params: TParams) => string);
  /**
   * Hide this tool from the chat UI.
   * Tool will still execute, but won't show in tool execution display.
   * @default false
   */
  hidden?: boolean;
  /** Deferred tools stay out of the default request payload; discovered only when query matches */
  deferLoading?: boolean;
  /** Profile memberships for selective tool loading */
  profiles?: string[];
  /** Extra keywords for dynamic tool-selection scoring */
  searchKeywords?: string[];
  /** Optional group for profile-based selection */
  group?: string;
  /** Optional category for search, filtering, and budgets */
  category?: string;
  /** Per-tool prompt/result shaping controls */
  resultConfig?: ToolResultConfig;
  /** Human-readable title for UI display */
  title?: string | ((args: TParams) => string);
  /** Title shown while executing */
  executingTitle?: string | ((args: TParams) => string);
  /** Title shown after completion */
  completedTitle?: string | ((args: TParams) => string);
  /** How the AI should respond when this tool's result is rendered as UI */
  aiResponseMode?: AIResponseMode;
  /** Context/summary sent to AI instead of full result */
  aiContext?:
    | string
    | ((result: ToolResponse, args: Record<string, unknown>) => string);
}

/**
 * Register a client-side tool
 *
 * This hook registers a tool that can be called by the AI during a conversation.
 * The tool will execute on the client side.
 *
 * Supports both Zod schemas and JSON schemas for inputSchema.
 *
 * @example
 * ```tsx
 * // Using Zod schema (recommended)
 * import { z } from "zod";
 *
 * useTool({
 *   name: "navigate_to_page",
 *   description: "Navigate to a specific page in the app",
 *   inputSchema: z.object({
 *     path: z.string().describe("The path to navigate to"),
 *   }),
 *   handler: async ({ path }) => {
 *     router.push(path);
 *     return { success: true, message: `Navigated to ${path}` };
 *   },
 * });
 *
 * // Using JSON Schema
 * useTool({
 *   name: "open_modal",
 *   description: "Open a modal dialog",
 *   inputSchema: {
 *     type: "object",
 *     properties: {
 *       modalId: { type: "string" },
 *     },
 *     required: ["modalId"],
 *   },
 *   handler: async ({ modalId }) => { ... },
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

  // Convert Zod schema to JSON Schema if needed (memoized)
  const inputSchema = useMemo(() => {
    if (isZodSchema(config.inputSchema)) {
      return zodToJsonSchema(config.inputSchema);
    }
    return config.inputSchema as ToolInputSchema;
  }, [config.inputSchema]);

  useEffect(() => {
    // Create tool definition
    const tool: ToolDefinition = {
      name: config.name,
      description: config.description,
      location: "client",
      inputSchema,
      handler: async (params, context) => {
        return configRef.current.handler(params as TParams, context);
      },
      render: config.render as ToolDefinition["render"],
      available: config.available ?? true,
      needsApproval: config.needsApproval,
      approvalTitle: config.approvalTitle as ToolDefinition["approvalTitle"],
      approvalMessage:
        config.approvalMessage as ToolDefinition["approvalMessage"],
      hidden: config.hidden,
      deferLoading: config.deferLoading,
      profiles: config.profiles,
      searchKeywords: config.searchKeywords,
      group: config.group,
      category: config.category,
      resultConfig: config.resultConfig,
      title: config.title as ToolDefinition["title"],
      executingTitle: config.executingTitle as ToolDefinition["executingTitle"],
      completedTitle: config.completedTitle as ToolDefinition["completedTitle"],
      aiResponseMode: config.aiResponseMode,
      aiContext: config.aiContext as ToolDefinition["aiContext"],
    };

    // Register tool
    registerTool(tool);

    // Cleanup on unmount
    return () => {
      unregisterTool(config.name);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.name, inputSchema, ...dependencies]);
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
 * import { builtinTools, tool, success } from '../core';
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

  // Create a stable key from tool names + availability flags to detect actual changes
  const toolsKey = Object.entries(tools)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, def]) => `${name}:${def.available ?? true}`)
    .join(",");

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
  }, [toolsKey]); // Re-run when tool names or availability flags change
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
      // Convert Zod schema if needed
      const inputSchema = isZodSchema(config.inputSchema)
        ? zodToJsonSchema(config.inputSchema)
        : (config.inputSchema as ToolInputSchema);

      const tool: ToolDefinition = {
        name: config.name,
        description: config.description,
        location: "client",
        inputSchema,
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
        approvalTitle: config.approvalTitle as ToolDefinition["approvalTitle"],
        approvalMessage:
          config.approvalMessage as ToolDefinition["approvalMessage"],
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
