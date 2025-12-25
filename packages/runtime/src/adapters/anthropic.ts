import type { LLMConfig, StreamEvent } from "@yourgpt/core";
import { generateMessageId } from "@yourgpt/core";
import type { LLMAdapter, ChatCompletionRequest } from "./base";
import {
  formatMessagesForAnthropic,
  messageToAnthropicContent,
  type AnthropicContentBlock,
} from "./base";

/**
 * Extended thinking configuration
 */
export interface ThinkingConfig {
  type: "enabled";
  /** Budget for thinking tokens (minimum 1024) */
  budgetTokens?: number;
}

/**
 * Anthropic adapter configuration
 */
export interface AnthropicAdapterConfig extends Partial<LLMConfig> {
  apiKey: string;
  model?: string;
  /** Enable extended thinking (for Claude 3.7 Sonnet, Claude 4) */
  thinking?: ThinkingConfig;
}

/**
 * Anthropic LLM Adapter
 *
 * Supports: Claude 3.5 Sonnet, Claude 3 Opus, Claude 3 Haiku, etc.
 */
export class AnthropicAdapter implements LLMAdapter {
  readonly provider = "anthropic";
  readonly model: string;

  private client: any; // Anthropic client (lazy loaded)
  private config: AnthropicAdapterConfig;

  constructor(config: AnthropicAdapterConfig) {
    this.config = config;
    this.model = config.model || "claude-3-5-sonnet-latest";
  }

  private async getClient() {
    if (!this.client) {
      // Dynamic import to make @anthropic-ai/sdk optional
      const { default: Anthropic } = await import("@anthropic-ai/sdk");
      this.client = new Anthropic({
        apiKey: this.config.apiKey,
      });
    }
    return this.client;
  }

  /**
   * Convert OpenAI-style messages to Anthropic format
   *
   * OpenAI format:
   * - { role: "assistant", content: "...", tool_calls: [...] }
   * - { role: "tool", tool_call_id: "...", content: "..." }
   *
   * Anthropic format:
   * - { role: "assistant", content: [{ type: "text", text: "..." }, { type: "tool_use", id: "...", name: "...", input: {...} }] }
   * - { role: "user", content: [{ type: "tool_result", tool_use_id: "...", content: "..." }] }
   */
  private convertToAnthropicMessages(
    rawMessages: Array<Record<string, unknown>>,
  ): Array<Record<string, unknown>> {
    const messages: Array<Record<string, unknown>> = [];
    const pendingToolResults: Array<{ tool_use_id: string; content: string }> =
      [];

    for (const msg of rawMessages) {
      // Skip system messages (handled separately)
      if (msg.role === "system") continue;

      if (msg.role === "assistant") {
        // Convert assistant message with potential tool_calls
        const content: Array<Record<string, unknown>> = [];

        // Add text content if present
        if (
          msg.content &&
          typeof msg.content === "string" &&
          msg.content.trim()
        ) {
          content.push({ type: "text", text: msg.content });
        }

        // Convert tool_calls to tool_use blocks
        const toolCalls = msg.tool_calls as
          | Array<{
              id: string;
              type: string;
              function: { name: string; arguments: string };
            }>
          | undefined;

        if (toolCalls && toolCalls.length > 0) {
          for (const tc of toolCalls) {
            let input = {};
            try {
              input = JSON.parse(tc.function.arguments);
            } catch {
              // Keep empty object if parse fails
            }
            content.push({
              type: "tool_use",
              id: tc.id,
              name: tc.function.name,
              input,
            });
          }
        }

        // Only add if there's content
        if (content.length > 0) {
          messages.push({ role: "assistant", content });
        }
      } else if (msg.role === "tool") {
        // Collect tool results to be bundled into a user message
        pendingToolResults.push({
          tool_use_id: msg.tool_call_id as string,
          content:
            typeof msg.content === "string"
              ? msg.content
              : JSON.stringify(msg.content),
        });
      } else if (msg.role === "user") {
        // First, flush any pending tool results as a user message
        if (pendingToolResults.length > 0) {
          messages.push({
            role: "user",
            content: pendingToolResults.map((tr) => ({
              type: "tool_result",
              tool_use_id: tr.tool_use_id,
              content: tr.content,
            })),
          });
          pendingToolResults.length = 0;
        }

        // Check if message has attachments (images)
        if (
          msg.attachments &&
          Array.isArray(msg.attachments) &&
          msg.attachments.length > 0
        ) {
          // Convert to Anthropic multimodal content format
          const content: Array<Record<string, unknown>> = [];

          // Add text content if present
          if (msg.content && typeof msg.content === "string") {
            content.push({ type: "text", text: msg.content });
          }

          // Add image attachments
          for (const attachment of msg.attachments as Array<{
            type: string;
            data: string;
            mimeType?: string;
          }>) {
            if (attachment.type === "image") {
              // Convert to Anthropic image format
              let base64Data = attachment.data;
              if (base64Data.startsWith("data:")) {
                // Extract base64 from data URL
                const commaIndex = base64Data.indexOf(",");
                if (commaIndex !== -1) {
                  base64Data = base64Data.slice(commaIndex + 1);
                }
              }
              content.push({
                type: "image",
                source: {
                  type: "base64",
                  media_type: attachment.mimeType || "image/png",
                  data: base64Data,
                },
              });
            }
          }

          messages.push({ role: "user", content });
        } else {
          // Add user message without attachments
          messages.push({
            role: "user",
            content:
              typeof msg.content === "string"
                ? msg.content
                : JSON.stringify(msg.content),
          });
        }
      }
    }

    // Flush any remaining tool results
    if (pendingToolResults.length > 0) {
      messages.push({
        role: "user",
        content: pendingToolResults.map((tr) => ({
          type: "tool_result",
          tool_use_id: tr.tool_use_id,
          content: tr.content,
        })),
      });
    }

    return messages;
  }

  async *stream(request: ChatCompletionRequest): AsyncGenerator<StreamEvent> {
    const client = await this.getClient();

    // Extract system message
    const systemMessage = request.systemPrompt || "";

    // Use raw messages if provided (for agent loop with tool calls)
    let messages: Array<Record<string, unknown>>;
    if (request.rawMessages && request.rawMessages.length > 0) {
      // Convert OpenAI-style messages to Anthropic format
      messages = this.convertToAnthropicMessages(request.rawMessages);
    } else {
      // Format from Message[] with multimodal support (images, attachments)
      const formatted = formatMessagesForAnthropic(request.messages, undefined);
      messages = formatted.messages as Array<Record<string, unknown>>;
    }

    // Convert actions to Anthropic tool format
    const tools = request.actions?.map((action) => ({
      name: action.name,
      description: action.description,
      input_schema: {
        type: "object" as const,
        properties: action.parameters
          ? Object.fromEntries(
              Object.entries(action.parameters).map(([key, param]) => [
                key,
                {
                  type: param.type,
                  description: param.description,
                  enum: param.enum,
                },
              ]),
            )
          : {},
        required: action.parameters
          ? Object.entries(action.parameters)
              .filter(([, param]) => param.required)
              .map(([key]) => key)
          : [],
      },
    }));

    const messageId = generateMessageId();

    // Emit message start
    yield { type: "message:start", id: messageId };

    try {
      // Build request options
      const requestOptions: Record<string, unknown> = {
        model: request.config?.model || this.model,
        max_tokens: request.config?.maxTokens || this.config.maxTokens || 4096,
        system: systemMessage,
        messages,
        tools: tools?.length ? tools : undefined,
      };

      // Add thinking configuration if enabled
      if (this.config.thinking?.type === "enabled") {
        requestOptions.thinking = {
          type: "enabled",
          budget_tokens: this.config.thinking.budgetTokens || 10000,
        };
      }

      const stream = await client.messages.stream(requestOptions);

      let currentToolUse: {
        id: string;
        name: string;
        input: string;
      } | null = null;

      let isInThinkingBlock = false;

      for await (const event of stream) {
        // Check for abort
        if (request.signal?.aborted) {
          break;
        }

        switch (event.type) {
          case "content_block_start":
            if (event.content_block.type === "tool_use") {
              currentToolUse = {
                id: event.content_block.id,
                name: event.content_block.name,
                input: "",
              };
              yield {
                type: "action:start",
                id: currentToolUse.id,
                name: currentToolUse.name,
              };
            } else if (event.content_block.type === "thinking") {
              // Start of thinking block
              isInThinkingBlock = true;
              yield { type: "thinking:start" };
            }
            break;

          case "content_block_delta":
            if (event.delta.type === "text_delta") {
              yield { type: "message:delta", content: event.delta.text };
            } else if (event.delta.type === "thinking_delta") {
              // Thinking content delta
              yield { type: "thinking:delta", content: event.delta.thinking };
            } else if (
              event.delta.type === "input_json_delta" &&
              currentToolUse
            ) {
              currentToolUse.input += event.delta.partial_json;
            }
            break;

          case "content_block_stop":
            if (currentToolUse) {
              yield {
                type: "action:args",
                id: currentToolUse.id,
                args: currentToolUse.input,
              };
              currentToolUse = null;
            }
            if (isInThinkingBlock) {
              yield { type: "thinking:end" };
              isInThinkingBlock = false;
            }
            break;

          case "message_stop":
            break;
        }
      }

      // Emit message end
      yield { type: "message:end" };
      yield { type: "done" };
    } catch (error) {
      yield {
        type: "error",
        message: error instanceof Error ? error.message : "Unknown error",
        code: "ANTHROPIC_ERROR",
      };
    }
  }
}

/**
 * Create Anthropic adapter
 */
export function createAnthropicAdapter(
  config: AnthropicAdapterConfig,
): AnthropicAdapter {
  return new AnthropicAdapter(config);
}
