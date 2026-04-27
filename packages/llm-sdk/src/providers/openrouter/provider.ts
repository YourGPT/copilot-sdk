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
