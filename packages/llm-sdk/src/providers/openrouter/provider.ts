/**
 * OpenRouter Provider - Modern Pattern
 *
 * OpenRouter provides a unified API to access 500+ AI models from 60+ providers
 * (OpenAI, Anthropic, Google, Meta, Mistral, etc.) through a single endpoint.
 *
 * @example
 * ```ts
 * import { openrouter } from '@yourgpt/llm-sdk/openrouter';
 * import { generateText } from '@yourgpt/llm-sdk';
 *
 * const result = await generateText({
 *   model: openrouter('anthropic/claude-3.5-sonnet'),
 *   prompt: 'Hello!',
 * });
 * ```
 */

import type {
  LanguageModel,
  DoGenerateParams,
  DoGenerateResult,
  StreamChunk,
  ToolCall,
  FinishReason,
  CoreMessage,
} from "../../core/types";

// ============================================
// Model Configuration
// ============================================

/**
 * OpenRouter supports 500+ models dynamically.
 * Use fetchOpenRouterModels() to get live model list with accurate capabilities.
 * This default config is used as fallback for all models.
 */
const DEFAULT_MODEL_CONFIG = {
  vision: true,
  tools: true,
  jsonMode: true,
  maxTokens: 128000,
};

/**
 * OpenAI reasoning models that hide reasoning on chat-completions but expose
 * reasoning summaries on the Responses API. Match by prefix on the OpenRouter
 * model id (e.g. "openai/o3", "openai/o3-mini-high", "openai/gpt-5-thinking").
 *
 * Excludes non-reasoning OpenAI models like openai/gpt-4o, openai/gpt-4.1,
 * openai/chatgpt-* — those continue on chat-completions.
 */
function isOpenAIReasoningModel(modelId: string): boolean {
  return (
    modelId.startsWith("openai/o1") ||
    modelId.startsWith("openai/o3") ||
    modelId.startsWith("openai/o4") ||
    modelId.startsWith("openai/gpt-5")
  );
}

// ============================================
// Provider Options
// ============================================

export interface OpenRouterProviderOptions {
  /** API key (defaults to OPENROUTER_API_KEY env var) */
  apiKey?: string;
  /** Base URL for API (defaults to https://openrouter.ai/api/v1) */
  baseURL?: string;
  /** Your site URL for OpenRouter rankings (HTTP-Referer header) */
  siteUrl?: string;
  /** Your app name for OpenRouter rankings (X-Title header) */
  appName?: string;
  /** Provider preferences for routing */
  providerPreferences?: {
    /** Preferred providers (e.g., ['anthropic', 'openai']) */
    allow?: string[];
    /** Blocked providers */
    deny?: string[];
    /** Order preference: 'price' | 'latency' | 'throughput' */
    order?: "price" | "latency" | "throughput";
  };
  /** Disable extended thinking/reasoning (default: thinking enabled) */
  disableThinking?: boolean;
}

// ============================================
// Provider Implementation
// ============================================

/**
 * Create an OpenRouter language model
 *
 * OpenRouter provides access to 500+ models through a single API.
 * Model IDs follow the format: provider/model-name
 *
 * @param modelId - Model ID (e.g., 'anthropic/claude-3.5-sonnet', 'openai/gpt-4o')
 * @param options - Provider options
 * @returns LanguageModel instance
 *
 * @example
 * ```ts
 * // Basic usage
 * const model = openrouter('anthropic/claude-3.5-sonnet');
 *
 * // With custom options
 * const model = openrouter('openai/gpt-4o', {
 *   apiKey: 'sk-or-...',
 *   siteUrl: 'https://myapp.com',
 *   appName: 'My App',
 * });
 *
 * // Use auto model selection
 * const model = openrouter('openrouter/auto');
 * ```
 */
export function openrouter(
  modelId: string,
  options: OpenRouterProviderOptions = {},
): LanguageModel {
  const apiKey = options.apiKey ?? process.env.OPENROUTER_API_KEY;
  const baseURL = options.baseURL ?? "https://openrouter.ai/api/v1";

  // Build headers
  const headers: Record<string, string> = {};
  if (options.siteUrl) {
    headers["HTTP-Referer"] = options.siteUrl;
  }
  if (options.appName) {
    headers["X-Title"] = options.appName;
  }

  // Lazy-load OpenAI client (OpenRouter uses OpenAI-compatible API)
  let client: any = null;
  async function getClient(): Promise<any> {
    if (!client) {
      const { default: OpenAI } = await import("openai");
      client = new OpenAI({
        apiKey,
        baseURL,
        defaultHeaders: headers,
      });
    }
    return client;
  }

  // Use default config for all models
  // Use fetchOpenRouterModels() to get accurate model-specific capabilities
  const modelConfig = DEFAULT_MODEL_CONFIG;

  return {
    provider: "openrouter",
    modelId,

    capabilities: {
      supportsVision: modelConfig.vision,
      supportsTools: modelConfig.tools,
      supportsStreaming: true,
      supportsJsonMode: modelConfig.jsonMode,
      supportsThinking: true,
      supportsPDF: false,
      maxTokens: modelConfig.maxTokens,
      supportedImageTypes: modelConfig.vision
        ? ["image/png", "image/jpeg", "image/gif", "image/webp"]
        : [],
    },

    async doGenerate(params: DoGenerateParams): Promise<DoGenerateResult> {
      const client = await getClient();

      const messages = formatMessagesForOpenRouter(params.messages);

      // Build request body
      const requestBody: any = {
        model: modelId,
        messages,
        temperature: params.temperature,
        max_tokens: params.maxTokens,
      };

      // Add tools if provided
      if (params.tools) {
        requestBody.tools = params.tools;
      }

      // Add provider preferences if configured
      if (options.providerPreferences) {
        requestBody.provider = options.providerPreferences;
      }

      const response = await client.chat.completions.create(requestBody);

      const choice = response.choices[0];
      const message = choice.message;

      // Parse tool calls
      const toolCalls: ToolCall[] = (message.tool_calls ?? []).map(
        (tc: any) => ({
          id: tc.id,
          name: tc.function.name,
          args: JSON.parse(tc.function.arguments || "{}"),
        }),
      );

      return {
        text: message.content ?? "",
        toolCalls,
        finishReason: mapFinishReason(choice.finish_reason),
        usage: {
          promptTokens: response.usage?.prompt_tokens ?? 0,
          completionTokens: response.usage?.completion_tokens ?? 0,
          totalTokens: response.usage?.total_tokens ?? 0,
        },
        rawResponse: response,
      };
    },

    async *doStream(params: DoGenerateParams): AsyncGenerator<StreamChunk> {
      // OpenAI o-series and GPT-5 reasoning models do NOT expose reasoning content
      // on chat-completions through OpenRouter — only summaries via the Responses API.
      // Route those through doStreamResponsesAPI so the UI can show thinking summaries.
      // disableThinking opts out (falls through to chat-completions, no thinking shown).
      if (!options.disableThinking && isOpenAIReasoningModel(modelId)) {
        const client = await getClient();
        yield* doStreamResponsesAPI(client, modelId, params);
        return;
      }

      const client = await getClient();

      const messages = formatMessagesForOpenRouter(params.messages);

      // Build request body
      const requestBody: any = {
        model: modelId,
        messages,
        temperature: params.temperature,
        max_tokens: params.maxTokens,
        stream: true,
        ...(!options.disableThinking
          ? { reasoning: { max_tokens: 8000 }, include_reasoning: true }
          : {}),
      };

      // Add tools if provided
      if (params.tools) {
        requestBody.tools = params.tools;
      }

      // Add provider preferences if configured
      if (options.providerPreferences) {
        requestBody.provider = options.providerPreferences;
      }

      const stream = await client.chat.completions.create(requestBody);

      // Track current tool call being built
      let currentToolCall: {
        id: string;
        name: string;
        arguments: string;
      } | null = null;

      let totalPromptTokens = 0;
      let totalCompletionTokens = 0;
      let orReasoningStarted = false;

      for await (const chunk of stream) {
        // Check abort
        if (params.signal?.aborted) {
          yield { type: "error", error: new Error("Aborted") };
          return;
        }

        const choice = chunk.choices[0];
        const delta = choice?.delta as any;

        // Text content
        if (delta?.content) {
          yield { type: "text-delta", text: delta.content };
        }

        // Native reasoning tokens (OpenRouter models with reasoning_content)
        const rc = delta?.reasoning_content ?? delta?.reasoning ?? null;
        if (rc) {
          const rcText =
            typeof rc === "string"
              ? rc
              : Array.isArray(rc) && rc[0]?.text
                ? rc[0].text
                : "";
          if (rcText) {
            if (!orReasoningStarted) {
              yield { type: "thinking:start" } as any;
              orReasoningStarted = true;
            }
            yield { type: "thinking:delta", content: rcText } as any;
          }
        } else if (
          orReasoningStarted &&
          (delta?.content || choice?.finish_reason)
        ) {
          yield { type: "thinking:end" } as any;
          orReasoningStarted = false;
        }

        // Tool calls
        if (delta?.tool_calls) {
          for (const tc of delta.tool_calls) {
            if (tc.id) {
              // New tool call - emit previous if exists
              if (currentToolCall) {
                yield {
                  type: "tool-call",
                  toolCall: {
                    id: currentToolCall.id,
                    name: currentToolCall.name,
                    args: JSON.parse(currentToolCall.arguments || "{}"),
                  },
                };
              }
              currentToolCall = {
                id: tc.id,
                name: tc.function?.name ?? "",
                arguments: tc.function?.arguments ?? "",
              };
            } else if (currentToolCall && tc.function?.arguments) {
              // Append arguments
              currentToolCall.arguments += tc.function.arguments;
            }
          }
        }

        // Finish reason
        if (choice?.finish_reason) {
          // Emit pending tool call
          if (currentToolCall) {
            yield {
              type: "tool-call",
              toolCall: {
                id: currentToolCall.id,
                name: currentToolCall.name,
                args: JSON.parse(currentToolCall.arguments || "{}"),
              },
            };
            currentToolCall = null;
          }

          // Usage from final chunk (if available)
          if (chunk.usage) {
            totalPromptTokens = chunk.usage.prompt_tokens;
            totalCompletionTokens = chunk.usage.completion_tokens;
          }

          yield {
            type: "finish",
            finishReason: mapFinishReason(choice.finish_reason),
            usage: {
              promptTokens: totalPromptTokens,
              completionTokens: totalCompletionTokens,
              totalTokens: totalPromptTokens + totalCompletionTokens,
            },
          };
        }
      }
    },
  };
}

// ============================================
// Helper Functions
// ============================================

/**
 * Map OpenRouter finish reason to our FinishReason type
 */
function mapFinishReason(reason: string | null): FinishReason {
  switch (reason) {
    case "stop":
      return "stop";
    case "length":
      return "length";
    case "tool_calls":
    case "function_call":
      return "tool-calls";
    case "content_filter":
      return "content-filter";
    default:
      return "unknown";
  }
}

/**
 * Format CoreMessage[] for OpenRouter API (OpenAI-compatible)
 */
function formatMessagesForOpenRouter(messages: CoreMessage[]): any[] {
  return messages.map((msg) => {
    switch (msg.role) {
      case "system":
        return { role: "system", content: msg.content };

      case "user":
        if (typeof msg.content === "string") {
          return { role: "user", content: msg.content };
        }
        // Handle multimodal content
        return {
          role: "user",
          content: msg.content.map((part) => {
            if (part.type === "text") {
              return { type: "text", text: part.text };
            }
            if (part.type === "image") {
              const imageData =
                typeof part.image === "string"
                  ? part.image
                  : Buffer.from(part.image).toString("base64");
              const url = imageData.startsWith("data:")
                ? imageData
                : `data:${part.mimeType ?? "image/png"};base64,${imageData}`;
              return { type: "image_url", image_url: { url, detail: "auto" } };
            }
            return { type: "text", text: "" };
          }),
        };

      case "assistant":
        const assistantMsg: any = {
          role: "assistant",
          content: msg.content,
        };
        if (msg.toolCalls && msg.toolCalls.length > 0) {
          assistantMsg.tool_calls = msg.toolCalls.map((tc) => ({
            id: tc.id,
            type: "function",
            function: {
              name: tc.name,
              arguments: JSON.stringify(tc.args),
            },
          }));
        }
        return assistantMsg;

      case "tool":
        return {
          role: "tool",
          tool_call_id: msg.toolCallId,
          content: msg.content,
        };

      default:
        return msg;
    }
  });
}

// ============================================
// Responses API path (OpenAI reasoning models only)
// ============================================

/**
 * Convert CoreMessage[] to OpenAI Responses API `input` array shape.
 * Responses API uses {type:"message", role, content:[{type:"input_text", text}]}
 * — different from chat-completions' messages array.
 *
 * Multimodal images use `input_image` with image_url. Tool messages become
 * function_call_output items keyed by tool_call_id.
 */
function formatMessagesForResponsesAPI(messages: CoreMessage[]): any[] {
  const out: any[] = [];
  for (const msg of messages) {
    if (msg.role === "system") {
      // System content is hoisted onto a top-level instructions field by the caller;
      // include here as a regular developer message for safety in case caller didn't.
      out.push({
        type: "message",
        role: "system",
        content: [
          {
            type: "input_text",
            text: typeof msg.content === "string" ? msg.content : "",
          },
        ],
      });
      continue;
    }
    if (msg.role === "user") {
      const parts: any[] = [];
      if (typeof msg.content === "string") {
        parts.push({ type: "input_text", text: msg.content });
      } else {
        for (const part of msg.content) {
          if (part.type === "text") {
            parts.push({ type: "input_text", text: part.text });
          } else if (part.type === "image") {
            const imageData =
              typeof part.image === "string"
                ? part.image
                : Buffer.from(part.image).toString("base64");
            const url = imageData.startsWith("data:")
              ? imageData
              : `data:${part.mimeType ?? "image/png"};base64,${imageData}`;
            parts.push({ type: "input_image", image_url: url });
          }
        }
      }
      out.push({ type: "message", role: "user", content: parts });
      continue;
    }
    if (msg.role === "assistant") {
      // If the assistant message carried tool calls, emit each as a function_call item.
      // Note: we deliberately drop the assistant text bubble when tool_calls exist —
      // Responses API treats function_call as an output item, not nested in a message.
      if (msg.toolCalls && msg.toolCalls.length > 0) {
        for (const tc of msg.toolCalls) {
          out.push({
            type: "function_call",
            call_id: tc.id,
            name: tc.name,
            arguments: JSON.stringify(tc.args ?? {}),
          });
        }
        if (typeof msg.content === "string" && msg.content.length > 0) {
          out.push({
            type: "message",
            role: "assistant",
            content: [{ type: "output_text", text: msg.content }],
          });
        }
      } else {
        const text = typeof msg.content === "string" ? msg.content : "";
        out.push({
          type: "message",
          role: "assistant",
          content: [{ type: "output_text", text }],
        });
      }
      continue;
    }
    if (msg.role === "tool") {
      out.push({
        type: "function_call_output",
        call_id: msg.toolCallId,
        output:
          typeof msg.content === "string"
            ? msg.content
            : JSON.stringify(msg.content),
      });
      continue;
    }
  }
  return out;
}

/**
 * Convert chat-completions tool definitions ({type:"function", function:{...}})
 * to Responses API tool shape ({type:"function", name, description, parameters}).
 */
function formatToolsForResponsesAPI(
  tools: unknown[] | undefined,
): any[] | undefined {
  if (!tools || tools.length === 0) return undefined;
  return tools.map((t: any) => {
    // Already in Responses API shape (flat name/parameters)
    if (t?.name && t?.parameters && t?.type === "function") return t;
    // Chat-completions shape — unwrap function.{name,parameters,description}
    const fn = t?.function ?? t;
    return {
      type: "function",
      name: fn.name,
      description: fn.description,
      parameters: fn.parameters ?? { type: "object", properties: {} },
    };
  });
}

/**
 * Stream from OpenRouter's Responses API and translate events into the same
 * StreamChunk shape that the chat-completions path emits, so downstream
 * consumers (processChunk.ts, frontend tool handlers, plan approval, etc.)
 * see identical chunks regardless of which path produced them.
 *
 * Event mapping:
 *   response.reasoning_summary_text.delta  → thinking:start (once) + thinking:delta
 *   response.output_text.delta             → text-delta
 *   response.output_item.added (function_call) → open new tool-call buffer
 *   response.function_call_arguments.delta → append to tool-call buffer
 *   response.output_item.done (function_call) → emit tool-call chunk
 *   response.completed                     → finish
 *   response.error                         → error
 */
async function* doStreamResponsesAPI(
  client: any,
  modelId: string,
  params: DoGenerateParams,
): AsyncGenerator<StreamChunk> {
  // Hoist system messages into top-level instructions (Responses API convention).
  const systemTexts: string[] = [];
  const nonSystem: CoreMessage[] = [];
  for (const m of params.messages) {
    if (m.role === "system" && typeof m.content === "string") {
      systemTexts.push(m.content);
    } else {
      nonSystem.push(m);
    }
  }
  const instructions = systemTexts.join("\n\n") || undefined;
  const input = formatMessagesForResponsesAPI(nonSystem);

  const requestBody: any = {
    model: modelId,
    input,
    stream: true,
    reasoning: { effort: "medium", summary: "auto" },
  };
  if (instructions) requestBody.instructions = instructions;
  if (typeof params.maxTokens === "number")
    requestBody.max_output_tokens = params.maxTokens;
  if (typeof params.temperature === "number")
    requestBody.temperature = params.temperature;
  const tools = formatToolsForResponsesAPI(params.tools);
  if (tools) requestBody.tools = tools;

  let stream: any;
  try {
    stream = await client.responses.create(requestBody);
  } catch (err) {
    yield {
      type: "error",
      error: err instanceof Error ? err : new Error(String(err)),
    };
    return;
  }

  // Tool-call accumulators keyed by item_id (Responses API streams args as deltas
  // under the same output item, then signals completion via output_item.done).
  const toolCalls = new Map<
    string,
    { id: string; name: string; arguments: string }
  >();

  let reasoningStarted = false;
  let textStarted = false;
  let totalPromptTokens = 0;
  let totalCompletionTokens = 0;
  let finishEmitted = false;

  for await (const evt of stream) {
    if (params.signal?.aborted) {
      yield { type: "error", error: new Error("Aborted") };
      return;
    }

    const t: string = evt?.type ?? "";

    // Reasoning summary deltas (the whole reason this path exists)
    if (t === "response.reasoning_summary_text.delta") {
      const delta: string = evt.delta ?? "";
      if (!delta) continue;
      if (!reasoningStarted) {
        yield { type: "thinking:start" } as any;
        reasoningStarted = true;
      }
      yield { type: "thinking:delta", content: delta } as any;
      continue;
    }
    if (
      t === "response.reasoning_summary_text.done" ||
      t === "response.reasoning.done"
    ) {
      // No-op here — we close reasoning when text starts (mirrors chat-completions behavior)
      continue;
    }

    // Visible answer text
    if (t === "response.output_text.delta") {
      const text: string = evt.delta ?? "";
      if (!text) continue;
      if (reasoningStarted && !textStarted) {
        yield { type: "thinking:end" } as any;
        textStarted = true;
      }
      yield { type: "text-delta", text };
      continue;
    }

    // Tool call lifecycle
    if (t === "response.output_item.added") {
      const item = evt.item;
      if (item?.type === "function_call") {
        const id: string = item.call_id ?? item.id ?? "";
        if (id) {
          toolCalls.set(id, {
            id,
            name: item.name ?? "",
            arguments: item.arguments ?? "",
          });
        }
      }
      continue;
    }
    if (t === "response.function_call_arguments.delta") {
      // Item may be referenced by item_id or call_id depending on OpenRouter's relay.
      const id: string = evt.call_id ?? evt.item_id ?? "";
      const delta: string = evt.delta ?? "";
      if (!id || !delta) continue;
      const existing = toolCalls.get(id);
      if (existing) {
        existing.arguments += delta;
      } else {
        // Some relays emit args before the output_item.added envelope.
        toolCalls.set(id, { id, name: "", arguments: delta });
      }
      continue;
    }
    if (t === "response.output_item.done") {
      const item = evt.item;
      if (item?.type === "function_call") {
        const id: string = item.call_id ?? item.id ?? "";
        const tc = toolCalls.get(id);
        const name = tc?.name || item.name || "";
        const argsStr = tc?.arguments || item.arguments || "{}";
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(argsStr || "{}");
        } catch {
          args = {};
        }
        if (id && name) {
          yield {
            type: "tool-call",
            toolCall: { id, name, args },
          };
        }
        toolCalls.delete(id);
      }
      continue;
    }

    // Terminal events
    if (t === "response.completed") {
      const usage = evt.response?.usage;
      if (usage) {
        totalPromptTokens = usage.input_tokens ?? 0;
        totalCompletionTokens = usage.output_tokens ?? 0;
      }
      // Emit any tool calls that didn't get an explicit done event (defensive)
      for (const tc of toolCalls.values()) {
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(tc.arguments || "{}");
        } catch {
          args = {};
        }
        if (tc.id && tc.name) {
          yield {
            type: "tool-call",
            toolCall: { id: tc.id, name: tc.name, args },
          };
        }
      }
      toolCalls.clear();

      if (reasoningStarted && !textStarted) {
        yield { type: "thinking:end" } as any;
      }

      const finishReason: FinishReason =
        toolCalls.size > 0 ? "tool-calls" : "stop";
      yield {
        type: "finish",
        finishReason,
        usage: {
          promptTokens: totalPromptTokens,
          completionTokens: totalCompletionTokens,
          totalTokens: totalPromptTokens + totalCompletionTokens,
        },
      };
      finishEmitted = true;
      continue;
    }
    if (t === "response.error" || t === "error") {
      const msg: string =
        evt.error?.message || evt.message || "Responses API error";
      yield { type: "error", error: new Error(msg) };
      return;
    }
  }

  // Stream ended without an explicit response.completed — emit a synthetic finish
  // so downstream state machines settle. Mirrors the chat-completions guarantee.
  if (!finishEmitted) {
    if (reasoningStarted && !textStarted) {
      yield { type: "thinking:end" } as any;
    }
    yield {
      type: "finish",
      finishReason: "stop",
      usage: {
        promptTokens: totalPromptTokens,
        completionTokens: totalCompletionTokens,
        totalTokens: totalPromptTokens + totalCompletionTokens,
      },
    };
  }
}

// ============================================
// Models API - Fetch available models
// ============================================

/**
 * OpenRouter model information from the API
 */
export interface OpenRouterModel {
  id: string;
  name: string;
  description?: string;
  pricing: {
    prompt: string;
    completion: string;
  };
  context_length: number;
  architecture?: {
    modality?: string;
    tokenizer?: string;
    instruct_type?: string | null;
  };
  top_provider?: {
    context_length: number;
    max_completion_tokens: number;
    is_moderated: boolean;
  };
  per_request_limits?: {
    prompt_tokens?: string;
    completion_tokens?: string;
  };
}

/**
 * Fetch available models from OpenRouter API
 *
 * @param apiKey - Optional API key (not required for listing models)
 * @returns Array of available models
 *
 * @example
 * ```ts
 * const models = await fetchOpenRouterModels();
 * console.log(models.map(m => m.id));
 * ```
 */
export async function fetchOpenRouterModels(
  apiKey?: string,
): Promise<OpenRouterModel[]> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (apiKey) {
    headers["Authorization"] = `Bearer ${apiKey}`;
  }

  const response = await fetch("https://openrouter.ai/api/v1/models", {
    headers,
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch models: ${response.statusText}`);
  }

  const data = (await response.json()) as { data?: OpenRouterModel[] };
  return data.data || [];
}

/**
 * Search OpenRouter models by name, ID, or provider
 *
 * @param query - Search query
 * @param apiKey - Optional API key
 * @returns Filtered models matching the query
 *
 * @example
 * ```ts
 * const claudeModels = await searchOpenRouterModels('claude');
 * const gptModels = await searchOpenRouterModels('gpt');
 * ```
 */
export async function searchOpenRouterModels(
  query: string,
  apiKey?: string,
): Promise<OpenRouterModel[]> {
  const models = await fetchOpenRouterModels(apiKey);
  const lowerQuery = query.toLowerCase();

  return models.filter(
    (model) =>
      model.id.toLowerCase().includes(lowerQuery) ||
      model.name.toLowerCase().includes(lowerQuery),
  );
}

// Also export as createOpenRouter for backward compatibility
export { openrouter as createOpenRouter };
