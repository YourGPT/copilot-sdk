"use client";

import { useEffect, useMemo, useRef } from "react";
import * as z from "zod";
import type {
  ToolDefinition,
  ToolResponse,
  ToolContext,
  ToolRenderProps,
  ToolInputSchema,
} from "@yourgpt/copilot-sdk-core";
import { zodObjectToInputSchema } from "@yourgpt/copilot-sdk-core";
import { useCopilotContext } from "../context/CopilotContext";

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
    if (typeof z.toJSONSchema === "function") {
      const jsonSchema = z.toJSONSchema(schema as z.ZodType) as {
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

/**
 * Configuration for registering a tool with Zod schema
 */
export interface UseToolWithSchemaConfig<TSchema extends ZodObjectSchema> {
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
  const { registerTool, unregisterTool } = useCopilotContext();
  const configRef = useRef(config);

  // Update ref when config changes
  configRef.current = config;

  // Convert Zod schema to JSON Schema (memoized)
  const inputSchema = useMemo(() => {
    try {
      return convertZodSchema(config.schema, config.name);
    } catch (error) {
      // Fallback to empty schema if conversion fails
      console.warn(
        `[useToolWithSchema] Failed to convert Zod schema for tool "${config.name}"`,
        error,
      );
      return {
        type: "object" as const,
        properties: {},
      };
    }
  }, [config.schema, config.name]);

  useEffect(() => {
    // Create tool definition
    const tool: ToolDefinition<TSchema["_output"]> = {
      name: config.name,
      description: config.description,
      location: "client",
      inputSchema,
      handler: async (params, context) => {
        return configRef.current.handler(params as TSchema["_output"], context);
      },
      render: config.render,
      available: config.available ?? true,
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
  const { registerTool, unregisterTool } = useCopilotContext();
  const toolsRef = useRef(tools);

  // Update ref when tools change
  toolsRef.current = tools;

  useEffect(() => {
    // Register all tools
    const toolNames: string[] = [];

    for (const config of tools) {
      let inputSchema: ToolDefinition["inputSchema"];

      try {
        inputSchema = convertZodSchema(config.schema, config.name);
      } catch (error) {
        console.warn(
          `[useToolsWithSchema] Failed to convert Zod schema for tool "${config.name}"`,
          error,
        );
        inputSchema = { type: "object", properties: {} };
      }

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
            return currentConfig.handler(params as TSchema["_output"], context);
          }
          return { success: false, error: "Tool handler not found" };
        },
        available: config.available ?? true,
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
