"use client";

import { useEffect, useMemo, useRef } from "react";
import * as z from "zod";
import type {
  ToolDefinition,
  ToolResponse,
  ToolContext,
  ToolRenderProps,
  ToolInputSchema,
} from "../../core";
import { zodObjectToInputSchema } from "../../core";
import { useCopilot } from "../provider/CopilotProvider";
import { stableSignature, withLatestFunctions } from "../utils/tool-signature";

/**
 * Zod schema type (minimal interface)
 */
interface ZodObjectSchema {
  _output: Record<string, unknown>;
  _def: {
    shape: () => Record<string, unknown>;
  };
}

/**
 * Convert Zod schema to JSON Schema using Zod's built-in toJSONSchema
 * Falls back to custom implementation for older Zod versions
 */
function convertZodSchema(schema: unknown, _toolName: string): ToolInputSchema {
  // Use Zod's built-in toJSONSchema (available in Zod 3.24+ and all Zod 4.x)
  try {
    const zodWithJsonSchema = z as typeof z & {
      toJSONSchema?: (schema: z.ZodType) => unknown;
    };
    if (typeof zodWithJsonSchema.toJSONSchema === "function") {
      const jsonSchema = zodWithJsonSchema.toJSONSchema(
        schema as z.ZodType,
      ) as {
        type?: string;
        properties?: ToolInputSchema["properties"];
        required?: string[];
      };
      if (jsonSchema.type === "object") {
        return {
          type: "object",
          properties: jsonSchema.properties || {},
          required: jsonSchema.required,
        };
      }
    }
  } catch {
    // toJSONSchema not available or failed, fall through
  }

  // Fall back to custom implementation for older Zod versions
  return zodObjectToInputSchema(schema);
}

// Zod schemas are immutable, so each schema object converts once. A schema
// written inline is a new object every render and converts every render.
const convertedSchemas = new WeakMap<object, ToolInputSchema>();

/** The JSON Schema for a tool's Zod schema, plus the error if conversion failed. */
function prepareSchema(
  schema: unknown,
  toolName: string,
): { inputSchema: ToolInputSchema; error?: unknown } {
  const key = typeof schema === "object" && schema !== null ? schema : null;
  const cached = key ? convertedSchemas.get(key) : undefined;
  if (cached) return { inputSchema: cached };
  try {
    const inputSchema = convertZodSchema(schema, toolName);
    if (key) convertedSchemas.set(key, inputSchema);
    return { inputSchema };
  } catch (error) {
    return { inputSchema: { type: "object", properties: {} }, error };
  }
}

/**
 * Configuration for registering a tool with Zod schema
 */
export interface UseToolWithSchemaConfig<TSchema extends ZodObjectSchema> {
  toModelOutput?: ToolDefinition["toModelOutput"];
  /** Unique tool name */
  name: string;
  /** Tool description for LLM */
  description: string;
  /** Zod schema for input parameters */
  schema: TSchema;
  /** Handler function */
  handler: (
    params: TSchema["_output"],
    context?: ToolContext,
  ) => Promise<ToolResponse> | ToolResponse;
  /** Optional render function for UI */
  render?: (props: ToolRenderProps<TSchema["_output"]>) => React.ReactNode;
  /** Whether the tool is available */
  available?: boolean;
}

/**
 * The definition registered for a config. The caller wraps its functions with
 * `withLatestFunctions` so they always call the latest config.
 */
function toToolDefinition<TSchema extends ZodObjectSchema>(
  config: UseToolWithSchemaConfig<TSchema>,
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
  };
}

/**
 * Register a client-side tool using a Zod schema
 *
 * This hook provides type-safe tool registration using Zod schemas.
 * The Zod schema is automatically converted to JSON Schema for the LLM.
 *
 * @example
 * ```tsx
 * import { z } from "zod";
 *
 * useToolWithSchema({
 *   name: "navigate_to_page",
 *   description: "Navigate to a specific page in the app",
 *   schema: z.object({
 *     path: z.string().describe("The path to navigate to"),
 *   }),
 *   handler: async ({ path }) => {
 *     // TypeScript knows `path` is a string!
 *     router.push(path);
 *     return { success: true, message: `Navigated to ${path}` };
 *   },
 * });
 * ```
 */
export function useToolWithSchema<TSchema extends ZodObjectSchema>(
  config: UseToolWithSchemaConfig<TSchema>,
  dependencies: unknown[] = [],
): void {
  const { registerTool, unregisterTool } = useCopilot();
  const configRef = useRef(config);

  // Update ref when config changes
  configRef.current = config;

  // Convert Zod schema to JSON Schema (memoized)
  const inputSchema = useMemo(() => {
    const prepared = prepareSchema(config.schema, config.name);
    if (prepared.error) {
      console.warn(
        `[useToolWithSchema] Failed to convert Zod schema for tool "${config.name}"`,
        prepared.error,
      );
    }
    return prepared.inputSchema;
  }, [config.schema, config.name]);

  // Re-register on content changes only: an inline z.object() is a new schema
  // every render, and re-registering each render loops (see useTool).
  const signature = stableSignature({
    ...config,
    schema: undefined,
    inputSchema,
  });

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
 * Register multiple client-side tools using Zod schemas
 *
 * @example
 * ```tsx
 * import { z } from "zod";
 *
 * useToolsWithSchema([
 *   {
 *     name: "navigate",
 *     description: "Navigate to page",
 *     schema: z.object({ path: z.string() }),
 *     handler: async ({ path }) => { ... },
 *   },
 *   {
 *     name: "open_modal",
 *     description: "Open a modal",
 *     schema: z.object({ modalId: z.string() }),
 *     handler: async ({ modalId }) => { ... },
 *   },
 * ]);
 * ```
 */
export function useToolsWithSchema<TSchema extends ZodObjectSchema>(
  tools: UseToolWithSchemaConfig<TSchema>[],
  dependencies: unknown[] = [],
): void {
  const { registerTool, unregisterTool } = useCopilot();
  const toolsRef = useRef(tools);

  // Update ref when tools change
  toolsRef.current = tools;

  // Convert once per render; the content key and the registration share it.
  const prepared = tools.map((config) => ({
    config,
    ...prepareSchema(config.schema, config.name),
  }));
  const signature = stableSignature(
    prepared.map(({ config, inputSchema }) => ({
      ...config,
      schema: undefined,
      inputSchema,
    })),
  );

  useEffect(() => {
    const toolNames: string[] = [];

    for (const { config, inputSchema, error } of prepared) {
      if (error) {
        console.warn(
          `[useToolsWithSchema] Failed to convert Zod schema for tool "${config.name}"`,
          error,
        );
      }
      // Function fields call the latest config under this name.
      const latest = () =>
        toolsRef.current.find((tool) => tool.name === config.name);
      registerTool(
        withLatestFunctions(toToolDefinition(config, inputSchema), latest),
      );
      toolNames.push(config.name);
    }

    return () => {
      for (const name of toolNames) {
        unregisterTool(name);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, ...dependencies]);
}
