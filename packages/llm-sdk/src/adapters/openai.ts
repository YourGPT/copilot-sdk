import type {
  LLMConfig,
  StreamEvent,
  WebSearchConfig,
  Citation,
} from "../core/stream-events";
import { generateMessageId, generateToolCallId } from "../core/utils";
import type { LLMAdapter, ChatCompletionRequest } from "./base";
import { formatMessagesForOpenAI, formatTools } from "./base";

/**
 * OpenAI adapter configuration
 */
export interface OpenAIAdapterConfig {
  apiKey: string;
  model?: string;
  baseUrl?: string;
  temperature?: number;
  maxTokens?: number;
  /**
   * Enable native web search for GPT models.
   * Uses OpenAI's web_search_preview tool.
   */
  webSearch?: boolean | WebSearchConfig;
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

    // Build tools array
    const tools: Array<Record<string, unknown>> = request.actions?.length
      ? formatTools(request.actions)
      : [];

    // Check for web search configuration (from request or adapter config)
    const webSearchConfig = request.webSearch ?? this.config.webSearch;

    if (webSearchConfig) {
      // Add web_search_preview tool for OpenAI
      const webSearchTool: Record<string, unknown> = {
        type: "web_search_preview",
      };

      // Add search context config if provided
      const wsConfig =
        typeof webSearchConfig === "object" ? webSearchConfig : {};

      if (wsConfig.userLocation) {
        webSearchTool.search_context_size = "medium"; // OpenAI uses size, not location
      }

      tools.push(webSearchTool);
    }

    const messageId = generateMessageId();

    // Emit message start
    yield { type: "message:start", id: messageId };

    try {
      const stream = await client.chat.completions.create({
        model: request.config?.model || this.model,
        messages,
        tools: tools.length > 0 ? tools : undefined,
        temperature: request.config?.temperature ?? this.config.temperature,
        max_tokens: request.config?.maxTokens ?? this.config.maxTokens,
        stream: true,
        stream_options: { include_usage: true },
      });

      let currentToolCall: {
        id: string;
        name: string;
        arguments: string;
      } | null = null;

      // Track citations from web search
      const collectedCitations: Citation[] = [];
      let citationIndex = 0;

      let usage:
        | {
            prompt_tokens: number;
            completion_tokens: number;
            total_tokens: number;
          }
        | undefined;

      for await (const chunk of stream) {
        // Check for abort
        if (request.signal?.aborted) {
          break;
        }

        const delta = chunk.choices[0]?.delta;
        const choice = chunk.choices[0];

        // Handle content
        if (delta?.content) {
          yield { type: "message:delta", content: delta.content };
        }

        // Handle annotations (citations from web search) - OpenAI includes these in delta
        const annotations = (
          delta as {
            annotations?: Array<{
              type: string;
              url_citation?: { url: string; title?: string };
            }>;
          }
        )?.annotations;

        if (annotations && annotations.length > 0) {
          for (const annotation of annotations) {
            if (
              annotation.type === "url_citation" &&
              annotation.url_citation?.url
            ) {
              citationIndex++;
              const url = annotation.url_citation.url;
              const domain = extractDomain(url);
              collectedCitations.push({
                index: citationIndex,
                url,
                title: annotation.url_citation.title || domain,
                domain,
                favicon: domain
                  ? `https://www.google.com/s2/favicons?domain=${domain}&sz=32`
                  : undefined,
              });
            }
          }
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

        // Capture usage from final chunk (OpenAI sends it with stream_options.include_usage)
        if (chunk.usage) {
          usage = {
            prompt_tokens: chunk.usage.prompt_tokens,
            completion_tokens: chunk.usage.completion_tokens,
            total_tokens: chunk.usage.total_tokens,
          };
        }

        // Check for finish
        if (choice?.finish_reason) {
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

      // Emit citations if we collected any
      if (collectedCitations.length > 0) {
        const uniqueCitations = deduplicateCitations(collectedCitations);
        yield { type: "citation", citations: uniqueCitations };
      }

      // Emit message end
      yield { type: "message:end" };
      yield { type: "done", usage };
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
 * Extract domain from URL
 */
function extractDomain(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname;
  } catch {
    return "";
  }
}

/**
 * Deduplicate citations by URL
 */
function deduplicateCitations(citations: Citation[]): Citation[] {
  const seen = new Map<string, Citation>();
  let index = 0;
  for (const citation of citations) {
    if (!seen.has(citation.url)) {
      index++;
      seen.set(citation.url, { ...citation, index });
    }
  }
  return Array.from(seen.values());
}

/**
 * Create OpenAI adapter
 */
export function createOpenAIAdapter(
  config: OpenAIAdapterConfig,
): OpenAIAdapter {
  return new OpenAIAdapter(config);
}
