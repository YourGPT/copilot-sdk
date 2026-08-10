import type {
  Message,
  MessageAttachment,
  ActionDefinition,
  StreamEvent,
  LLMConfig,
  ResponseFormat,
  ToolDefinition,
  WebSearchConfig,
  ProviderToolRuntimeOptions,
} from "../core/stream-events";
import type { TokenUsage } from "../core/types";

/**
 * Request-level LLM configuration overrides
 */
export interface RequestLLMConfig {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  responseFormat?: ResponseFormat;
}

/**
 * Chat completion request
 */
export interface ChatCompletionRequest {
  /** Conversation messages */
  messages: Message[];
  /**
   * Raw provider-formatted messages (for agent loop with tool calls)
   * When provided, these are used instead of converting from Message[]
   * This allows passing messages with tool_calls and tool role
   */
  rawMessages?: Array<Record<string, unknown>>;
  /** Available actions/tools */
  actions?: ActionDefinition[];
  /** Full tool definitions for provider-native tool search / deferred loading paths. */
  toolDefinitions?: ToolDefinition[];
  /** System prompt */
  systemPrompt?: string;
  /** LLM configuration overrides */
  config?: RequestLLMConfig;
  /** Abort signal for cancellation */
  signal?: AbortSignal;
  /**
   * Enable native web search for the provider.
   * When true or configured, the provider's native search is enabled.
   */
  webSearch?: boolean | WebSearchConfig;
  /** Optional provider-specific tool policy hints derived from runtime selection. */
  providerToolOptions?: ProviderToolRuntimeOptions;
  /** Enable adapter-level provider payload logging. */
  debug?: boolean;
}

/**
 * Non-streaming completion result
 */
export interface CompletionResult {
  /** Text content */
  content: string;
  /** Tool calls */
  toolCalls: Array<{
    id: string;
    name: string;
    args: Record<string, unknown>;
    /** Provider-specific metadata (e.g. Gemini 3 thought_signature in extra_content.google) */
    extra_content?: Record<string, unknown>;
  }>;
  /** Thinking content (if extended thinking enabled) */
  thinking?: string;
  /** Token usage for billing/tracking */
  usage?: TokenUsage;
  /** Raw provider response for debugging */
  rawResponse: Record<string, unknown>;
}

/**
 * MCP server configuration for the Responses API
 */
export interface McpServerConfig {
  type: "mcp";
  server_label: string;
  server_url: string;
  headers?: Record<string, string>;
  allowed_tools?: string[];
  require_approval?: "never" | "always";
}

/**
 * Request for the Responses API (OpenAI Responses / Anthropic Messages with MCP)
 */
export interface ResponseRequest {
  /** Prompt text */
  prompt: string;
  /** MCP server(s) to attach */
  mcpServers?: McpServerConfig[];
  /** Reasoning effort: low | medium | high */
  reasoningEffort?: "low" | "medium" | "high";
  /** Zod/JSON schema for structured output */
  outputSchema?: {
    name: string;
    schema: Record<string, unknown>;
  };
  /** Max tokens for the response */
  maxTokens?: number;
}

/**
 * Normalized result from the Responses API
 */
export interface ResponseResult {
  /** Generated text */
  text: string;
  /** Token usage */
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * Base LLM adapter interface
 */
export interface LLMAdapter {
  /** Provider name */
  readonly provider: string;

  /** Model name */
  readonly model: string;

  /**
   * Stream a chat completion
   */
  stream(request: ChatCompletionRequest): AsyncGenerator<StreamEvent>;

  /**
   * Non-streaming chat completion (for debugging/comparison)
   */
  complete?(request: ChatCompletionRequest): Promise<CompletionResult>;

  /**
   * Responses API — MCP tools + reasoning + structured output.
   * OpenAI: uses /v1/responses. Anthropic: uses /v1/messages with beta headers.
   */
  respond?(request: ResponseRequest): Promise<ResponseResult>;
}

/**
 * Adapter factory function type
 */
export type AdapterFactory = (config: LLMConfig) => LLMAdapter;

function stringifyForDebug(value: unknown): string {
  return JSON.stringify(
    value,
    (_key, currentValue) => {
      if (typeof currentValue === "bigint") {
        return currentValue.toString();
      }
      if (currentValue instanceof Error) {
        return {
          name: currentValue.name,
          message: currentValue.message,
          stack: currentValue.stack,
        };
      }
      return currentValue;
    },
    2,
  );
}

export function logProviderPayload(
  provider: string,
  label: string,
  payload: unknown,
  enabled?: boolean,
): void {
  if (!enabled) {
    return;
  }

  // Stream chunks/events are too noisy for regular debug output and can flood
  // terminal context. Keep request/response payload logging, but suppress the
  // per-event stream logs unless we add a separate verbose flag later.
  if (label.toLowerCase().includes("stream ")) {
    return;
  }

  try {
    console.log(
      `[llm-sdk:${provider}] ${label}\n${stringifyForDebug(payload)}`,
    );
  } catch (error) {
    console.log(
      `[llm-sdk:${provider}] ${label} (failed to stringify payload)`,
      error,
    );
  }
}

/**
 * Convert messages to provider format (simple text only)
 */
export function formatMessages(
  messages: Message[],
  systemPrompt?: string,
): Array<{ role: string; content: string }> {
  const formatted: Array<{ role: string; content: string }> = [];

  // Add system prompt if provided
  if (systemPrompt) {
    formatted.push({ role: "system", content: systemPrompt });
  }

  // Add conversation messages
  for (const msg of messages) {
    formatted.push({
      role: msg.role,
      content: msg.content ?? "",
    });
  }

  return formatted;
}

/**
 * Convert ActionParameter to JSON Schema format recursively
 */
export function parameterToJsonSchema(param: {
  type: string;
  description?: string;
  enum?: string[];
  items?: unknown;
  properties?: Record<string, unknown>;
}): Record<string, unknown> {
  const schema: Record<string, unknown> = {
    type: param.type,
  };

  if (param.description) {
    schema.description = param.description;
  }

  if (param.enum) {
    schema.enum = param.enum;
  }

  // Handle array items
  if (param.type === "array" && param.items) {
    schema.items = parameterToJsonSchema(
      param.items as {
        type: string;
        description?: string;
        enum?: string[];
        items?: unknown;
        properties?: Record<string, unknown>;
      },
    );
  }

  // Handle nested object properties
  if (param.type === "object" && param.properties) {
    schema.properties = Object.fromEntries(
      Object.entries(param.properties).map(([key, prop]) => [
        key,
        parameterToJsonSchema(
          prop as {
            type: string;
            description?: string;
            enum?: string[];
            items?: unknown;
            properties?: Record<string, unknown>;
          },
        ),
      ]),
    );
    schema.additionalProperties = false;
  }

  return schema;
}

export function normalizeObjectJsonSchema(
  schema: Record<string, unknown> | undefined,
): Record<string, unknown> {
  if (!schema || typeof schema !== "object") {
    return {
      type: "object",
      properties: {},
      required: [],
      additionalProperties: false,
    };
  }

  const normalized: Record<string, unknown> = { ...schema };
  const type = normalized.type;

  if (type === "object") {
    const properties =
      normalized.properties &&
      typeof normalized.properties === "object" &&
      !Array.isArray(normalized.properties)
        ? (normalized.properties as Record<string, unknown>)
        : {};

    normalized.properties = Object.fromEntries(
      Object.entries(properties).map(([key, value]) => [
        key,
        normalizeObjectJsonSchema(value as Record<string, unknown>),
      ]),
    );

    const propertyKeys = Object.keys(properties);
    const required = Array.isArray(normalized.required)
      ? normalized.required.filter(
          (value): value is string => typeof value === "string",
        )
      : [];
    normalized.required = Array.from(new Set([...required, ...propertyKeys]));

    // Strict mode requires this to be exactly `false` on EVERY object, nested
    // ones included. An explicit `additionalProperties: true` — what
    // zodToJsonSchema emits for a free-form `z.record()`/`.passthrough()` field
    // (e.g. Cal.com create_booking's `metadata`) — is rejected outright:
    //   "In context=('properties','metadata'), 'additionalProperties' is
    //    required to be supplied and to be false."
    // So overwrite unconditionally rather than only filling in the undefined
    // case; a truthy value is precisely the one that 400s.
    //
    // The cost is that genuinely open-ended objects can no longer accept
    // arbitrary keys. With `properties: {}` that yields an object the model may
    // only send empty — lossy, but strict mode has no way to express "any keys",
    // and a degraded field beats a request the API refuses to accept at all.
    normalized.additionalProperties = false;
  } else if (
    type === "array" &&
    normalized.items &&
    typeof normalized.items === "object"
  ) {
    normalized.items = normalizeObjectJsonSchema(
      normalized.items as Record<string, unknown>,
    );
  }

  // Composition keywords carry subschemas that are just as subject to the rules
  // above, and they appear WITHOUT a sibling `type` (so neither branch above
  // runs). An un-normalized object nested inside a union 400s exactly like a
  // top-level one, so recurse regardless of `type`.
  for (const keyword of ["anyOf", "oneOf", "allOf"]) {
    const branches = normalized[keyword];
    if (!Array.isArray(branches)) continue;
    normalized[keyword] = branches.map((branch) =>
      branch && typeof branch === "object"
        ? normalizeObjectJsonSchema(branch as Record<string, unknown>)
        : branch,
    );
  }

  return normalized;
}

/**
 * Newer OpenAI model families (o1/o3/o4 reasoning, gpt-5.x) require
 * `max_completion_tokens` instead of `max_tokens` and reject `temperature`
 * on the Chat Completions endpoint.
 */
export function isOpenAIReasoningModel(modelId: string | undefined): boolean {
  if (!modelId) return false;
  return /^(o1|o3|o4|gpt-5)/i.test(modelId);
}

/**
 * Build the token-limit + temperature fields for a Chat Completions payload,
 * accounting for the o-series / gpt-5 parameter rename.
 */
export function buildOpenAITokenParams(
  modelId: string | undefined,
  maxTokens: number | undefined,
  temperature: number | undefined,
): Record<string, number | undefined> {
  if (isOpenAIReasoningModel(modelId)) {
    return { max_completion_tokens: maxTokens };
  }
  return { max_tokens: maxTokens, temperature };
}

/**
 * Recursively walk a JSON Schema and drop keys the provider rejects.
 */
function stripSchemaKeys(
  schema: unknown,
  keysToDrop: ReadonlySet<string>,
  options: {
    forceAdditionalPropertiesFalse?: boolean;
    renameKeys?: Record<string, string>;
  } = {},
): unknown {
  if (Array.isArray(schema)) {
    return schema.map((item) => stripSchemaKeys(item, keysToDrop, options));
  }
  if (!schema || typeof schema !== "object") return schema;

  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(
    schema as Record<string, unknown>,
  )) {
    if (keysToDrop.has(key)) continue;
    const renamed = options.renameKeys?.[key] ?? key;
    out[renamed] = stripSchemaKeys(value, keysToDrop, options);
  }

  if (options.forceAdditionalPropertiesFalse && out.type === "object") {
    out.additionalProperties = false;
  }
  return out;
}

/** OpenAI Chat Completions `response_format` payload. */
export function toOpenAIResponseFormat(
  rf: ResponseFormat | undefined,
): Record<string, unknown> | undefined {
  if (!rf) return undefined;
  if (rf.type === "json_object") return { type: "json_object" };
  // Defensive: only proceed with json_schema if the field is actually present.
  // JS callers can pass arbitrary `type` values (e.g. "text") that TS would reject —
  // dereferencing rf.json_schema.name would otherwise throw "Cannot read properties of undefined (reading 'name')".
  if (rf.type !== "json_schema" || !rf.json_schema) return undefined;
  return {
    type: "json_schema",
    json_schema: {
      name: rf.json_schema.name,
      schema: normalizeObjectJsonSchema(rf.json_schema.schema),
      strict: rf.json_schema.strict ?? true,
    },
  };
}

/** OpenAI Responses API `text.format` payload (different shape than Chat Completions). */
export function toOpenAIResponsesTextFormat(
  rf: ResponseFormat | undefined,
): Record<string, unknown> | undefined {
  if (!rf || rf.type !== "json_schema") return undefined;
  return {
    type: "json_schema",
    name: rf.json_schema.name,
    schema: normalizeObjectJsonSchema(rf.json_schema.schema),
    strict: rf.json_schema.strict ?? true,
  };
}

/**
 * Anthropic `output_config.format` payload.
 *
 * Anthropic's structured-output schema subset is narrower than OpenAI's:
 * no numeric (minimum/maximum/multipleOf) or length (minLength/maxLength)
 * constraints, and `additionalProperties: false` is required on every object.
 */
const ANTHROPIC_UNSUPPORTED_KEYS: ReadonlySet<string> = new Set([
  "minimum",
  "maximum",
  "exclusiveMinimum",
  "exclusiveMaximum",
  "multipleOf",
  "minLength",
  "maxLength",
  "minItems",
  "maxItems",
  "minProperties",
  "maxProperties",
  "pattern",
  "$schema",
]);

export function toAnthropicOutputConfig(
  rf: ResponseFormat | undefined,
): Record<string, unknown> | undefined {
  if (!rf || rf.type !== "json_schema") return undefined;
  // Anthropic accepts `anyOf` but rejects `oneOf` — convert rather than strip,
  // otherwise discriminated-union schemas silently lose their union semantics.
  const schema = stripSchemaKeys(
    rf.json_schema.schema,
    ANTHROPIC_UNSUPPORTED_KEYS,
    {
      forceAdditionalPropertiesFalse: true,
      renameKeys: { oneOf: "anyOf" },
    },
  ) as Record<string, unknown>;
  return {
    format: {
      type: "json_schema",
      schema,
    },
  };
}

/**
 * Gemini `responseJsonSchema` payload.
 *
 * Gemini accepts an OpenAPI 3.0 subset and silently ignores unknown keywords;
 * `oneOf`, `anyOf`, `$ref`, and `pattern` are not supported.
 */
const GEMINI_UNSUPPORTED_KEYS: ReadonlySet<string> = new Set([
  "oneOf",
  "anyOf",
  "$ref",
  "$defs",
  "definitions",
  "pattern",
  "$schema",
  "additionalProperties",
]);

export function toGeminiSchema(
  rf: ResponseFormat | undefined,
): Record<string, unknown> | undefined {
  if (!rf || rf.type !== "json_schema") return undefined;
  return stripSchemaKeys(
    rf.json_schema.schema,
    GEMINI_UNSUPPORTED_KEYS,
  ) as Record<string, unknown>;
}

/**
 * Convert an ActionParameter to a Gemini-compatible schema. Recurses into
 * array `items` / object `properties` (via parameterToJsonSchema) so nested
 * shapes are preserved, then strips keys Gemini's function-declaration schema
 * rejects (e.g. `additionalProperties`).
 */
export function parameterToGeminiSchema(param: {
  type: string;
  description?: string;
  enum?: string[];
  items?: unknown;
  properties?: Record<string, unknown>;
}): Record<string, unknown> {
  return stripSchemaKeys(
    parameterToJsonSchema(param),
    GEMINI_UNSUPPORTED_KEYS,
  ) as Record<string, unknown>;
}

/** Ollama `format` field — `"json"` for free-form, schema object for constrained. */
export function toOllamaFormat(
  rf: ResponseFormat | undefined,
): string | Record<string, unknown> | undefined {
  if (!rf) return undefined;
  if (rf.type === "json_object") return "json";
  if (rf.type !== "json_schema" || !rf.json_schema) return undefined;
  return rf.json_schema.schema;
}

/**
 * Convert actions to OpenAI tool format
 */
export function formatTools(actions: ActionDefinition[]): Array<{
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: object;
  };
}> {
  return actions.map((action) => ({
    type: "function" as const,
    function: {
      name: action.name,
      description: action.description,
      parameters: {
        type: "object",
        properties: action.parameters
          ? Object.fromEntries(
              Object.entries(action.parameters).map(([key, param]) => [
                key,
                parameterToJsonSchema(param),
              ]),
            )
          : {},
        required: action.parameters
          ? Object.entries(action.parameters)
              .filter(([, param]) => param.required)
              .map(([key]) => key)
          : [],
        additionalProperties: false,
      },
    },
  }));
}

// ============================================
// Vision/Multimodal Support
// ============================================

/**
 * Content block types for multimodal messages
 */
export type AnthropicContentBlock =
  | { type: "text"; text: string }
  | {
      type: "image";
      source:
        | {
            type: "base64";
            media_type: string;
            data: string;
          }
        | {
            type: "url";
            url: string;
          };
    }
  | {
      type: "document";
      source:
        | {
            type: "base64";
            media_type: string;
            data: string;
          }
        | {
            type: "url";
            url: string;
          };
    };

export type OpenAIContentBlock =
  | { type: "text"; text: string }
  | {
      type: "image_url";
      image_url: {
        url: string;
        detail?: "low" | "high" | "auto";
      };
    };

/**
 * Check if a message has image attachments
 * Supports both new format (metadata.attachments) and legacy (attachments)
 */
export function hasImageAttachments(message: Message): boolean {
  const attachments = message.metadata?.attachments;
  return attachments?.some((a) => a.type === "image") ?? false;
}

/**
 * Check if a message has media attachments (images or PDFs)
 */
export function hasMediaAttachments(message: Message): boolean {
  const attachments = message.metadata?.attachments;
  return (
    attachments?.some(
      (a) =>
        a.type === "image" ||
        (a.type === "file" && a.mimeType === "application/pdf"),
    ) ?? false
  );
}

/**
 * Convert MessageAttachment to Anthropic image content block
 *
 * Anthropic format:
 * {
 *   type: "image",
 *   source: {
 *     type: "base64",
 *     media_type: "image/png",
 *     data: "base64data..."
 *   }
 * }
 */
export function attachmentToAnthropicImage(
  attachment: MessageAttachment,
): AnthropicContentBlock | null {
  if (attachment.type !== "image") return null;

  // Use URL if available (cloud storage)
  if (attachment.url) {
    return {
      type: "image",
      source: {
        type: "url",
        url: attachment.url,
      },
    };
  }

  // Fall back to base64 data
  if (!attachment.data) return null;

  // Extract base64 data (remove data URI prefix if present)
  let base64Data = attachment.data;
  if (base64Data.startsWith("data:")) {
    const commaIndex = base64Data.indexOf(",");
    if (commaIndex !== -1) {
      base64Data = base64Data.slice(commaIndex + 1);
    }
  }

  return {
    type: "image",
    source: {
      type: "base64",
      media_type: attachment.mimeType || "image/png",
      data: base64Data,
    },
  };
}

/**
 * Convert MessageAttachment to OpenAI image_url content block
 *
 * OpenAI format:
 * {
 *   type: "image_url",
 *   image_url: {
 *     url: "data:image/png;base64,..."
 *   }
 * }
 */
export function attachmentToOpenAIImage(
  attachment: MessageAttachment,
): OpenAIContentBlock | null {
  if (attachment.type !== "image") return null;

  let imageUrl: string;

  // Use URL if available (cloud storage)
  if (attachment.url) {
    imageUrl = attachment.url;
  } else if (attachment.data) {
    // Build data URI if not already one
    imageUrl = attachment.data.startsWith("data:")
      ? attachment.data
      : `data:${attachment.mimeType || "image/png"};base64,${attachment.data}`;
  } else {
    return null;
  }

  return {
    type: "image_url",
    image_url: {
      url: imageUrl,
      detail: "auto",
    },
  };
}

/**
 * Convert MessageAttachment (PDF) to Anthropic document content block
 *
 * Anthropic format:
 * {
 *   type: "document",
 *   source: {
 *     type: "base64",
 *     media_type: "application/pdf",
 *     data: "base64data..."
 *   }
 * }
 */
export function attachmentToAnthropicDocument(
  attachment: MessageAttachment,
): AnthropicContentBlock | null {
  // Only handle PDF files
  if (attachment.type !== "file" || attachment.mimeType !== "application/pdf") {
    return null;
  }

  // Use URL if available (cloud storage)
  if (attachment.url) {
    return {
      type: "document",
      source: {
        type: "url",
        url: attachment.url,
      },
    };
  }

  // Fall back to base64 data
  if (!attachment.data) return null;

  // Extract base64 data (remove data URI prefix if present)
  let base64Data = attachment.data;
  if (base64Data.startsWith("data:")) {
    const commaIndex = base64Data.indexOf(",");
    if (commaIndex !== -1) {
      base64Data = base64Data.slice(commaIndex + 1);
    }
  }

  return {
    type: "document",
    source: {
      type: "base64",
      media_type: "application/pdf",
      data: base64Data,
    },
  };
}

/**
 * Convert a Message to Anthropic multimodal content blocks
 */
export function messageToAnthropicContent(
  message: Message,
): string | AnthropicContentBlock[] {
  const attachments = message.metadata?.attachments;
  const content = message.content ?? "";

  // If no media attachments (images or PDFs), return simple string
  if (!hasMediaAttachments(message)) {
    return content;
  }

  // Build content blocks array
  const blocks: AnthropicContentBlock[] = [];

  // Add media attachments first (Claude recommends media before text)
  if (attachments) {
    for (const attachment of attachments) {
      // Try image first
      const imageBlock = attachmentToAnthropicImage(attachment);
      if (imageBlock) {
        blocks.push(imageBlock);
        continue;
      }
      // Try document (PDF)
      const docBlock = attachmentToAnthropicDocument(attachment);
      if (docBlock) {
        blocks.push(docBlock);
      }
    }
  }

  // Add text content
  if (content) {
    blocks.push({ type: "text", text: content });
  }

  return blocks;
}

/**
 * Convert a Message to OpenAI multimodal content blocks
 */
export function messageToOpenAIContent(
  message: Message,
): string | OpenAIContentBlock[] {
  const attachments = message.metadata?.attachments;
  const content = message.content ?? "";

  // Check for audio parts in content array
  const hasAudio =
    Array.isArray(message.content) &&
    (message.content as Array<{ type: string }>).some(
      (p) => p.type === "input_audio",
    );

  // If no image attachments and no audio parts, return simple string
  if (!hasImageAttachments(message) && !hasAudio) {
    return content;
  }

  // If content is already an array of parts (e.g. audio + text), pass through directly
  if (Array.isArray(message.content)) {
    return message.content as unknown as OpenAIContentBlock[];
  }

  // Build content blocks array
  const blocks: OpenAIContentBlock[] = [];

  // Add text content first
  if (content) {
    blocks.push({ type: "text", text: content });
  }

  // Add image attachments
  if (attachments) {
    for (const attachment of attachments) {
      const imageBlock = attachmentToOpenAIImage(attachment);
      if (imageBlock) {
        blocks.push(imageBlock);
      }
    }
  }

  return blocks;
}

/**
 * Anthropic content block types (extended for tools)
 */
export type AnthropicToolUseBlock = {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
};

export type AnthropicToolResultBlock = {
  type: "tool_result";
  tool_use_id: string;
  content: string;
};

export type AnthropicMessageContent =
  | string
  | Array<
      AnthropicContentBlock | AnthropicToolUseBlock | AnthropicToolResultBlock
    >;

/**
 * Format messages for Anthropic with full tool support
 * Handles: text, images, tool_use, and tool_result
 *
 * Key differences from OpenAI:
 * - tool_calls become tool_use blocks in assistant content
 * - tool results become tool_result blocks in user content
 */
export function formatMessagesForAnthropic(
  messages: Message[],
  systemPrompt?: string,
): {
  system: string;
  messages: Array<{
    role: "user" | "assistant";
    content: AnthropicMessageContent;
  }>;
} {
  const formatted: Array<{
    role: "user" | "assistant";
    content: AnthropicMessageContent;
  }> = [];

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];

    if (msg.role === "system") continue; // System handled separately

    if (msg.role === "assistant") {
      // Build content array for assistant
      const content: Array<AnthropicContentBlock | AnthropicToolUseBlock> = [];

      // Add text content if present
      if (msg.content) {
        content.push({ type: "text", text: msg.content });
      }

      // Convert tool_calls to tool_use blocks
      if (msg.tool_calls && msg.tool_calls.length > 0) {
        for (const tc of msg.tool_calls) {
          content.push({
            type: "tool_use",
            id: tc.id,
            name: tc.function.name,
            input: JSON.parse(tc.function.arguments),
          });
        }
      }

      formatted.push({
        role: "assistant",
        content:
          content.length === 1 && content[0].type === "text"
            ? (content[0] as { type: "text"; text: string }).text
            : content,
      });
    } else if (msg.role === "tool" && msg.tool_call_id) {
      // Tool results go in user message as tool_result blocks
      // Group consecutive tool messages together
      const toolResults: AnthropicToolResultBlock[] = [
        {
          type: "tool_result",
          tool_use_id: msg.tool_call_id,
          content: msg.content ?? "",
        },
      ];

      // Look ahead for more consecutive tool messages
      while (i + 1 < messages.length && messages[i + 1].role === "tool") {
        i++;
        const nextTool = messages[i];
        if (nextTool.tool_call_id) {
          toolResults.push({
            type: "tool_result",
            tool_use_id: nextTool.tool_call_id,
            content: nextTool.content ?? "",
          });
        }
      }

      formatted.push({
        role: "user",
        content: toolResults,
      });
    } else if (msg.role === "user") {
      formatted.push({
        role: "user",
        content: messageToAnthropicContent(msg),
      });
    }
  }

  return {
    system: systemPrompt || "",
    messages: formatted,
  };
}

/**
 * OpenAI message format with tool support
 */
export type OpenAIMessage =
  | { role: "system"; content: string }
  | { role: "user"; content: string | OpenAIContentBlock[] }
  | {
      role: "assistant";
      content: string | null;
      tool_calls?: Array<{
        id: string;
        type: "function";
        function: { name: string; arguments: string };
      }>;
    }
  | { role: "tool"; content: string; tool_call_id: string };

/**
 * Format messages for OpenAI with full tool support
 * Handles: text, images, tool_calls, and tool results
 */
export function formatMessagesForOpenAI(
  messages: Message[],
  systemPrompt?: string,
): OpenAIMessage[] {
  const formatted: OpenAIMessage[] = [];

  // Add system prompt if provided
  if (systemPrompt) {
    formatted.push({ role: "system", content: systemPrompt });
  }

  for (const msg of messages) {
    if (msg.role === "system") {
      formatted.push({ role: "system", content: msg.content ?? "" });
    } else if (msg.role === "user") {
      formatted.push({
        role: "user",
        content: messageToOpenAIContent(msg),
      });
    } else if (msg.role === "assistant") {
      const hasToolCalls = msg.tool_calls && msg.tool_calls.length > 0;
      const assistantMsg: OpenAIMessage = {
        role: "assistant",
        // Gemini/xAI (OpenAI-compatible) reject content: "" on assistant messages with tool_calls
        content: hasToolCalls ? msg.content || null : msg.content,
      };
      if (hasToolCalls) {
        (assistantMsg as { tool_calls: typeof msg.tool_calls }).tool_calls =
          msg.tool_calls;
      }
      formatted.push(assistantMsg);
    } else if (msg.role === "tool" && msg.tool_call_id) {
      formatted.push({
        role: "tool",
        content: msg.content ?? "",
        tool_call_id: msg.tool_call_id,
      });
    }
  }

  return formatted;
}
