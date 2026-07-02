import type {
  LLMConfig,
  StreamEvent,
  WebSearchConfig,
  Citation,
  ToolDefinition,
} from "../core/stream-events";
import { generateMessageId } from "../core/utils";
import type {
  LLMAdapter,
  ChatCompletionRequest,
  CompletionResult,
} from "./base";
import {
  formatMessagesForAnthropic,
  messageToAnthropicContent,
  logProviderPayload,
  toAnthropicOutputConfig,
  parameterToJsonSchema,
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
export interface AnthropicAdapterConfig {
  apiKey: string;
  model?: string;
  /** Base URL for API endpoint */
  baseUrl?: string;
  /** Enable extended thinking (for Claude 3.7 Sonnet, Claude 4) */
  thinking?: ThinkingConfig;
  temperature?: number;
  maxTokens?: number;
  /**
   * Enable native web search for Claude.
   * When true, Claude can search the web to answer questions.
   */
  webSearch?: boolean | WebSearchConfig;
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

    // Track tool_use ids from assistant messages for inference
    let lastToolCallIds: string[] = [];
    let toolResultIndex = 0;

    for (const msg of rawMessages) {
      // Skip system messages (handled separately)
      if (msg.role === "system") continue;

      if (msg.role === "assistant") {
        // CRITICAL: Insert pending tool results BEFORE adding any assistant message
        // Anthropic requires: assistant(tool_use) → user(tool_result) → assistant(response)
        // Without this, the sequence becomes: assistant(tool_use) → assistant(response) → user(tool_result)
        // which violates Anthropic's API requirements and causes error:
        // "tool_use ids were found without tool_result blocks immediately after"
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
          // Clear tracking - tool results have been flushed, any subsequent
          // tool results without a new tool_use are orphaned
          lastToolCallIds = [];
          toolResultIndex = 0;
        }

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
          // Track tool call IDs for inferring missing tool_call_id in tool messages
          lastToolCallIds = toolCalls.map((tc) => tc.id);
          toolResultIndex = 0;

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
        let toolCallId = msg.tool_call_id as string | undefined;

        // If tool_call_id is missing, try to infer from preceding assistant's tool_calls
        if (!toolCallId && lastToolCallIds.length > 0) {
          toolCallId = lastToolCallIds[toolResultIndex];
          toolResultIndex++;
          console.warn(
            `[llm-sdk] Tool message missing tool_call_id, inferred: ${toolCallId}`,
          );
        }

        if (!toolCallId) {
          console.warn(
            "[llm-sdk] Skipping tool message with missing tool_call_id (no inference possible):",
            msg,
          );
          continue;
        }

        // Skip orphaned tool results (no pending tool_use to match)
        // This happens when there's a duplicate/stale tool result in the conversation
        if (lastToolCallIds.length === 0) {
          console.warn(
            `[llm-sdk] Skipping orphaned tool result (no pending tool_use): ${toolCallId}`,
          );
          continue;
        }

        // Skip if this tool_call_id is not in the expected list
        if (!lastToolCallIds.includes(toolCallId)) {
          console.warn(
            `[llm-sdk] Skipping tool result with unexpected tool_call_id: ${toolCallId}`,
          );
          continue;
        }

        pendingToolResults.push({
          tool_use_id: toolCallId,
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

          // Add attachments (images, PDFs)
          for (const attachment of msg.attachments as Array<{
            type: string;
            data?: string;
            url?: string;
            mimeType?: string;
          }>) {
            if (attachment.type === "image") {
              if (attachment.url) {
                // Use URL directly (cloud storage) - Anthropic supports URL sources
                content.push({
                  type: "image",
                  source: {
                    type: "url",
                    url: attachment.url,
                  },
                });
              } else if (attachment.data) {
                // Use base64 data
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
            } else if (
              attachment.type === "file" &&
              attachment.mimeType === "application/pdf"
            ) {
              // PDF documents - Anthropic uses "document" type
              if (attachment.url) {
                content.push({
                  type: "document",
                  source: {
                    type: "url",
                    url: attachment.url,
                  },
                });
              } else if (attachment.data) {
                let base64Data = attachment.data;
                if (base64Data.startsWith("data:")) {
                  const commaIndex = base64Data.indexOf(",");
                  if (commaIndex !== -1) {
                    base64Data = base64Data.slice(commaIndex + 1);
                  }
                }
                content.push({
                  type: "document",
                  source: {
                    type: "base64",
                    media_type: "application/pdf",
                    data: base64Data,
                  },
                });
              }
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

  private buildNativeSearchTools(
    tools: ToolDefinition[],
    variant: "bm25" | "regex" = "bm25",
  ): Array<Record<string, unknown>> {
    const nativeSearchTool =
      variant === "regex"
        ? {
            type: "tool_search_tool_regex_20251119",
            name: "tool_search_tool_regex",
          }
        : {
            type: "tool_search_tool_bm25_20251119",
            name: "tool_search_tool_bm25",
          };

    const providerTools = tools
      .filter((tool) => tool.available !== false)
      .map((tool) => ({
        name: tool.name,
        description: tool.description,
        input_schema: tool.inputSchema ?? {
          type: "object" as const,
          properties: {},
          required: [],
        },
        defer_loading: tool.deferLoading === true,
      }));

    return [nativeSearchTool, ...providerTools];
  }

  /**
   * Build common request options for both streaming and non-streaming
   */
  private buildRequestOptions(request: ChatCompletionRequest): {
    options: Record<string, unknown>;
    messages: Array<Record<string, unknown>>;
  } {
    // Extract system message; Anthropic has no schema-less JSON mode, so for
    // `responseFormat.type === "json_object"` we coerce via a system suffix.
    const responseFormat = request.config?.responseFormat;
    const jsonObjectSuffix =
      responseFormat?.type === "json_object"
        ? "\n\nRespond with a single JSON object and no other text."
        : "";
    const systemMessage = (request.systemPrompt || "") + jsonObjectSuffix;

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

    const anthropicNativeSearch =
      request.providerToolOptions?.anthropic?.nativeToolSearch;

    const tools: Array<Record<string, unknown>> = anthropicNativeSearch?.enabled
      ? this.buildNativeSearchTools(
          request.toolDefinitions ?? [],
          anthropicNativeSearch.variant,
        )
      : request.actions?.map((action) => ({
          name: action.name,
          description: action.description,
          input_schema: {
            type: "object" as const,
            properties: action.parameters
              ? Object.fromEntries(
                  Object.entries(action.parameters).map(([key, param]) => [
                    key,
                    parameterToJsonSchema(param),
                  ]),
                )
              : {},
            required: action.parameters
              ? Object.entries(action.parameters)
                  .filter(([, param]) => param.required)
                  .map(([key]) => key)
              : [],
          },
        })) || [];

    // Check for web search configuration (from request or adapter config)
    const webSearchConfig = request.webSearch ?? this.config.webSearch;
    let serverToolConfiguration: Record<string, unknown> | undefined;

    if (webSearchConfig) {
      // Add web_search tool (using latest API version)
      // allowed_callers: ["direct"] is required for Haiku models
      tools.push({
        type: "web_search_20260209",
        name: "web_search",
        allowed_callers: ["direct"],
      });

      // Build server tool configuration
      const wsConfig =
        typeof webSearchConfig === "object" ? webSearchConfig : {};
      const webSearchToolConfig: Record<string, unknown> = {};

      if (wsConfig.maxUses !== undefined) {
        webSearchToolConfig.max_uses = wsConfig.maxUses;
      }

      if (wsConfig.allowedDomains && wsConfig.allowedDomains.length > 0) {
        webSearchToolConfig.allowed_domains = wsConfig.allowedDomains;
      }

      if (wsConfig.blockedDomains && wsConfig.blockedDomains.length > 0) {
        webSearchToolConfig.blocked_domains = wsConfig.blockedDomains;
      }

      if (wsConfig.userLocation) {
        webSearchToolConfig.user_location = wsConfig.userLocation;
      }

      // Only add server_tool_configuration if we have any config
      if (Object.keys(webSearchToolConfig).length > 0) {
        serverToolConfiguration = {
          web_search: webSearchToolConfig,
        };
      }
    }

    // Build request options
    const options: Record<string, unknown> = {
      model: request.config?.model || this.model,
      max_tokens: request.config?.maxTokens || this.config.maxTokens || 4096,
      system: systemMessage,
      messages,
      tools: tools.length ? tools : undefined,
    };

    const anthropicToolOptions = request.providerToolOptions?.anthropic;
    if (tools.length > 0 && anthropicToolOptions) {
      if (
        anthropicToolOptions.toolChoice ||
        anthropicToolOptions.disableParallelToolUse !== undefined
      ) {
        const toolChoice: Record<string, unknown> =
          typeof anthropicToolOptions.toolChoice === "object"
            ? {
                type: "tool",
                name: anthropicToolOptions.toolChoice.name,
              }
            : anthropicToolOptions.toolChoice
              ? { type: anthropicToolOptions.toolChoice }
              : { type: "auto" };

        if (anthropicToolOptions.disableParallelToolUse !== undefined) {
          toolChoice.disable_parallel_tool_use =
            anthropicToolOptions.disableParallelToolUse;
        }

        options.tool_choice = toolChoice;
      }
    }

    // Add server tool configuration for web search
    if (serverToolConfiguration) {
      options.server_tool_configuration = serverToolConfiguration;
    }

    // Anthropic structured output (`output_config.format`) — GA on Claude API
    // and Bedrock as of late 2025. Vertex AI does not support it; users on
    // Vertex should use a forced-tool pattern via `actions` + `toolChoice`.
    const outputConfig = toAnthropicOutputConfig(responseFormat);
    if (outputConfig) {
      options.output_config = outputConfig;
    }

    // Add thinking configuration if enabled
    if (this.config.thinking?.type === "enabled") {
      options.thinking = {
        type: "enabled",
        budget_tokens: this.config.thinking.budgetTokens || 10000,
      };
    }

    return { options, messages };
  }

  /**
   * Non-streaming completion (for debugging/comparison with original studio-ai)
   */
  async complete(request: ChatCompletionRequest): Promise<CompletionResult> {
    const client = await this.getClient();
    const { options } = this.buildRequestOptions(request);

    // Ensure non-streaming mode
    const nonStreamingOptions = {
      ...options,
      stream: false as const,
    } as Record<string, unknown> & { stream: false };

    try {
      logProviderPayload(
        "anthropic",
        "request payload",
        nonStreamingOptions,
        request.debug,
      );
      const response = await client.messages.create(nonStreamingOptions);
      logProviderPayload(
        "anthropic",
        "response payload",
        response,
        request.debug,
      );

      // Parse response
      let content = "";
      let thinking = "";
      const toolCalls: Array<{
        id: string;
        name: string;
        args: Record<string, unknown>;
      }> = [];

      for (const block of response.content) {
        if (block.type === "text") {
          content += block.text;
        } else if (block.type === "thinking") {
          thinking += (block as { thinking: string }).thinking;
        } else if (block.type === "tool_use") {
          toolCalls.push({
            id: block.id,
            name: block.name,
            args: block.input as Record<string, unknown>,
          });
        }
      }

      // Map Anthropic's usage (input_tokens/output_tokens) to the SDK's camelCase shape,
      // matching the OpenAI adapter's complete(). Without this, complete() returned no usage,
      // so the non-streaming agent loop accumulated zero tokens and credit deduction was
      // skipped entirely for Anthropic models. Anthropic has no total_tokens, so sum it.
      return {
        content,
        toolCalls,
        thinking: thinking || undefined,
        usage: response.usage
          ? {
              promptTokens: response.usage.input_tokens ?? 0,
              completionTokens: response.usage.output_tokens ?? 0,
              totalTokens:
                (response.usage.input_tokens ?? 0) +
                (response.usage.output_tokens ?? 0),
            }
          : undefined,
        rawResponse: response as Record<string, unknown>,
      };
    } catch (error) {
      throw error;
    }
  }

  async *stream(request: ChatCompletionRequest): AsyncGenerator<StreamEvent> {
    const client = await this.getClient();
    const { options } = this.buildRequestOptions(request);

    const messageId = generateMessageId();

    // Emit message start
    yield { type: "message:start", id: messageId };

    try {
      logProviderPayload(
        "anthropic",
        "request payload",
        options,
        request.debug,
      );
      const stream = await client.messages.stream(options);

      let currentToolUse: {
        id: string;
        name: string;
        input: string;
      } | null = null;

      let isInThinkingBlock = false;

      // Track citations from web search
      const collectedCitations: Citation[] = [];
      let citationIndex = 0;

      // Track usage - Anthropic sends input_tokens in message_start and output_tokens in message_delta
      let usage:
        | {
            prompt_tokens: number;
            completion_tokens: number;
            total_tokens: number;
          }
        | undefined;

      for await (const event of stream) {
        logProviderPayload("anthropic", "stream event", event, request.debug);
        // Check for abort
        if (request.signal?.aborted) {
          break;
        }

        switch (event.type) {
          case "message_start":
            // Capture input tokens from message_start
            if (event.message?.usage) {
              usage = {
                prompt_tokens: event.message.usage.input_tokens,
                completion_tokens: 0,
                total_tokens: event.message.usage.input_tokens,
              };
            }
            break;

          case "message_delta":
            // Capture output tokens from message_delta
            if (event.usage && usage) {
              usage.completion_tokens = event.usage.output_tokens;
              usage.total_tokens =
                usage.prompt_tokens + event.usage.output_tokens;
            }
            break;

          case "content_block_start":
            if (event.content_block.type === "tool_use") {
              currentToolUse = {
                id: event.content_block.id,
                name: event.content_block.name,
                input: "",
              };
              // Don't emit action events for native web_search - citations handle the UI
              if (currentToolUse.name !== "web_search") {
                yield {
                  type: "action:start",
                  id: currentToolUse.id,
                  name: currentToolUse.name,
                };
              }
            } else if (event.content_block.type === "web_search_tool_result") {
              // Extract citations from web search results
              const webSearchResult = event.content_block as {
                type: "web_search_tool_result";
                tool_use_id: string;
                content: Array<{
                  type: "web_search_result";
                  title: string;
                  url: string;
                  page_age?: string | null;
                }>;
              };
              if (
                webSearchResult.content &&
                Array.isArray(webSearchResult.content)
              ) {
                for (const result of webSearchResult.content) {
                  if (result.type === "web_search_result" && result.url) {
                    citationIndex++;
                    const domain = extractDomain(result.url);
                    collectedCitations.push({
                      index: citationIndex,
                      url: result.url,
                      title: result.title || domain,
                      domain,
                      favicon: domain
                        ? `https://www.google.com/s2/favicons?domain=${domain}&sz=32`
                        : undefined,
                    });
                  }
                }
              }
              // Don't emit action:end for native web_search - citations handle the UI
            } else if (event.content_block.type === "thinking") {
              // Start of thinking block
              isInThinkingBlock = true;
              yield { type: "thinking:start" };
            }
            break;

          case "content_block_delta":
            if (event.delta.type === "text_delta") {
              yield { type: "message:delta", content: event.delta.text };
            } else if (event.delta.type === "citations_delta") {
              // Handle citations_delta events from web search
              const citationsDelta = event.delta as {
                type: "citations_delta";
                citation: {
                  type: string;
                  url?: string;
                  title?: string;
                  cited_text?: string;
                };
              };

              if (citationsDelta.citation?.url) {
                citationIndex++;
                const domain = extractDomain(citationsDelta.citation.url);
                collectedCitations.push({
                  index: citationIndex,
                  url: citationsDelta.citation.url,
                  title: citationsDelta.citation.title || domain,
                  citedText: citationsDelta.citation.cited_text,
                  domain,
                  favicon: domain
                    ? `https://www.google.com/s2/favicons?domain=${domain}&sz=32`
                    : undefined,
                });
              }
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
              // Don't emit action events for native web_search - citations handle the UI
              if (currentToolUse.name !== "web_search") {
                yield {
                  type: "action:args",
                  id: currentToolUse.id,
                  args: currentToolUse.input,
                };
                // For server-side tools, emit action:end immediately
                // as Anthropic handles execution and results come inline
                yield {
                  type: "action:end",
                  id: currentToolUse.id,
                  name: currentToolUse.name,
                };
              }
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

      // Emit citations if we collected any
      if (collectedCitations.length > 0) {
        // Deduplicate citations by URL
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
        code: "ANTHROPIC_ERROR",
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
 * Create Anthropic adapter
 */
export function createAnthropicAdapter(
  config: AnthropicAdapterConfig,
): AnthropicAdapter {
  return new AnthropicAdapter(config);
}
