/**
 * Tool-related types for the agentic loop
 */

import type { ActionRenderProps } from "./actions";

// ============================================
// Provider Types
// ============================================

/**
 * Supported AI providers for tool calling
 */
export type AIProvider =
  | "anthropic"
  | "openai"
  | "xai"
  | "grok"
  | "gemini"
  | "groq"
  | "ollama";

/**
 * Where the tool executes
 */
export type ToolLocation = "server" | "client";

// ============================================
// Tool Definition Types
// ============================================

/**
 * JSON Schema property definition
 */
export interface JSONSchemaProperty {
  type:
    | "string"
    | "number"
    | "boolean"
    | "object"
    | "array"
    | "integer"
    | "null";
  description?: string;
  enum?: (string | number | boolean)[];
  items?: JSONSchemaProperty;
  properties?: Record<string, JSONSchemaProperty>;
  required?: string[];
  default?: unknown;
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  pattern?: string;
}

/**
 * JSON Schema for tool input
 */
export interface ToolInputSchema {
  type: "object";
  properties: Record<string, JSONSchemaProperty>;
  required?: string[];
  additionalProperties?: boolean;
}

/**
 * Tool execution context
 *
 * Provides runtime information to tool handlers including cancellation signals,
 * request metadata, and custom context data.
 */
export interface ToolContext {
  /** Abort signal for cancellation */
  signal?: AbortSignal;
  /** Thread ID if using threads */
  threadId?: string;
  /** Custom context data passed from runtime config */
  data?: Record<string, unknown>;

  // ============================================
  // Rich Context (Vercel AI SDK pattern)
  // ============================================

  /**
   * Unique ID for this specific tool call.
   * Useful for logging, tracing, and correlating tool executions.
   */
  toolCallId?: string;

  /**
   * Request headers (for auth in server tools).
   * Contains headers from the original HTTP request.
   *
   * @example
   * ```typescript
   * handler: async (params, context) => {
   *   const token = context?.headers?.authorization;
   *   if (!token) return failure('Authentication required');
   *   // ...
   * }
   * ```
   */
  headers?: Record<string, string>;

  /**
   * Full request metadata for server-side tools.
   * Provides access to HTTP method, URL, and headers.
   *
   * @example
   * ```typescript
   * handler: async (params, context) => {
   *   console.log(`Tool called from: ${context?.request?.url}`);
   *   // Forward auth to internal service
   *   const authHeader = context?.request?.headers?.authorization;
   * }
   * ```
   */
  request?: {
    /** HTTP method (GET, POST, etc.) */
    method?: string;
    /** Request URL path */
    url?: string;
    /** Request headers */
    headers?: Record<string, string>;
  };
}

// ============================================
// AI Response Control Types
// ============================================

/**
 * AI response behavior for tool results.
 *
 * Controls what the AI sees after a tool executes and renders UI.
 *
 * - `'none'`: AI generates minimal response, UI component handles display
 * - `'brief'`: AI gets summary context (via aiContext), gives brief acknowledgment
 * - `'full'`: AI receives full data and responds accordingly (default)
 */
export type AIResponseMode = "none" | "brief" | "full";

/**
 * Multimodal content for AI to analyze
 */
export type AIContent =
  | { type: "image"; data: string; mediaType: string }
  | { type: "text"; text: string };

/**
 * Tool response format
 */
export interface ToolResponse<T = unknown> {
  /** Whether the tool succeeded */
  success: boolean;
  /** Human-readable message */
  message?: string;
  /** Error message if failed */
  error?: string;
  /** Result data */
  data?: T;

  // ============================================
  // AI Response Control (result-level overrides)
  // ============================================

  /**
   * Override AI context for this specific result.
   * Takes precedence over tool-level aiContext config.
   * If set, this message is sent to AI instead of full result data.
   *
   * @example
   * ```typescript
   * return {
   *   success: true,
   *   data: sensitiveData,
   *   _aiContext: '[Data retrieved - contains sensitive info, displayed to user]'
   * };
   * ```
   */
  _aiContext?: string;

  /**
   * Override AI response mode for this specific result.
   * Takes precedence over tool-level aiResponseMode config.
   */
  _aiResponseMode?: AIResponseMode;

  /**
   * Content for AI to analyze (images, documents, etc.).
   * When present, these are included as multimodal content for AI analysis.
   *
   * @example
   * ```typescript
   * // Screenshot for AI to analyze
   * return {
   *   success: true,
   *   message: 'Screenshot captured',
   *   _aiContent: [{ type: 'image', data: base64, mediaType: 'image/png' }]
   * };
   * ```
   */
  _aiContent?: AIContent[];
}

/**
 * Props passed to tool render function
 */
export interface ToolRenderProps<TParams = Record<string, unknown>> {
  /** Current execution status */
  status: "pending" | "executing" | "completed" | "error";
  /** Arguments passed to the tool */
  args: TParams;
  /** Result if completed */
  result?: ToolResponse;
  /** Error if failed */
  error?: string;
}

/**
 * Tool definition with JSON Schema
 */
export interface ToolDefinition<TParams = Record<string, unknown>> {
  /** Unique tool name */
  name: string;
  /** Tool description for LLM */
  description: string;
  /** Where the tool executes (server or client) */
  location: ToolLocation;

  // ============================================
  // Display Configuration
  // ============================================

  /**
   * Human-readable title for UI display.
   * Can be a static string or a function that generates title from args.
   *
   * @example
   * ```typescript
   * title: "Get order details"
   * // or dynamic:
   * title: (args) => `Order #${args.orderId}`
   * ```
   */
  title?: string | ((args: TParams) => string);

  /**
   * Title shown while executing (present tense with "...").
   * If not provided, uses `title` with "..." appended.
   *
   * @example
   * ```typescript
   * executingTitle: (args) => `Fetching order #${args.orderId}...`
   * ```
   */
  executingTitle?: string | ((args: TParams) => string);

  /**
   * Title shown after completion.
   * If not provided, defaults to `title`.
   *
   * @example
   * ```typescript
   * completedTitle: (args) => `Retrieved order #${args.orderId}`
   * ```
   */
  completedTitle?: string | ((args: TParams) => string);
  /** JSON Schema for input parameters */
  inputSchema: ToolInputSchema;
  /** Handler function (optional for client tools registered on server) */
  handler?: (
    params: TParams,
    context?: ToolContext,
  ) => Promise<ToolResponse> | ToolResponse;
  /** Optional render function for UI */
  render?: (props: ToolRenderProps<TParams>) => unknown;
  /** Whether the tool is available (for conditional registration) */
  available?: boolean;

  /**
   * Require user approval before execution.
   * Can be:
   * - `true`: Always require approval
   * - `false` or `undefined`: No approval needed (default)
   * - `(params) => boolean`: Conditional approval based on input
   *
   * Similar to Vercel AI SDK v6's needsApproval pattern.
   */
  needsApproval?: boolean | ((params: TParams) => boolean | Promise<boolean>);

  /**
   * Custom message shown in the approval UI.
   * Can be a string or a function that generates a message from params.
   * If not provided, a default message with the tool name is shown.
   */
  approvalMessage?: string | ((params: TParams) => string);

  // ============================================
  // AI Response Control
  // ============================================

  /**
   * How the AI should respond when this tool's result is rendered as UI.
   *
   * - `'none'`: AI generates minimal response ("[Result displayed to user]").
   *   Use for tools where UI component fully handles the display (stats cards, etc.)
   *
   * - `'brief'`: AI receives summary context (from aiContext) and gives brief acknowledgment.
   *   Use for charts/visualizations where AI should acknowledge but not repeat data.
   *
   * - `'full'`: AI receives complete data and responds accordingly (default).
   *   Use for tools where AI should analyze and elaborate on results.
   *
   * @default 'full'
   *
   * @example
   * ```typescript
   * // Chart tool - AI acknowledges without repeating data
   * const chartTool: ToolDefinition = {
   *   name: 'get_chart',
   *   aiResponseMode: 'brief',
   *   aiContext: (result) => `[Chart displayed: ${result.data.title}]`,
   *   handler: async () => ({ success: true, data: chartData })
   * };
   * ```
   */
  aiResponseMode?: AIResponseMode;

  /**
   * Context/summary sent to AI instead of (or along with) full result.
   *
   * Used when:
   * - `aiResponseMode: 'brief'` - This becomes the only thing AI sees
   * - `aiResponseMode: 'full'` - This is prepended to full data for context
   *
   * Can be:
   * - `string`: Static message (e.g., "[Weather data displayed]")
   * - `function`: Dynamic based on result (e.g., (result) => `[Chart: ${result.data.title}]`)
   *
   * @example
   * ```typescript
   * // Static context
   * aiContext: '[Analytics chart displayed to user]'
   *
   * // Dynamic context based on result
   * aiContext: (result, args) => {
   *   const { title, currentValue } = result.data;
   *   return `[Chart displayed: ${title}, showing ${currentValue}]`;
   * }
   * ```
   */
  aiContext?:
    | string
    | ((result: ToolResponse, args: Record<string, unknown>) => string);
}

// ============================================
// Unified Tool Call Types (Provider-Agnostic)
// ============================================

/**
 * Unified tool call format (internal representation)
 */
export interface UnifiedToolCall {
  /** Unique tool call ID */
  id: string;
  /** Tool name */
  name: string;
  /** Tool input arguments */
  input: Record<string, unknown>;
}

/**
 * Unified tool result format
 */
export interface UnifiedToolResult {
  /** Tool call ID this result is for */
  toolCallId: string;
  /** Serialized result content (JSON string) */
  content: string;
  /** Whether the tool succeeded */
  success: boolean;
  /** Error message if failed */
  error?: string;
}

// ============================================
// Tool Execution Types
// ============================================

/**
 * Tool execution status
 */
export type ToolExecutionStatus =
  | "pending"
  | "executing"
  | "completed"
  | "error";

/**
 * Tool approval status (for human-in-the-loop)
 *
 * Similar to Vercel AI SDK v6's tool approval pattern.
 */
export type ToolApprovalStatus =
  | "none" // No approval needed (default)
  | "required" // Waiting for user decision
  | "approved" // User approved, execution can proceed
  | "rejected"; // User rejected, execution skipped

// ============================================
// Permission Persistence Types
// ============================================

/**
 * Permission level for tool execution
 *
 * Controls whether approval is needed and how the choice is remembered:
 * - "ask" - Always prompt user (default)
 * - "allow_always" - Auto-approve, persisted to storage
 * - "deny_always" - Auto-reject, persisted to storage
 * - "session" - Auto-approve for current session only
 */
export type PermissionLevel =
  | "ask"
  | "allow_always"
  | "deny_always"
  | "session";

/**
 * Stored tool permission record
 */
export interface ToolPermission {
  /** Tool name (unique identifier) */
  toolName: string;
  /** Permission level */
  level: PermissionLevel;
  /** When permission was set */
  createdAt: number;
  /** Last time this permission was used */
  lastUsedAt?: number;
}

/**
 * Permission storage configuration
 */
export interface PermissionStorageConfig {
  /**
   * Storage type:
   * - "localStorage" - Persists across browser sessions
   * - "sessionStorage" - Clears when tab closes
   * - "memory" - In-memory only (for SSR or testing)
   */
  type: "localStorage" | "sessionStorage" | "memory";
  /** Storage key prefix (default: "yourgpt-permissions") */
  keyPrefix?: string;
}

/**
 * Permission storage adapter interface (for custom implementations)
 */
export interface PermissionStorageAdapter {
  /** Get permission for a tool */
  get(toolName: string): Promise<ToolPermission | null>;
  /** Set permission for a tool */
  set(permission: ToolPermission): Promise<void>;
  /** Remove permission for a tool */
  remove(toolName: string): Promise<void>;
  /** Get all permissions */
  getAll(): Promise<ToolPermission[]>;
  /** Clear all permissions */
  clear(): Promise<void>;
}

/**
 * Tool execution record (for UI tracking)
 */
export interface ToolExecution {
  /** Tool call ID */
  id: string;
  /** Tool name */
  name: string;
  /** Tool arguments */
  args: Record<string, unknown>;
  /** Execution status */
  status: ToolExecutionStatus;
  /** Result if completed */
  result?: ToolResponse;
  /** Error message if failed */
  error?: string;
  /** Timestamp when execution started */
  timestamp: number;
  /** Duration in ms (set when completed) */
  duration?: number;

  // Approval fields (for needsApproval tools)

  /** Approval status for this execution */
  approvalStatus: ToolApprovalStatus;
  /** Message shown in approval UI (from tool's approvalMessage) */
  approvalMessage?: string;
  /** Timestamp when user responded to approval request */
  approvalTimestamp?: number;
}

// ============================================
// Agent Loop Types
// ============================================

/**
 * Agentic loop configuration
 */
export interface AgentLoopConfig {
  /** Maximum iterations before stopping (default: 20) */
  maxIterations?: number;
  /** Enable debug logging */
  debug?: boolean;
  /** Whether to enable the agentic loop (default: true) */
  enabled?: boolean;
}

/**
 * Agent loop state (for tracking)
 */
export interface AgentLoopState {
  /** Current iteration number */
  iteration: number;
  /** Maximum iterations allowed */
  maxIterations: number;
  /** Whether the loop is currently running */
  running: boolean;
  /** Whether max iterations was reached */
  maxIterationsReached: boolean;
  /** Whether the loop was aborted */
  aborted: boolean;
}

// ============================================
// ToolSet Type (Vercel AI SDK pattern)
// ============================================

/**
 * A set of tools, keyed by tool name
 *
 * @example
 * ```typescript
 * const myTools: ToolSet = {
 *   capture_screenshot: screenshotTool,
 *   get_weather: weatherTool,
 * };
 * ```
 */
export type ToolSet = Record<string, ToolDefinition>;

// ============================================
// Tool Helper Function (Vercel AI SDK pattern)
// ============================================

/**
 * Configuration for creating a tool
 */
export interface ToolConfig<TParams = Record<string, unknown>> {
  /** Tool description for LLM */
  description: string;
  /** Where the tool executes (default: 'client') */
  location?: ToolLocation;

  // Display Configuration
  /** Human-readable title for UI display */
  title?: string | ((args: TParams) => string);
  /** Title shown while executing */
  executingTitle?: string | ((args: TParams) => string);
  /** Title shown after completion */
  completedTitle?: string | ((args: TParams) => string);

  /** JSON Schema for input parameters */
  inputSchema?: ToolInputSchema;
  /** Handler function */
  handler?: (
    params: TParams,
    context?: ToolContext,
  ) => Promise<ToolResponse> | ToolResponse;
  /** Optional render function for UI */
  render?: (props: ToolRenderProps<TParams>) => unknown;
  /** Whether the tool is available */
  available?: boolean;
  /** Require user approval before execution */
  needsApproval?: boolean | ((params: TParams) => boolean | Promise<boolean>);
  /** Custom message shown in the approval UI */
  approvalMessage?: string | ((params: TParams) => string);
  /** AI response mode for this tool (default: 'full') */
  aiResponseMode?: AIResponseMode;
  /** Context/summary sent to AI instead of full result */
  aiContext?:
    | string
    | ((result: ToolResponse, args: Record<string, unknown>) => string);
}

/**
 * Create a tool definition (similar to Vercel AI SDK's tool())
 *
 * @example
 * ```typescript
 * const weatherTool = tool({
 *   description: 'Get weather for a location',
 *   inputSchema: {
 *     type: 'object',
 *     properties: {
 *       location: { type: 'string', description: 'City name' },
 *     },
 *     required: ['location'],
 *   },
 *   handler: async ({ location }) => {
 *     const weather = await fetchWeather(location);
 *     return success(weather);
 *   },
 * });
 * ```
 */
export function tool<TParams = Record<string, unknown>>(
  config: ToolConfig<TParams>,
): Omit<ToolDefinition<TParams>, "name"> {
  return {
    description: config.description,
    location: config.location ?? "client",
    // Display configuration
    title: config.title,
    executingTitle: config.executingTitle,
    completedTitle: config.completedTitle,
    // Schema and handlers
    inputSchema: config.inputSchema ?? {
      type: "object",
      properties: {},
      required: [],
    },
    handler: config.handler,
    render: config.render,
    available: config.available,
    needsApproval: config.needsApproval,
    approvalMessage: config.approvalMessage,
    aiResponseMode: config.aiResponseMode,
    aiContext: config.aiContext,
  };
}

// ============================================
// Helper Functions
// ============================================

/**
 * Convert ToolDefinition to OpenAI tool format
 */
export function toolToOpenAIFormat(tool: ToolDefinition): object {
  return {
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.inputSchema,
    },
  };
}

/**
 * Convert ToolDefinition to Anthropic tool format
 */
export function toolToAnthropicFormat(tool: ToolDefinition): object {
  return {
    name: tool.name,
    description: tool.description,
    input_schema: tool.inputSchema,
  };
}

/**
 * Create a tool result response
 */
export function createToolResult(
  toolCallId: string,
  response: ToolResponse,
): UnifiedToolResult {
  return {
    toolCallId,
    content: JSON.stringify(response),
    success: response.success,
    error: response.error,
  };
}

/**
 * Create a successful tool response
 */
export function success<T = unknown>(
  data?: T,
  message?: string,
): ToolResponse<T> {
  return {
    success: true,
    data,
    message,
  };
}

/**
 * Create a failed tool response
 */
export function failure(error: string): ToolResponse {
  return {
    success: false,
    error,
  };
}
