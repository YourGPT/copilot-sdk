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
import { stableSignature, withLatestFunctions } from "../utils/tool-signature";

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

// Zod schemas are immutable, so each schema object converts once. A schema
// written inline is a new object every render and converts every render.
const convertedSchemas = new WeakMap<object, ToolInputSchema>();

/** JSON Schema for a config's `inputSchema`, converting a Zod schema once per object. */
function toInputSchema(inputSchema: unknown): ToolInputSchema {
  if (!isZodSchema(inputSchema)) return inputSchema as ToolInputSchema;
  const schema = inputSchema as object;
  let converted = convertedSchemas.get(schema);
  if (!converted) {
    converted = zodToJsonSchema(schema);
    convertedSchemas.set(schema, converted);
  }
  return converted;
}

/**
 * Configuration for registering a tool
 */
export interface UseToolConfig<TParams = Record<string, unknown>> {
  toModelOutput?: ToolDefinition["toModelOutput"];
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
 * The definition registered for a config. Every field the config accepts is
 * forwarded; the caller wraps the functions with `withLatestFunctions` so they
 * always call the latest config.
 */
function toToolDefinition<TParams>(
  config: UseToolConfig<TParams>,
  inputSchema: ToolInputSchema,
): ToolDefinition {
  return {
    name: config.name,
    description: config.description,
    location: "client",
    inputSchema,
    handler: config.handler as ToolDefinition["handler"],
    toModelOutput: config.toModelOutput,
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
  const inputSchema = useMemo(
    () => toInputSchema(config.inputSchema),
    [config.inputSchema],
  );

  // Re-register when the tool's content changes, not its identity: a config or
  // schema written inline is a new object every render, and re-registering on
  // each render updates provider state, which renders again (an infinite loop).
  const signature = stableSignature({ ...config, inputSchema });

  useEffect(() => {
    const current = configRef.current;
    // Function fields call the latest config, so new closures need no re-registration.
    const tool = withLatestFunctions(
      toToolDefinition(current, inputSchema),
      () => configRef.current,
    );

    registerTool(tool);

    return () => {
      unregisterTool(current.name);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, ...dependencies]);
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

  // Key on content (names, schemas, flags), not identity: a toolset written
  // inline is new every render. Functions count only by presence; the latest
  // ones are reached through toolsRef below.
  const toolsKey = stableSignature(tools);

  useEffect(() => {
    const currentTools = toolsRef.current;
    const toolNames: string[] = [];

    // Register all tools from the toolset
    for (const [name, toolDef] of Object.entries(currentTools)) {
      // The key is the name, overriding one on the definition. Function fields
      // call the latest definition under that key.
      const fullTool: ToolDefinition = {
        ...withLatestFunctions(toolDef, () => toolsRef.current[name]),
        name,
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
  }, [toolsKey]); // Re-register only when a tool's content changes.
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

  // Convert once per render; the content key and the registration share it.
  const definitions = tools.map((config) =>
    toToolDefinition(config, toInputSchema(config.inputSchema)),
  );
  const signature = stableSignature(definitions);

  useEffect(() => {
    const toolNames = definitions.map((definition) => definition.name);

    for (const definition of definitions) {
      // Function fields call the latest config under this name.
      const latest = () =>
        toolsRef.current.find((tool) => tool.name === definition.name);
      registerTool(withLatestFunctions(definition, latest));
    }

    return () => {
      for (const name of toolNames) {
        unregisterTool(name);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, ...dependencies]);
}

export type { ToolDefinition, ToolResponse, ToolContext, ToolSet };
