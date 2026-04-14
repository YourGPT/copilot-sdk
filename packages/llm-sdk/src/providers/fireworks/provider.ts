/**
 * Fireworks Provider
 *
 * Fireworks.ai is a high-performance inference platform for open-source models.
 * It uses an OpenAI-compatible REST API.
 *
 * @example
 * ```ts
 * import { fireworks } from '@yourgpt/llm-sdk/fireworks';
 * import { generateText } from '@yourgpt/llm-sdk';
 *
 * const result = await generateText({
 *   model: fireworks('accounts/fireworks/models/llama-v3p1-70b-instruct'),
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
// Provider Options
// ============================================

export interface FireworksProviderOptions {
  /** API key (defaults to FIREWORKS_API_KEY env var) */
  apiKey?: string;
  /** Base URL for API (defaults to https://api.fireworks.ai/inference/v1) */
  baseURL?: string;
}

// ============================================
// Provider Implementation
// ============================================

/**
 * Create a Fireworks language model.
 *
 * Model IDs follow the format `accounts/fireworks/models/{model-name}`.
 *
 * @param modelId - Full model ID or shorthand (e.g. 'accounts/fireworks/models/llama-v3p1-70b-instruct')
 * @param options - Provider options
 * @returns LanguageModel instance
 *
 * @example
 * ```ts
 * const model = fireworks('accounts/fireworks/models/llama-v3p1-70b-instruct');
 *
 * // With explicit API key
 * const model = fireworks('accounts/fireworks/models/deepseek-v3', {
 *   apiKey: 'fw_...',
 * });
 * ```
 */
export function fireworks(
  modelId: string,
  options: FireworksProviderOptions = {},
): LanguageModel {
  const apiKey = options.apiKey ?? process.env.FIREWORKS_API_KEY;
  const baseURL = options.baseURL ?? "https://api.fireworks.ai/inference/v1";

  // Lazy-load OpenAI client (Fireworks uses OpenAI-compatible API)
  let client: any = null;
  async function getClient(): Promise<any> {
    if (!client) {
      const { default: OpenAI } = await import("openai");
      client = new OpenAI({ apiKey, baseURL });
    }
    return client;
  }

  return {
    provider: "fireworks",
    modelId,

    capabilities: {
      supportsVision: false,
      supportsTools: true,
      supportsStreaming: true,
      supportsJsonMode: true,
      supportsThinking: false,
      supportsPDF: false,
      maxTokens: 131072,
      supportedImageTypes: [],
    },

    async doGenerate(params: DoGenerateParams): Promise<DoGenerateResult> {
      const client = await getClient();
      const messages = formatMessages(params.messages);

      const requestBody: any = {
        model: modelId,
        messages,
        temperature: params.temperature,
        max_tokens: params.maxTokens,
      };

      if (params.tools) {
        requestBody.tools = params.tools;
      }

      const response = await client.chat.completions.create(requestBody);
      const choice = response.choices[0];
      const message = choice.message;

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
      const messages = formatMessages(params.messages);

      const requestBody: any = {
        model: modelId,
        messages,
        temperature: params.temperature,
        max_tokens: params.maxTokens,
        stream: true,
      };

      if (params.tools) {
        requestBody.tools = params.tools;
      }

      const stream = await client.chat.completions.create(requestBody);

      // Track tool calls by index (Fireworks may repeat tc.id across chunks)
      const toolCallMap = new Map<
        number,
        { id: string; name: string; arguments: string }
      >();

      let totalPromptTokens = 0;
      let totalCompletionTokens = 0;

      for await (const chunk of stream) {
        if (params.signal?.aborted) {
          yield { type: "error", error: new Error("Aborted") };
          return;
        }

        const choice = chunk.choices[0];
        const delta = choice?.delta;

        if (delta?.content) {
          yield { type: "text-delta", text: delta.content };
        }

        if (delta?.tool_calls) {
          for (const tc of delta.tool_calls) {
            const idx = tc.index ?? 0;
            if (!toolCallMap.has(idx)) {
              toolCallMap.set(idx, {
                id: tc.id ?? "",
                name: tc.function?.name ?? "",
                arguments: tc.function?.arguments ?? "",
              });
            } else {
              const existing = toolCallMap.get(idx)!;
              if (tc.id && !existing.id) existing.id = tc.id;
              if (tc.function?.name && !existing.name)
                existing.name = tc.function.name;
              if (tc.function?.arguments)
                existing.arguments += tc.function.arguments;
            }
          }
        }

        if (choice?.finish_reason) {
          for (const [, tc] of toolCallMap) {
            yield {
              type: "tool-call",
              toolCall: {
                id: tc.id,
                name: tc.name,
                args: JSON.parse(tc.arguments || "{}"),
              },
            };
          }
          toolCallMap.clear();

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
// Helpers
// ============================================

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

function formatMessages(messages: CoreMessage[]): any[] {
  return messages.map((msg) => {
    switch (msg.role) {
      case "system":
        return { role: "system", content: msg.content };

      case "user":
        if (typeof msg.content === "string") {
          return { role: "user", content: msg.content };
        }
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

      case "assistant": {
        const assistantMsg: any = { role: "assistant", content: msg.content };
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
      }

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

// Alias for backward compatibility
export { fireworks as createFireworks };
