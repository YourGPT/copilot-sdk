/**
 * Google Provider - OpenAI-Compatible
 *
 * Uses OpenAI SDK with Google's OpenAI-compatible endpoint.
 * BaseURL: https://generativelanguage.googleapis.com/v1beta/openai/
 *
 * @example
 * ```ts
 * import { google } from '@yourgpt/llm-sdk/google';
 * import { generateText } from '@yourgpt/llm-sdk';
 *
 * const result = await generateText({
 *   model: google('gemini-2.0-flash'),
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

interface GoogleModelConfig {
  vision: boolean;
  tools: boolean;
  audio: boolean;
  video: boolean;
  maxTokens: number;
}

const GOOGLE_MODELS: Record<string, GoogleModelConfig> = {
  // Gemini 2.5 (Experimental)
  "gemini-2.5-pro-preview-05-06": {
    vision: true,
    tools: true,
    audio: true,
    video: true,
    maxTokens: 1048576,
  },
  "gemini-2.5-flash-preview-05-20": {
    vision: true,
    tools: true,
    audio: true,
    video: true,
    maxTokens: 1048576,
  },

  // Gemini 2.0
  "gemini-2.0-flash": {
    vision: true,
    tools: true,
    audio: true,
    video: true,
    maxTokens: 1048576,
  },
  "gemini-2.0-flash-exp": {
    vision: true,
    tools: true,
    audio: true,
    video: true,
    maxTokens: 1048576,
  },
  "gemini-2.0-flash-lite": {
    vision: true,
    tools: true,
    audio: false,
    video: false,
    maxTokens: 1048576,
  },
  "gemini-2.0-flash-thinking-exp": {
    vision: true,
    tools: false,
    audio: false,
    video: false,
    maxTokens: 32767,
  },

  // Gemini 1.5
  "gemini-1.5-pro": {
    vision: true,
    tools: true,
    audio: true,
    video: true,
    maxTokens: 2097152,
  },
  "gemini-1.5-pro-latest": {
    vision: true,
    tools: true,
    audio: true,
    video: true,
    maxTokens: 2097152,
  },
  "gemini-1.5-flash": {
    vision: true,
    tools: true,
    audio: true,
    video: true,
    maxTokens: 1048576,
  },
  "gemini-1.5-flash-latest": {
    vision: true,
    tools: true,
    audio: true,
    video: true,
    maxTokens: 1048576,
  },
  "gemini-1.5-flash-8b": {
    vision: true,
    tools: true,
    audio: false,
    video: false,
    maxTokens: 1048576,
  },
};

// ============================================
// Provider Options
// ============================================

export interface GoogleProviderOptions {
  /** API key (defaults to GOOGLE_API_KEY or GEMINI_API_KEY env var) */
  apiKey?: string;
  /** Base URL for API (defaults to Google's OpenAI-compatible endpoint) */
  baseURL?: string;
}

// ============================================
// Provider Implementation
// ============================================

/**
 * Create a Google Gemini language model using OpenAI-compatible API
 *
 * @param modelId - Model ID (e.g., 'gemini-2.0-flash', 'gemini-1.5-pro')
 * @param options - Provider options
 * @returns LanguageModel instance
 *
 * @example
 * ```ts
 * // Basic usage
 * const model = google('gemini-2.0-flash');
 *
 * // With custom options
 * const model = google('gemini-1.5-pro', {
 *   apiKey: 'your-api-key',
 * });
 * ```
 */
export function google(
  modelId: string,
  options: GoogleProviderOptions = {},
): LanguageModel {
  const apiKey =
    options.apiKey ?? process.env.GOOGLE_API_KEY ?? process.env.GEMINI_API_KEY;
  const baseURL =
    options.baseURL ??
    "https://generativelanguage.googleapis.com/v1beta/openai/";

  // Lazy-load OpenAI client (Google uses OpenAI-compatible API)
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
  const modelConfig =
    GOOGLE_MODELS[modelId] ?? GOOGLE_MODELS["gemini-2.0-flash"];

  return {
    provider: "google",
    modelId,

    capabilities: {
      supportsVision: modelConfig.vision,
      supportsTools: modelConfig.tools,
      supportsStreaming: true,
      supportsJsonMode: true,
      supportsThinking: modelId.includes("thinking"),
      supportsPDF: true,
      maxTokens: modelConfig.maxTokens,
      supportedImageTypes: modelConfig.vision
        ? ["image/png", "image/jpeg", "image/gif", "image/webp"]
        : [],
    },

    async doGenerate(params: DoGenerateParams): Promise<DoGenerateResult> {
      const client = await getClient();

      const messages = formatMessagesForGoogle(params.messages);

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

      const messages = formatMessagesForGoogle(params.messages);

      const stream = await client.chat.completions.create({
        model: modelId,
        messages,
        tools: params.tools as any,
        temperature: params.temperature,
        max_tokens: params.maxTokens,
        response_format: toOpenAIResponseFormat(params.responseFormat),
        stream: true,
      });

      // Keyed by the streaming `index` used to demultiplex concurrent tool
      // calls. A single `currentToolCall` cannot represent parallel calls:
      // fragments for index 1 would be appended to index 0's arguments,
      // leaving both unparseable. Map preserves insertion order.
      const toolCallsByIndex = new Map<
        number,
        { id: string; name: string; arguments: string }
      >();

      // Emit every buffered call, then clear. Arguments that fail to parse
      // degrade to {} rather than throwing and killing the whole stream.
      function* flushToolCalls(): Generator<StreamChunk> {
        for (const call of toolCallsByIndex.values()) {
          let args: Record<string, unknown> = {};
          try {
            args = JSON.parse(call.arguments || "{}");
          } catch {
            args = {};
          }
          yield {
            type: "tool-call",
            toolCall: { id: call.id, name: call.name, args },
          } as StreamChunk;
        }
        toolCallsByIndex.clear();
      }

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
            // Servers that omit `index` only stream one call at a time, so
            // collapsing them onto slot 0 keeps that case working.
            const index = tc.index ?? 0;
            const existing = toolCallsByIndex.get(index);

            if (!existing) {
              toolCallsByIndex.set(index, {
                id: tc.id ?? "",
                name: tc.function?.name ?? "",
                arguments: tc.function?.arguments ?? "",
              });
            } else {
              // Continuations: id and name arrive once up front, arguments
              // arrive as fragments to append.
              if (tc.id && !existing.id) existing.id = tc.id;
              if (tc.function?.name && !existing.name) {
                existing.name = tc.function.name;
              }
              if (tc.function?.arguments) {
                existing.arguments += tc.function.arguments;
              }
            }
          }
        }

        // Finish reason
        if (choice?.finish_reason) {
          // Emit all pending tool calls
          yield* flushToolCalls();

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

      // Flush again after the loop: a stream ending without a terminal
      // finish_reason (truncation, abort) would otherwise silently drop
      // any tool calls still buffered.
      yield* flushToolCalls();
    },
  };
}

// ============================================
// Helper Functions
// ============================================

/**
 * Map finish reason to our FinishReason type
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
 * Format CoreMessage[] for Google's OpenAI-compatible API
 */
function formatMessagesForGoogle(messages: CoreMessage[]): any[] {
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

// Also export as createGoogle for backward compatibility
export { google as createGoogle };
