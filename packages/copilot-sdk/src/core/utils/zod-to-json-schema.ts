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
// Zod Type Detection (supports Zod 3.x and 4.x)
// ============================================

/**
 * Check if value is a Zod schema (works with Zod 3 and 4)
 */
function isZodSchema(value: unknown): boolean {
  if (value === null || typeof value !== "object") return false;
  const obj = value as Record<string, unknown>;

  // Zod 3.x: has _def with typeName
  // Zod 4.x: has _zod property or ~standard property
  return (
    ("_def" in obj && typeof obj._def === "object") ||
    ("_zod" in obj && typeof obj._zod === "object") ||
    "~standard" in obj
  );
}

/**
 * Get the Zod type name from a schema (supports Zod 3 and 4)
 */
function getZodTypeName(schema: unknown): string {
  if (!isZodSchema(schema)) return "unknown";
  const obj = schema as Record<string, unknown>;

  // Zod 4.x: Check _zod.def.type first
  if ("_zod" in obj) {
    const zod = obj._zod as Record<string, unknown>;
    if (zod.def && typeof zod.def === "object") {
      const def = zod.def as Record<string, unknown>;
      if (def.type) return `Zod${capitalize(def.type as string)}`;
    }
  }

  // Zod 4.x alternative: Check ~standard.type
  if ("~standard" in obj) {
    const standard = obj["~standard"] as Record<string, unknown>;
    if (standard.type === "object") return "ZodObject";
    if (standard.type === "string") return "ZodString";
    if (standard.type === "number") return "ZodNumber";
    if (standard.type === "boolean") return "ZodBoolean";
    if (standard.type === "array") return "ZodArray";
  }

  // Zod 3.x: Check _def.typeName
  const def = obj._def as Record<string, unknown>;
  if (def?.typeName) return def.typeName as string;

  return "unknown";
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Get description from Zod schema (supports Zod 3 and 4)
 */
function getZodDescription(schema: unknown): string | undefined {
  if (!isZodSchema(schema)) return undefined;
  const obj = schema as Record<string, unknown>;

  // Zod 4.x: Check _zod.def.description
  if ("_zod" in obj) {
    const zod = obj._zod as Record<string, unknown>;
    if (zod.def && typeof zod.def === "object") {
      const def = zod.def as Record<string, unknown>;
      if (def.description) return def.description as string;
    }
  }

  // Zod 3.x: Check _def.description
  const def = obj._def as Record<string, unknown>;
  return def?.description as string | undefined;
}

/**
 * Get the shape of a Zod object schema (supports Zod 3 and 4)
 */
function getZodObjectShape(schema: unknown): Record<string, unknown> | null {
  if (!isZodSchema(schema)) return null;
  const obj = schema as Record<string, unknown>;

  // Zod 4.x: Check shape property directly on schema
  if ("shape" in obj && typeof obj.shape === "object" && obj.shape !== null) {
    return obj.shape as Record<string, unknown>;
  }

  // Zod 4.x: Check _zod.def.shape
  if ("_zod" in obj) {
    const zod = obj._zod as Record<string, unknown>;
    if (zod.def && typeof zod.def === "object") {
      const def = zod.def as Record<string, unknown>;
      if (def.shape && typeof def.shape === "object") {
        return def.shape as Record<string, unknown>;
      }
    }
  }

  // Zod 3.x: Check _def.shape (function or object)
  const def = obj._def as Record<string, unknown>;
  if (def?.shape) {
    const shape = def.shape;
    if (typeof shape === "function") return shape() as Record<string, unknown>;
    if (typeof shape === "object") return shape as Record<string, unknown>;
  }

  return null;
}

/**
 * Get the inner type of a Zod wrapper (Optional, Nullable, Default, Array)
 */
function getZodInnerType(schema: unknown): unknown | null {
  if (!isZodSchema(schema)) return null;
  const obj = schema as Record<string, unknown>;

  // Zod 4.x: Check _zod.def.innerType or _zod.def.type (for array element type)
  if ("_zod" in obj) {
    const zod = obj._zod as Record<string, unknown>;
    if (zod.def && typeof zod.def === "object") {
      const def = zod.def as Record<string, unknown>;
      if (def.innerType) return def.innerType;
      if (def.element) return def.element; // Zod 4 array element
    }
  }

  // Zod 3.x: Check _def.innerType or _def.type
  const def = obj._def as Record<string, unknown>;
  if (def?.innerType) return def.innerType;
  if (def?.type) return def.type; // Zod 3 array element

  return null;
}

/**
 * Get enum values from a Zod enum schema (supports Zod 3 and 4)
 */
function getZodEnumValues(
  schema: unknown,
): (string | number | boolean)[] | null {
  if (!isZodSchema(schema)) return null;
  const obj = schema as Record<string, unknown>;

  // Zod 4.x: Check _zod.def.entries or _zod.def.values
  if ("_zod" in obj) {
    const zod = obj._zod as Record<string, unknown>;
    if (zod.def && typeof zod.def === "object") {
      const def = zod.def as Record<string, unknown>;
      if (def.entries && Array.isArray(def.entries)) {
        return def.entries as (string | number | boolean)[];
      }
      if (def.values && Array.isArray(def.values)) {
        return def.values as (string | number | boolean)[];
      }
    }
  }

  // Zod 3.x: Check _def.values
  const def = obj._def as Record<string, unknown>;
  if (def?.values && Array.isArray(def.values)) {
    return def.values as (string | number | boolean)[];
  }

  return null;
}

// ============================================
// Zod to JSON Schema Conversion
// ============================================

/**
 * Convert a Zod schema to JSON Schema property (supports Zod 3 and 4).
 * When used with z.object(), the result is compatible with ToolInputSchema.
 *
 * @example
 * ```ts
 * // For tool input schemas
 * useTool({
 *   inputSchema: zodToJsonSchema(z.object({
 *     name: z.string().describe("User name"),
 *   })),
 * });
 * ```
 */
export function zodToJsonSchema(schema: unknown): ToolInputSchema {
  const result = _zodToJsonSchemaInternal(schema);
  // If it's a oneOf/anyOf (discriminated union) without a type, wrap in type:object
  // so LLMs receive a valid top-level object schema instead of inventing a wrapper property
  if (!result.type && (result.oneOf || result.anyOf)) {
    return {
      type: "object",
      ...(result.oneOf ? { oneOf: result.oneOf } : { anyOf: result.anyOf }),
    } as unknown as ToolInputSchema;
  }
  return result as unknown as ToolInputSchema;
}

/**
 * Internal implementation for recursive schema conversion
 */
function _zodToJsonSchemaInternal(schema: unknown): JSONSchemaProperty {
  if (!isZodSchema(schema)) {
    return { type: "string" };
  }

  const typeName = getZodTypeName(schema);
  const description = getZodDescription(schema);

  switch (typeName) {
    case "ZodString": {
      const result: JSONSchemaProperty = { type: "string" };
      if (description) result.description = description;
      // Note: String constraints (min/max length, regex) could be extracted from checks
      // but basic string type is sufficient for most LLM tool use cases
      return result;
    }

    case "ZodNumber":
    case "ZodInt":
    case "ZodFloat": {
      const result: JSONSchemaProperty = {
        type: typeName === "ZodInt" ? "integer" : "number",
      };
      if (description) result.description = description;
      return result;
    }

    case "ZodBoolean": {
      const result: JSONSchemaProperty = { type: "boolean" };
      if (description) result.description = description;
      return result;
    }

    case "ZodEnum": {
      const values = getZodEnumValues(schema);
      if (values && values.length > 0) {
        const result: JSONSchemaProperty = {
          type: typeof values[0] === "number" ? "number" : "string",
          enum: values,
        };
        if (description) result.description = description;
        return result;
      }
      return { type: "string", description };
    }

    case "ZodArray": {
      const innerType = getZodInnerType(schema);
      const result: JSONSchemaProperty = {
        type: "array",
        items: innerType
          ? _zodToJsonSchemaInternal(innerType)
          : { type: "string" },
      };
      if (description) result.description = description;
      return result;
    }

    case "ZodObject": {
      const shapeObj = getZodObjectShape(schema);
      if (!shapeObj) {
        return { type: "object", properties: {}, description };
      }

      const properties: Record<string, JSONSchemaProperty> = {};
      const required: string[] = [];

      for (const [key, value] of Object.entries(shapeObj)) {
        properties[key] = _zodToJsonSchemaInternal(value);

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
      const innerType = getZodInnerType(schema);
      if (innerType) {
        return _zodToJsonSchemaInternal(innerType);
      }
      return { type: "string", description };
    }

    case "ZodDefault": {
      const innerType = getZodInnerType(schema);
      if (innerType) {
        const result = _zodToJsonSchemaInternal(innerType);
        // Note: Default value extraction is complex in Zod 4, skip for now
        return result;
      }
      return { type: "string", description };
    }

    case "ZodLiteral": {
      const obj = schema as Record<string, unknown>;
      // Try to get literal value from various locations
      let value: string | number | boolean | undefined;

      if ("_zod" in obj) {
        const zod = obj._zod as Record<string, unknown>;
        const def = zod.def as Record<string, unknown> | undefined;
        value = def?.value as string | number | boolean | undefined;
      }
      if (value === undefined) {
        const def = obj._def as Record<string, unknown>;
        value = def?.value as string | number | boolean | undefined;
      }

      if (value !== undefined) {
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
      return { type: "string", description };
    }

    case "ZodDiscriminatedUnion": {
      const obj = schema as Record<string, unknown>;
      let options: unknown[] | undefined;

      if ("_zod" in obj) {
        const zod = obj._zod as Record<string, unknown>;
        const def = zod.def as Record<string, unknown> | undefined;
        // Zod 4: options may be a Map or array
        const raw = def?.options;
        options =
          raw instanceof Map
            ? Array.from(raw.values())
            : (raw as unknown[] | undefined);
      }
      if (!options) {
        const def = obj._def as Record<string, unknown>;
        const raw = def?.options;
        options =
          raw instanceof Map
            ? Array.from(raw.values())
            : (raw as unknown[] | undefined);
      }

      if (options && options.length > 0) {
        const oneOf = options.map((opt) => _zodToJsonSchemaInternal(opt));
        const result: JSONSchemaProperty = { oneOf };
        if (description) result.description = description;
        return result;
      }
      return { type: "object", description };
    }

    case "ZodUnion": {
      // For unions, generate oneOf with all options
      const obj = schema as Record<string, unknown>;
      let options: unknown[] | undefined;

      if ("_zod" in obj) {
        const zod = obj._zod as Record<string, unknown>;
        const def = zod.def as Record<string, unknown> | undefined;
        options = def?.options as unknown[] | undefined;
      }
      if (!options) {
        const def = obj._def as Record<string, unknown>;
        options = def?.options as unknown[] | undefined;
      }

      if (options && options.length > 0) {
        const oneOf = options.map((opt) => _zodToJsonSchemaInternal(opt));
        const result: JSONSchemaProperty = { oneOf };
        if (description) result.description = description;
        return result;
      }
      return { type: "string", description };
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
  const jsonSchema = _zodToJsonSchemaInternal(schema);

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
  /** Optional render function for custom UI */
  render?: (props: {
    status:
      | "pending"
      | "approval-required"
      | "executing"
      | "completed"
      | "error";
    args: TSchema["_output"];
    result?: ToolResponse;
    error?: string;
    toolCallId: string;
    toolName: string;
    approval?: {
      onApprove: (extraData?: Record<string, unknown>) => void;
      onReject: (reason?: string) => void;
      message?: string;
    };
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
