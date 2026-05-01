/**
 * OpenAI Provider - Modern Pattern
 *
 * Returns a LanguageModel instance that can be used directly with
 * generateText() and streamText().
 *
 * @example
 * ```ts
 * import { openai } from '@yourgpt/llm-sdk/openai';
 * import { generateText } from '@yourgpt/llm-sdk';
 *
 * const result = await generateText({
 *   model: openai('gpt-4o'),
 *   prompt: 'Hello!',
 * });
 * ```
 */

import type {
  LanguageModel,
  ModelCapabilities,
  DoGenerateParams,
  DoGenerateResult,
  StreamChunk,
  ToolCall,
  FinishReason,
  CoreMessage,
} from "../../core/types";

// ============================================
// Model Definitions
// ============================================

interface OpenAIModelConfig {
  vision: boolean;
  tools: boolean;
  jsonMode: boolean;
  maxTokens: number;
}

const OPENAI_MODELS: Record<string, OpenAIModelConfig> = {
  // GPT-4o series
  "gpt-4o": { vision: true, tools: true, jsonMode: true, maxTokens: 128000 },
  "gpt-5.2": {
    vision: true,
    tools: true,
    jsonMode: true,
    maxTokens: 128000,
  },
  "gpt-4o-2024-11-20": {
    vision: true,
    tools: true,
    jsonMode: true,
    maxTokens: 128000,
  },
  "gpt-4o-2024-08-06": {
    vision: true,
    tools: true,
    jsonMode: true,
    maxTokens: 128000,
  },

  // GPT-4 Turbo
  "gpt-4-turbo": {
    vision: true,
    tools: true,
    jsonMode: true,
    maxTokens: 128000,
  },
  "gpt-4-turbo-preview": {
    vision: false,
    tools: true,
    jsonMode: true,
    maxTokens: 128000,
  },

  // GPT-4
  "gpt-4": { vision: false, tools: true, jsonMode: false, maxTokens: 8192 },
  "gpt-4-32k": {
    vision: false,
    tools: true,
    jsonMode: false,
    maxTokens: 32768,
  },

  // GPT-3.5
  "gpt-3.5-turbo": {
    vision: false,
    tools: true,
    jsonMode: true,
    maxTokens: 16385,
  },

  // O1 series (reasoning)
  o1: { vision: true, tools: false, jsonMode: false, maxTokens: 128000 },
  "o1-mini": { vision: true, tools: false, jsonMode: false, maxTokens: 128000 },
  "o1-preview": {
    vision: true,
    tools: false,
    jsonMode: false,
    maxTokens: 128000,
  },

  // O3 series
  "o3-mini": { vision: true, tools: false, jsonMode: false, maxTokens: 128000 },
};

// ============================================
// Provider Options
// ============================================

export interface OpenAIProviderOptions {
  /** API key (defaults to OPENAI_API_KEY env var) */
  apiKey?: string;
  /** Base URL for API (defaults to https://api.openai.com/v1) */
  baseURL?: string;
  /** Organization ID */
  organization?: string;
  /** Default headers */
  headers?: Record<string, string>;
}

// ============================================
// Provider Implementation
// ============================================

/**
 * Create an OpenAI language model
 *
 * @param modelId - Model ID (e.g., 'gpt-4o', 'gpt-5.2')
 * @param options - Provider options
 * @returns LanguageModel instance
 *
 * @example
 * ```ts
 * // Basic usage
 * const model = openai('gpt-4o');
 *
 * // With custom options
 * const model = openai('gpt-4o', {
 *   apiKey: 'sk-...',
 *   baseURL: 'https://custom-endpoint.com/v1',
 * });
 * ```
 */
export function openai(
  modelId: string,
  options: OpenAIProviderOptions = {},
): LanguageModel {
  const apiKey = options.apiKey ?? process.env.OPENAI_API_KEY;
  const baseURL = options.baseURL ?? "https://api.openai.com/v1";

  // Lazy-load OpenAI client
  let client: any = null;
  async function getClient(): Promise<any> {
    if (!client) {
      const { default: OpenAI } = await import("openai");
      client = new OpenAI({
        apiKey,
        baseURL,
        organization: options.organization,
        defaultHeaders: options.headers,
      });
    }
    return client;
  }

  // Get model config
  const modelConfig = OPENAI_MODELS[modelId] ?? OPENAI_MODELS["gpt-4o"];

  return {
    provider: "openai",
    modelId,

    capabilities: {
      supportsVision: modelConfig.vision,
      supportsTools: modelConfig.tools,
      supportsStreaming: true,
      supportsJsonMode: modelConfig.jsonMode,
      supportsThinking: false,
      supportsPDF: false,
      maxTokens: modelConfig.maxTokens,
      supportedImageTypes: modelConfig.vision
        ? ["image/png", "image/jpeg", "image/gif", "image/webp"]
        : [],
    },

    async doGenerate(params: DoGenerateParams): Promise<DoGenerateResult> {
      const client = await getClient();

      const messages = formatMessagesForOpenAI(params.messages);

      const response = await client.chat.completions.create({
        model: modelId,
        messages,
        tools: params.tools as any,
        temperature: params.temperature,
        max_tokens: params.maxTokens,
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

      const messages = formatMessagesForOpenAI(params.messages);

      const stream = await client.chat.completions.create({
        model: modelId,
        messages,
        tools: params.tools as any,
        temperature: params.temperature,
        max_tokens: params.maxTokens,
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
              yield {
                type: "tool-call-start" as const,
                toolCallId: tc.id,
                toolName: tc.function?.name ?? "",
              };
            } else if (currentToolCall && tc.function?.arguments) {
              // Append arguments
              currentToolCall.arguments += tc.function.arguments;
              yield {
                type: "tool-call-delta" as const,
                toolCallId: currentToolCall.id,
                argsText: currentToolCall.arguments,
              };
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
 * Map OpenAI finish reason to our FinishReason type
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
 * Format CoreMessage[] for OpenAI API
 */
function formatMessagesForOpenAI(messages: CoreMessage[]): any[] {
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

// Also export as createOpenAI for backward compatibility
export { openai as createOpenAI };
