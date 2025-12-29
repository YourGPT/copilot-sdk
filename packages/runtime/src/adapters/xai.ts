/**
 * xAI Grok LLM Adapter
 *
 * xAI uses an OpenAI-compatible API, so this adapter extends OpenAIAdapter
 * with a different base URL.
 *
 * Supports: Grok-2, Grok-2-mini, Grok-beta
 * Features: Vision, Tools/Function Calling
 */

import type { LLMConfig, StreamEvent } from "@yourgpt/copilot-sdk-core";
import {
  generateMessageId,
  generateToolCallId,
} from "@yourgpt/copilot-sdk-core";
import type {
  LLMAdapter,
  ChatCompletionRequest,
  CompletionResult,
} from "./base";
import { formatMessagesForOpenAI, formatTools } from "./base";

// ============================================
// Types
// ============================================

/**
 * xAI adapter configuration
 */
export interface XAIAdapterConfig extends Partial<LLMConfig> {
  apiKey: string;
  model?: string;
  baseUrl?: string;
}

// Default xAI API endpoint
const XAI_BASE_URL = "https://api.x.ai/v1";

// ============================================
// Adapter Implementation
// ============================================

/**
 * xAI Grok LLM Adapter
 *
 * Uses OpenAI-compatible API with xAI's endpoint
 */
export class XAIAdapter implements LLMAdapter {
  readonly provider = "xai";
  readonly model: string;

  private client: any; // OpenAI client (lazy loaded)
  private config: XAIAdapterConfig;

  constructor(config: XAIAdapterConfig) {
    this.config = config;
    this.model = config.model || "grok-2";
  }

  private async getClient() {
    if (!this.client) {
      // Use OpenAI SDK with xAI base URL
      const { default: OpenAI } = await import("openai");
      this.client = new OpenAI({
        apiKey: this.config.apiKey,
        baseURL: this.config.baseUrl || XAI_BASE_URL,
      });
    }
    return this.client;
  }

  async *stream(request: ChatCompletionRequest): AsyncGenerator<StreamEvent> {
    const client = await this.getClient();

    // Use raw messages if provided (for agent loop with tool calls), otherwise format from Message[]
    let messages: Array<Record<string, unknown>>;
    if (request.rawMessages && request.rawMessages.length > 0) {
      // Process raw messages - convert any attachments to OpenAI vision format
      const processedMessages = request.rawMessages.map((msg) => {
        // Check if message has attachments (images)
        const hasAttachments =
          msg.attachments &&
          Array.isArray(msg.attachments) &&
          msg.attachments.length > 0;

        if (hasAttachments) {
          // Convert to OpenAI multimodal content format
          const content: Array<Record<string, unknown>> = [];

          // Add text content if present
          if (msg.content) {
            content.push({ type: "text", text: msg.content });
          }

          // Add image attachments
          for (const attachment of msg.attachments as Array<{
            type: string;
            data: string;
            mimeType?: string;
          }>) {
            if (attachment.type === "image") {
              // Convert to OpenAI image_url format
              let imageUrl = attachment.data;
              if (!imageUrl.startsWith("data:")) {
                imageUrl = `data:${attachment.mimeType || "image/png"};base64,${attachment.data}`;
              }
              content.push({
                type: "image_url",
                image_url: { url: imageUrl, detail: "auto" },
              });
            }
          }

          return { ...msg, content, attachments: undefined };
        }
        return msg;
      });

      // Add system prompt at the start if provided and not already present
      if (request.systemPrompt) {
        const hasSystem = processedMessages.some((m) => m.role === "system");
        if (!hasSystem) {
          messages = [
            { role: "system", content: request.systemPrompt },
            ...processedMessages,
          ];
        } else {
          messages = processedMessages;
        }
      } else {
        messages = processedMessages;
      }
    } else {
      // Format from Message[] with multimodal support (images, attachments)
      messages = formatMessagesForOpenAI(
        request.messages,
        request.systemPrompt,
      ) as Array<Record<string, unknown>>;
    }

    const tools = request.actions?.length
      ? formatTools(request.actions)
      : undefined;

    const messageId = generateMessageId();

    // Emit message start
    yield { type: "message:start", id: messageId };

    try {
      const stream = await client.chat.completions.create({
        model: request.config?.model || this.model,
        messages,
        tools,
        temperature: request.config?.temperature ?? this.config.temperature,
        max_tokens: request.config?.maxTokens ?? this.config.maxTokens,
        stream: true,
      });

      let currentToolCall: {
        id: string;
        name: string;
        arguments: string;
      } | null = null;

      for await (const chunk of stream) {
        // Check for abort
        if (request.signal?.aborted) {
          break;
        }

        const delta = chunk.choices[0]?.delta;

        // Handle content
        if (delta?.content) {
          yield { type: "message:delta", content: delta.content };
        }

        // Handle tool calls
        if (delta?.tool_calls) {
          for (const toolCall of delta.tool_calls) {
            // New tool call
            if (toolCall.id) {
              // End previous tool call if any
              if (currentToolCall) {
                yield {
                  type: "action:args",
                  id: currentToolCall.id,
                  args: currentToolCall.arguments,
                };
              }

              currentToolCall = {
                id: toolCall.id,
                name: toolCall.function?.name || "",
                arguments: toolCall.function?.arguments || "",
              };

              yield {
                type: "action:start",
                id: currentToolCall.id,
                name: currentToolCall.name,
              };
            } else if (currentToolCall && toolCall.function?.arguments) {
              // Append to current tool call arguments
              currentToolCall.arguments += toolCall.function.arguments;
            }
          }
        }

        // Check for finish
        if (chunk.choices[0]?.finish_reason) {
          // Complete any pending tool call
          if (currentToolCall) {
            yield {
              type: "action:args",
              id: currentToolCall.id,
              args: currentToolCall.arguments,
            };
          }
        }
      }

      // Emit message end
      yield { type: "message:end" };
      yield { type: "done" };
    } catch (error) {
      yield {
        type: "error",
        message: error instanceof Error ? error.message : "Unknown error",
        code: "XAI_ERROR",
      };
    }
  }

  /**
   * Non-streaming completion (optional, for debugging)
   */
  async complete(request: ChatCompletionRequest): Promise<CompletionResult> {
    const client = await this.getClient();

    let messages: Array<Record<string, unknown>>;
    if (request.rawMessages && request.rawMessages.length > 0) {
      messages = request.rawMessages as Array<Record<string, unknown>>;
      if (request.systemPrompt) {
        const hasSystem = messages.some((m) => m.role === "system");
        if (!hasSystem) {
          messages = [
            { role: "system", content: request.systemPrompt },
            ...messages,
          ];
        }
      }
    } else {
      messages = formatMessagesForOpenAI(
        request.messages,
        request.systemPrompt,
      ) as Array<Record<string, unknown>>;
    }

    const tools = request.actions?.length
      ? formatTools(request.actions)
      : undefined;

    const response = await client.chat.completions.create({
      model: request.config?.model || this.model,
      messages,
      tools,
      temperature: request.config?.temperature ?? this.config.temperature,
      max_tokens: request.config?.maxTokens ?? this.config.maxTokens,
    });

    const choice = response.choices[0];
    const message = choice?.message;

    const toolCalls = (message?.tool_calls || []).map((tc: any) => ({
      id: tc.id,
      name: tc.function.name,
      args: JSON.parse(tc.function.arguments || "{}"),
    }));

    return {
      content: message?.content || "",
      toolCalls,
      rawResponse: response as Record<string, unknown>,
    };
  }
}

/**
 * Create xAI Grok adapter
 */
export function createXAIAdapter(config: XAIAdapterConfig): XAIAdapter {
  return new XAIAdapter(config);
}
