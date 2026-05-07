/**
 * xAI Provider - Modern Pattern
 *
 * Returns a LanguageModel instance that can be used directly with
 * generateText() and streamText().
 *
 * @example
 * ```ts
 * import { xai } from '@yourgpt/llm-sdk/xai';
 * import { generateText } from '@yourgpt/llm-sdk';
 *
 * const result = await generateText({
 *   model: xai('grok-3-fast'),
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
import { toOpenAIResponseFormat } from "../../adapters/base";

// ============================================
// Model Definitions
// ============================================

interface XAIModelConfig {
  vision: boolean;
  tools: boolean;
  maxTokens: number;
}

const XAI_MODELS: Record<string, XAIModelConfig> = {
  // Grok 4.1 Fast (Latest - December 2025)
  "grok-4-1-fast-reasoning": { vision: false, tools: true, maxTokens: 2000000 },
  "grok-4-1-fast-non-reasoning": {
    vision: false,
    tools: true,
    maxTokens: 2000000,
  },

  // Grok 4 Fast (September 2025)
  "grok-4-fast-reasoning": { vision: false, tools: true, maxTokens: 2000000 },
  "grok-4-fast-non-reasoning": {
    vision: false,
    tools: true,
    maxTokens: 2000000,
  },

  // Grok 4 (July 2025)
  "grok-4": { vision: true, tools: true, maxTokens: 256000 },
  "grok-4-0709": { vision: true, tools: true, maxTokens: 256000 },

  // Grok 3 (February 2025) - Stable
  "grok-3-beta": { vision: true, tools: true, maxTokens: 131072 },
  "grok-3-fast": { vision: false, tools: true, maxTokens: 131072 },
  "grok-3-mini-beta": { vision: false, tools: true, maxTokens: 32768 },
  "grok-3-mini-fast-beta": { vision: false, tools: true, maxTokens: 32768 },

  // Grok Code Fast (August 2025)
  "grok-code-fast-1": { vision: false, tools: true, maxTokens: 256000 },

  // Grok 2 (Legacy)
  "grok-2": { vision: true, tools: true, maxTokens: 131072 },
  "grok-2-latest": { vision: true, tools: true, maxTokens: 131072 },
  "grok-2-mini": { vision: false, tools: true, maxTokens: 131072 },
};

// ============================================
// Provider Options
// ============================================

export interface XAIProviderOptions {
  /** API key (defaults to XAI_API_KEY env var) */
  apiKey?: string;
  /** Base URL for API (defaults to https://api.x.ai/v1) */
  baseURL?: string;
}

// ============================================
// Provider Implementation
// ============================================

/**
 * Create an xAI language model
 *
 * @param modelId - Model ID (e.g., 'grok-3-fast', 'grok-4')
 * @param options - Provider options
 * @returns LanguageModel instance
 *
 * @example
 * ```ts
 * // Basic usage
 * const model = xai('grok-3-fast');
 *
 * // With custom options
 * const model = xai('grok-4', {
 *   apiKey: 'xai-...',
 * });
 * ```
 */
export function xai(
  modelId: string,
  options: XAIProviderOptions = {},
): LanguageModel {
  const apiKey = options.apiKey ?? process.env.XAI_API_KEY;
  const baseURL = options.baseURL ?? "https://api.x.ai/v1";

  // Lazy-load OpenAI client (xAI uses OpenAI-compatible API)
  let client: any = null;
  async function getClient(): Promise<any> {
    if (!client) {
      const { default: OpenAI } = await import("openai");
      client = new OpenAI({
        apiKey,
        baseURL,
      });
    }
    return client;
  }

  // Get model config
  const modelConfig = XAI_MODELS[modelId] ?? XAI_MODELS["grok-3-fast"];

  return {
    provider: "xai",
    modelId,

    capabilities: {
      supportsVision: modelConfig.vision,
      supportsTools: modelConfig.tools,
      supportsStreaming: true,
      supportsJsonMode: true, // OpenAI-compatible `response_format`
      supportsThinking: false,
      supportsPDF: false,
      maxTokens: modelConfig.maxTokens,
      supportedImageTypes: modelConfig.vision
        ? ["image/png", "image/jpeg", "image/gif", "image/webp"]
        : [],
    },

    async doGenerate(params: DoGenerateParams): Promise<DoGenerateResult> {
      const client = await getClient();

      const messages = formatMessagesForXAI(params.messages);

      const response = await client.chat.completions.create({
        model: modelId,
        messages,
        tools: params.tools as any,
        temperature: params.temperature,
        max_tokens: params.maxTokens,
        response_format: toOpenAIResponseFormat(params.responseFormat),
      });

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

      const messages = formatMessagesForXAI(params.messages);

      const stream = await client.chat.completions.create({
        model: modelId,
        messages,
        tools: params.tools as any,
        temperature: params.temperature,
        max_tokens: params.maxTokens,
        response_format: toOpenAIResponseFormat(params.responseFormat),
        stream: true,
      });

      // Track current tool call being built
      let currentToolCall: {
        id: string;
        name: string;
        arguments: string;
      } | null = null;

      let totalPromptTokens = 0;
      let totalCompletionTokens = 0;

      for await (const chunk of stream) {
        // Check abort
        if (params.signal?.aborted) {
          yield { type: "error", error: new Error("Aborted") };
          return;
        }

        const choice = chunk.choices[0];
        const delta = choice?.delta;

        // Text content
        if (delta?.content) {
          yield { type: "text-delta", text: delta.content };
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
 * Map xAI finish reason to our FinishReason type
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
 * Format CoreMessage[] for xAI API (OpenAI-compatible)
 */
function formatMessagesForXAI(messages: CoreMessage[]): any[] {
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

// Also export as createXAI for backward compatibility
export { xai as createXAI };
