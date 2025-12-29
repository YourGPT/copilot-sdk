import type { LLMConfig, StreamEvent } from "@yourgpt/copilot-sdk-core";
import {
  generateMessageId,
  generateToolCallId,
} from "@yourgpt/copilot-sdk-core";
import type { LLMAdapter, ChatCompletionRequest } from "./base";
import { formatMessagesForOpenAI, formatTools } from "./base";

/**
 * OpenAI adapter configuration
 */
export interface OpenAIAdapterConfig extends Partial<LLMConfig> {
  apiKey: string;
  model?: string;
  baseUrl?: string;
}

/**
 * OpenAI LLM Adapter
 *
 * Supports: GPT-4, GPT-4o, GPT-3.5-turbo, etc.
 */
export class OpenAIAdapter implements LLMAdapter {
  readonly provider = "openai";
  readonly model: string;

  private client: any; // OpenAI client (lazy loaded)
  private config: OpenAIAdapterConfig;

  constructor(config: OpenAIAdapterConfig) {
    this.config = config;
    this.model = config.model || "gpt-4o";
  }

  private async getClient() {
    if (!this.client) {
      // Dynamic import to make openai optional
      const { default: OpenAI } = await import("openai");
      this.client = new OpenAI({
        apiKey: this.config.apiKey,
        baseURL: this.config.baseUrl,
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
            data?: string;
            url?: string;
            mimeType?: string;
          }>) {
            if (attachment.type === "image") {
              let imageUrl: string;

              if (attachment.url) {
                // Use URL directly (cloud storage)
                imageUrl = attachment.url;
              } else if (attachment.data) {
                // Use base64 data
                imageUrl = attachment.data.startsWith("data:")
                  ? attachment.data
                  : `data:${attachment.mimeType || "image/png"};base64,${attachment.data}`;
              } else {
                continue; // Skip if no data or URL
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
        code: "OPENAI_ERROR",
      };
    }
  }
}

/**
 * Create OpenAI adapter
 */
export function createOpenAIAdapter(
  config: OpenAIAdapterConfig,
): OpenAIAdapter {
  return new OpenAIAdapter(config);
}
