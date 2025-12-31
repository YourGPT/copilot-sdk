/**
 * Zod to JSON Schema conversion utilities
 *
 * Provides helpers to convert Zod schemas to JSON Schema format
 * for use with LLM tool definitions.
 */

import type {
  JSONSchemaProperty,
  ToolInputSchema,
  ToolDefinition,
  ToolLocation,
  ToolContext,
  ToolResponse,
} from "../types/tools";

// ============================================
// Zod Type Detection
// ============================================

/**
 * Check if value is a Zod schema
 */
function isZodSchema(value: unknown): boolean {
  return (
    value !== null &&
    typeof value === "object" &&
    "_def" in value &&
    typeof (value as Record<string, unknown>)._def === "object"
  );
}

/**
 * Get the Zod type name from a schema
 */
function getZodTypeName(schema: unknown): string {
  if (!isZodSchema(schema)) return "unknown";
  const def = (schema as Record<string, unknown>)._def as Record<
    string,
    unknown
  >;
  return (def.typeName as string) || "unknown";
}

/**
 * Get description from Zod schema
 */
function getZodDescription(schema: unknown): string | undefined {
  if (!isZodSchema(schema)) return undefined;
  const def = (schema as Record<string, unknown>)._def as Record<
    string,
    unknown
  >;
  return def.description as string | undefined;
}

// ============================================
// Zod to JSON Schema Conversion
// ============================================

/**
 * Convert a Zod schema to JSON Schema property
 */
export function zodToJsonSchema(schema: unknown): JSONSchemaProperty {
  if (!isZodSchema(schema)) {
    return { type: "string" };
  }

  const typeName = getZodTypeName(schema);
  const description = getZodDescription(schema);
  const def = (schema as Record<string, unknown>)._def as Record<
    string,
    unknown
  >;

  switch (typeName) {
    case "ZodString": {
      const result: JSONSchemaProperty = { type: "string" };
      if (description) result.description = description;

      // Handle string constraints
      const checks = def.checks as
        | Array<{ kind: string; value?: unknown }>
        | undefined;
      if (checks) {
        for (const check of checks) {
          if (check.kind === "min") result.minLength = check.value as number;
          if (check.kind === "max") result.maxLength = check.value as number;
          if (check.kind === "regex") result.pattern = String(check.value);
        }
      }
      return result;
    }

    case "ZodNumber": {
      const result: JSONSchemaProperty = { type: "number" };
      if (description) result.description = description;

      const checks = def.checks as
        | Array<{ kind: string; value?: unknown }>
        | undefined;
      if (checks) {
        for (const check of checks) {
          if (check.kind === "min") result.minimum = check.value as number;
          if (check.kind === "max") result.maximum = check.value as number;
          if (check.kind === "int") result.type = "integer";
        }
      }
      return result;
    }

    case "ZodBoolean": {
      const result: JSONSchemaProperty = { type: "boolean" };
      if (description) result.description = description;
      return result;
    }

    case "ZodEnum": {
      const values = def.values as (string | number | boolean)[];
      const result: JSONSchemaProperty = {
        type: typeof values[0] === "number" ? "number" : "string",
        enum: values,
      };
      if (description) result.description = description;
      return result;
    }

    case "ZodArray": {
      const innerType = def.type as unknown;
      const result: JSONSchemaProperty = {
        type: "array",
        items: zodToJsonSchema(innerType),
      };
      if (description) result.description = description;
      return result;
    }

    case "ZodObject": {
      const shape = def.shape as
        | (() => Record<string, unknown>)
        | Record<string, unknown>;
      const shapeObj = typeof shape === "function" ? shape() : shape;
      const properties: Record<string, JSONSchemaProperty> = {};
      const required: string[] = [];

      for (const [key, value] of Object.entries(shapeObj)) {
        properties[key] = zodToJsonSchema(value);

        // Check if the field is required (not optional/nullable)
        const fieldTypeName = getZodTypeName(value);
        if (
          fieldTypeName !== "ZodOptional" &&
          fieldTypeName !== "ZodNullable"
        ) {
          required.push(key);
        }
      }

      const result: JSONSchemaProperty = {
        type: "object",
        properties,
      };
      if (required.length > 0) result.required = required;
      if (description) result.description = description;
      return result;
    }

    case "ZodOptional":
    case "ZodNullable": {
      const innerType = def.innerType as unknown;
      return zodToJsonSchema(innerType);
    }

    case "ZodDefault": {
      const innerType = def.innerType as unknown;
      const defaultValue = def.defaultValue as () => unknown;
      const result = zodToJsonSchema(innerType);
      result.default =
        typeof defaultValue === "function" ? defaultValue() : defaultValue;
      return result;
    }

    case "ZodLiteral": {
      const value = def.value as string | number | boolean;
      return {
        type:
          typeof value === "number"
            ? "number"
            : typeof value === "boolean"
              ? "boolean"
              : "string",
        enum: [value],
        description,
      };
    }

    case "ZodUnion": {
      // For unions, we take the first option for simplicity
      // A more complete implementation would use oneOf/anyOf
      const options = def.options as unknown[];
      if (options && options.length > 0) {
        return zodToJsonSchema(options[0]);
      }
      return { type: "string" };
    }

    default:
      // Fallback for unknown types
      const result: JSONSchemaProperty = { type: "string" };
      if (description) result.description = description;
      return result;
  }
}

/**
 * Convert a Zod object schema to ToolInputSchema
 *
 * Note: For Zod 4.x+, the react package uses z.toJSONSchema() directly.
 * This fallback implementation is for older Zod versions.
 */
export function zodObjectToInputSchema(schema: unknown): ToolInputSchema {
  const jsonSchema = zodToJsonSchema(schema);

  if (jsonSchema.type !== "object" || !jsonSchema.properties) {
    const typeName = getZodTypeName(schema);
    throw new Error(
      `Expected a Zod object schema, got ${typeName}. ` +
        `Converted to: ${JSON.stringify(jsonSchema)}`,
    );
  }

  return {
    type: "object",
    properties: jsonSchema.properties,
    required: jsonSchema.required,
  };
}

// ============================================
// Tool Definition Helper
// ============================================

/**
 * Configuration for defining a tool with Zod schema
 */
export interface DefineToolConfig<
  TSchema extends { _output: Record<string, unknown> },
> {
  /** Unique tool name */
  name: string;
  /** Tool description for LLM */
  description: string;
  /** Where the tool executes */
  location: ToolLocation;
  /** Zod schema for parameters */
  schema: TSchema;
  /** Handler function */
  handler?: (
    params: TSchema["_output"],
    context?: ToolContext,
  ) => Promise<ToolResponse> | ToolResponse;
  /** Optional render function */
  render?: (props: {
    status: "pending" | "executing" | "completed" | "error";
    args: TSchema["_output"];
    result?: ToolResponse;
    error?: string;
  }) => unknown;
  /** Whether the tool is available */
  available?: boolean;

  // ============================================
  // Display Configuration
  // ============================================

  /**
   * Human-readable title for UI display.
   * Can be a static string or a function that generates title from args.
   */
  title?: string | ((args: TSchema["_output"]) => string);

  /**
   * Title shown while executing (present tense with "...").
   */
  executingTitle?: string | ((args: TSchema["_output"]) => string);

  /**
   * Title shown after completion.
   */
  completedTitle?: string | ((args: TSchema["_output"]) => string);

  // ============================================
  // AI Response Control
  // ============================================

  /**
   * How the AI should respond when this tool's result is rendered as UI.
   * - 'none': AI generates minimal response
   * - 'brief': AI receives summary context, gives brief acknowledgment
   * - 'full': AI receives complete data (default)
   */
  aiResponseMode?: "none" | "brief" | "full";

  /**
   * Context/summary sent to AI instead of (or along with) full result.
   */
  aiContext?:
    | string
    | ((result: ToolResponse, args: Record<string, unknown>) => string);

  // ============================================
  // Approval Configuration
  // ============================================

  /**
   * Require user approval before execution.
   * - true: Always require approval
   * - false: No approval needed (default)
   * - function: Conditional approval based on input
   */
  needsApproval?:
    | boolean
    | ((params: TSchema["_output"]) => boolean | Promise<boolean>);

  /**
   * Custom message shown in the approval UI.
   */
  approvalMessage?: string | ((params: TSchema["_output"]) => string);
}

/**
 * Define a tool using a Zod schema
 *
 * @example
 * ```ts
 * import { z } from "zod";
 * import { defineTool } from "@yourgpt/copilot-sdk-core";
 *
 * const navigateTool = defineTool({
 *   name: "navigate",
 *   description: "Navigate to a page",
 *   location: "client",
 *   schema: z.object({
 *     path: z.string().describe("The path to navigate to"),
 *   }),
 *   handler: async ({ path }) => {
 *     router.push(path);
 *     return { success: true, message: `Navigated to ${path}` };
 *   },
 * });
 * ```
 */
export function defineTool<
  TSchema extends { _output: Record<string, unknown> },
>(config: DefineToolConfig<TSchema>): ToolDefinition<TSchema["_output"]> {
  return {
    name: config.name,
    description: config.description,
    location: config.location,
    inputSchema: zodObjectToInputSchema(config.schema),
    handler: config.handler,
    render: config.render,
    available: config.available,
    // Display config
    title: config.title,
    executingTitle: config.executingTitle,
    completedTitle: config.completedTitle,
    // AI response control
    aiResponseMode: config.aiResponseMode,
    aiContext: config.aiContext,
    // Approval
    needsApproval: config.needsApproval,
    approvalMessage: config.approvalMessage,
  };
}

/**
 * Define a client-side tool using a Zod schema
 *
 * Shorthand for defineTool with location: "client".
 * Client tools run in the browser and can interact with UI.
 *
 * @example
 * ```ts
 * const navigateTool = defineClientTool({
 *   name: "navigate",
 *   description: "Navigate to a page",
 *   schema: z.object({ path: z.string() }),
 *   handler: async ({ path }) => {
 *     router.push(path);
 *     return { success: true };
 *   },
 * });
 * ```
 */
export function defineClientTool<
  TSchema extends { _output: Record<string, unknown> },
>(
  config: Omit<DefineToolConfig<TSchema>, "location">,
): ToolDefinition<TSchema["_output"]> {
  return defineTool({ ...config, location: "client" });
}

/**
 * Define a server-side (backend) tool using a Zod schema
 *
 * Server tools run on your backend with full access to:
 * - Environment variables and secrets
 * - Database connections
 * - Internal microservices
 * - External APIs with server-side authentication
 *
 * The handler receives a context object with request headers for auth.
 *
 * @example
 * ```ts
 * const getOrderTool = defineServerTool({
 *   name: "get_order",
 *   description: "Get order details by ID",
 *   schema: z.object({
 *     orderId: z.string().describe("Order ID"),
 *   }),
 *   handler: async ({ orderId }, context) => {
 *     // Access auth from context
 *     const token = context?.headers?.authorization;
 *     if (!token) return failure("Authentication required");
 *
 *     const order = await orderService.get(orderId, token);
 *     return success(order);
 *   },
 * });
 * ```
 *
 * @example
 * ```ts
 * // With AI response control
 * const sensitiveDataTool = defineServerTool({
 *   name: "get_sensitive_data",
 *   description: "Fetch sensitive records",
 *   schema: z.object({ id: z.string() }),
 *   aiResponseMode: "brief",
 *   aiContext: (result) => `Retrieved record - displayed to user`,
 *   handler: async ({ id }) => {
 *     const data = await db.sensitiveRecords.findUnique({ where: { id } });
 *     return success(data);
 *   },
 * });
 * ```
 */
export function defineServerTool<
  TSchema extends { _output: Record<string, unknown> },
>(
  config: Omit<DefineToolConfig<TSchema>, "location">,
): ToolDefinition<TSchema["_output"]> {
  return defineTool({ ...config, location: "server" });
}
