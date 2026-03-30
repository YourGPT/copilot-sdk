/**
 * Anthropic Provider - Modern Pattern
 *
 * @example
 * ```ts
 * import { anthropic } from '@yourgpt/llm-sdk/anthropic';
 * import { generateText } from '@yourgpt/llm-sdk';
 *
 * const result = await generateText({
 *   model: anthropic('claude-3-5-sonnet-20241022'),
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
// Model Definitions
// ============================================

interface AnthropicModelConfig {
  vision: boolean;
  tools: boolean;
  thinking: boolean;
  pdf: boolean;
  maxTokens: number;
}

const ANTHROPIC_MODELS: Record<string, AnthropicModelConfig> = {
  // Claude 4 series
  "claude-sonnet-4-20250514": {
    vision: true,
    tools: true,
    thinking: true,
    pdf: true,
    maxTokens: 200000,
  },
  "claude-opus-4-20250514": {
    vision: true,
    tools: true,
    thinking: true,
    pdf: true,
    maxTokens: 200000,
  },

  // Claude 3.7 series
  "claude-3-7-sonnet-20250219": {
    vision: true,
    tools: true,
    thinking: true,
    pdf: true,
    maxTokens: 200000,
  },
  "claude-3-7-sonnet-latest": {
    vision: true,
    tools: true,
    thinking: true,
    pdf: true,
    maxTokens: 200000,
  },

  // Claude 3.5 series
  "claude-3-5-sonnet-20241022": {
    vision: true,
    tools: true,
    thinking: false,
    pdf: true,
    maxTokens: 200000,
  },
  "claude-3-5-sonnet-latest": {
    vision: true,
    tools: true,
    thinking: false,
    pdf: true,
    maxTokens: 200000,
  },
  "claude-3-5-haiku-20241022": {
    vision: true,
    tools: true,
    thinking: false,
    pdf: false,
    maxTokens: 200000,
  },
  "claude-3-5-haiku-latest": {
    vision: true,
    tools: true,
    thinking: false,
    pdf: false,
    maxTokens: 200000,
  },

  // Claude 3 series
  "claude-3-opus-20240229": {
    vision: true,
    tools: true,
    thinking: false,
    pdf: false,
    maxTokens: 200000,
  },
  "claude-3-sonnet-20240229": {
    vision: true,
    tools: true,
    thinking: false,
    pdf: false,
    maxTokens: 200000,
  },
  "claude-3-haiku-20240307": {
    vision: true,
    tools: true,
    thinking: false,
    pdf: false,
    maxTokens: 200000,
  },
};

// ============================================
// Provider Options
// ============================================

export interface AnthropicProviderOptions {
  /** API key (defaults to ANTHROPIC_API_KEY env var) */
  apiKey?: string;
  /** Base URL for API */
  baseURL?: string;
  /** Enable extended thinking */
  thinking?: {
    enabled: boolean;
    budgetTokens?: number;
  };
}

// ============================================
// Provider Implementation
// ============================================

/**
 * Create an Anthropic language model
 */
export function anthropic(
  modelId: string,
  options: AnthropicProviderOptions = {},
): LanguageModel {
  const apiKey = options.apiKey ?? process.env.ANTHROPIC_API_KEY;

  // Lazy-load Anthropic client
  let client: any = null;
  async function getClient(): Promise<any> {
    if (!client) {
      const { default: Anthropic } = await import("@anthropic-ai/sdk");
      client = new Anthropic({
        apiKey,
        baseURL: options.baseURL,
      });
    }
    return client;
  }

  const modelConfig =
    ANTHROPIC_MODELS[modelId] ?? ANTHROPIC_MODELS["claude-3-5-sonnet-latest"];

  return {
    provider: "anthropic",
    modelId,

    capabilities: {
      supportsVision: modelConfig.vision,
      supportsTools: modelConfig.tools,
      supportsStreaming: true,
      supportsJsonMode: false,
      supportsThinking: modelConfig.thinking,
      supportsPDF: modelConfig.pdf,
      maxTokens: modelConfig.maxTokens,
      supportedImageTypes: modelConfig.vision
        ? ["image/png", "image/jpeg", "image/gif", "image/webp"]
        : [],
    },

    async doGenerate(params: DoGenerateParams): Promise<DoGenerateResult> {
      const client = await getClient();

      const { system, messages } = formatMessagesForAnthropic(params.messages);

      const requestOptions: any = {
        model: modelId,
        max_tokens: params.maxTokens ?? 4096,
        system: system || undefined,
        messages,
        tools: params.tools as any,
      };

      if (params.temperature !== undefined) {
        requestOptions.temperature = params.temperature;
      }

      // Add thinking if enabled
      if (options.thinking?.enabled && modelConfig.thinking) {
        requestOptions.thinking = {
          type: "enabled",
          budget_tokens: options.thinking.budgetTokens ?? 10000,
        };
      }

      const response = await client.messages.create(requestOptions);

      // Parse response
      let text = "";
      const toolCalls: ToolCall[] = [];

      for (const block of response.content) {
        if (block.type === "text") {
          text += block.text;
        } else if (block.type === "tool_use") {
          toolCalls.push({
            id: block.id,
            name: block.name,
            args: block.input as Record<string, unknown>,
          });
        }
      }

      return {
        text,
        toolCalls,
        finishReason: mapFinishReason(response.stop_reason),
        usage: {
          promptTokens: response.usage?.input_tokens ?? 0,
          completionTokens: response.usage?.output_tokens ?? 0,
          totalTokens:
            (response.usage?.input_tokens ?? 0) +
            (response.usage?.output_tokens ?? 0),
        },
        rawResponse: response,
      };
    },

    async *doStream(params: DoGenerateParams): AsyncGenerator<StreamChunk> {
      const client = await getClient();

      const { system, messages } = formatMessagesForAnthropic(params.messages);

      const requestOptions: any = {
        model: modelId,
        max_tokens: params.maxTokens ?? 4096,
        system: system || undefined,
        messages,
        tools: params.tools as any,
      };

      if (params.temperature !== undefined) {
        requestOptions.temperature = params.temperature;
      }

      if (options.thinking?.enabled && modelConfig.thinking) {
        requestOptions.thinking = {
          type: "enabled",
          budget_tokens: options.thinking.budgetTokens ?? 10000,
        };
      }

      const stream = await client.messages.stream(requestOptions);

      let currentToolUse: { id: string; name: string; input: string } | null =
        null;
      let inputTokens = 0;
      let outputTokens = 0;

      for await (const event of stream) {
        if (params.signal?.aborted) {
          yield { type: "error", error: new Error("Aborted") };
          return;
        }

        switch (event.type) {
          case "message_start":
            if (event.message?.usage) {
              inputTokens = event.message.usage.input_tokens ?? 0;
            }
            break;

          case "content_block_start":
            if (event.content_block?.type === "tool_use") {
              currentToolUse = {
                id: event.content_block.id,
                name: event.content_block.name,
                input: "",
              };
            }
            break;

          case "content_block_delta":
            if (event.delta?.type === "text_delta") {
              yield { type: "text-delta", text: event.delta.text };
            } else if (
              event.delta?.type === "input_json_delta" &&
              currentToolUse
            ) {
              currentToolUse.input += event.delta.partial_json;
            }
            break;

          case "content_block_stop":
            if (currentToolUse) {
              yield {
                type: "tool-call",
                toolCall: {
                  id: currentToolUse.id,
                  name: currentToolUse.name,
                  args: JSON.parse(currentToolUse.input || "{}"),
                },
              };
              currentToolUse = null;
            }
            break;

          case "message_delta":
            if (event.usage) {
              outputTokens = event.usage.output_tokens ?? 0;
            }
            if (event.delta?.stop_reason) {
              yield {
                type: "finish",
                finishReason: mapFinishReason(event.delta.stop_reason),
                usage: {
                  promptTokens: inputTokens,
                  completionTokens: outputTokens,
                  totalTokens: inputTokens + outputTokens,
                },
              };
            }
            break;
        }
      }
    },
  };
}

// ============================================
// Helper Functions
// ============================================

function mapFinishReason(reason: string | null): FinishReason {
  switch (reason) {
    case "end_turn":
    case "stop_sequence":
      return "stop";
    case "max_tokens":
      return "length";
    case "tool_use":
      return "tool-calls";
    default:
      return "unknown";
  }
}

function formatMessagesForAnthropic(messages: CoreMessage[]): {
  system: string;
  messages: any[];
} {
  let system = "";
  const formatted: any[] = [];
  const pendingToolResults: any[] = [];

  // Helper to flush pending tool results with validation
  const flushToolResults = () => {
    if (pendingToolResults.length === 0) return;

    const validResults = pendingToolResults.filter((tr) => {
      if (!tr.toolCallId) {
        console.warn("[llm-sdk] Skipping tool result with missing toolCallId");
        return false;
      }
      return true;
    });

    if (validResults.length > 0) {
      formatted.push({
        role: "user",
        content: validResults.map((tr) => ({
          type: "tool_result",
          tool_use_id: tr.toolCallId,
          content: tr.content,
        })),
      });
    }
    pendingToolResults.length = 0;
  };

  for (const msg of messages) {
    if (msg.role === "system") {
      system += (system ? "\n" : "") + msg.content;
      continue;
    }

    // Flush pending tool results before adding assistant messages
    if (msg.role === "assistant" && pendingToolResults.length > 0) {
      flushToolResults();
    }

    if (msg.role === "user") {
      // Flush pending tool results first
      flushToolResults();

      if (typeof msg.content === "string") {
        formatted.push({ role: "user", content: msg.content });
      } else {
        // Handle multimodal content
        const content: any[] = [];
        for (const part of msg.content) {
          if (part.type === "text") {
            content.push({ type: "text", text: part.text });
          } else if (part.type === "image") {
            const imageData =
              typeof part.image === "string"
                ? part.image
                : Buffer.from(part.image).toString("base64");

            if (imageData.startsWith("http")) {
              content.push({
                type: "image",
                source: { type: "url", url: imageData },
              });
            } else {
              const base64 = imageData.startsWith("data:")
                ? imageData.split(",")[1]
                : imageData;
              content.push({
                type: "image",
                source: {
                  type: "base64",
                  media_type: part.mimeType ?? "image/png",
                  data: base64,
                },
              });
            }
          }
        }
        formatted.push({ role: "user", content });
      }
    } else if (msg.role === "assistant") {
      const content: any[] = [];

      if (msg.content) {
        content.push({ type: "text", text: msg.content });
      }

      if (msg.toolCalls && msg.toolCalls.length > 0) {
        for (const tc of msg.toolCalls) {
          content.push({
            type: "tool_use",
            id: tc.id,
            name: tc.name,
            input: tc.args,
          });
        }
      }

      if (content.length > 0) {
        formatted.push({ role: "assistant", content });
      }
    } else if (msg.role === "tool") {
      // Handle both camelCase (SDK format) and snake_case (OpenAI format)
      const toolCallId =
        msg.toolCallId ?? (msg as any).tool_call_id ?? (msg as any).toolUseId;

      if (!toolCallId) {
        console.warn(
          "[llm-sdk] Tool message missing toolCallId, skipping:",
          msg,
        );
        continue;
      }

      pendingToolResults.push({
        toolCallId,
        content: msg.content,
      });
    }
  }

  // Flush any remaining tool results
  flushToolResults();

  return { system, messages: formatted };
}

export { anthropic as createAnthropic };
