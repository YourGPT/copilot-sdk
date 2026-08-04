import type {
  LLMConfig,
  StreamEvent,
  WebSearchConfig,
  Citation,
  ToolDefinition,
} from "../core/stream-events";
import { generateMessageId, generateToolCallId } from "../core/utils";
import type {
  LLMAdapter,
  ChatCompletionRequest,
  CompletionResult,
} from "./base";
import {
  buildOpenAITokenParams,
  formatMessagesForOpenAI,
  formatTools,
  isOpenAIReasoningModel,
  logProviderPayload,
  normalizeObjectJsonSchema,
  toOpenAIResponseFormat,
  toOpenAIResponsesTextFormat,
} from "./base";

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
  readonly provider: string;
  readonly model: string;

  private client: any; // OpenAI client (lazy loaded)
  private config: OpenAIAdapterConfig;

  constructor(config: OpenAIAdapterConfig) {
    this.config = config;
    this.model = config.model || "gpt-4o";
    this.provider = OpenAIAdapter.resolveProviderName(config.baseUrl);
  }

  private static resolveProviderName(baseUrl?: string): string {
    if (!baseUrl) return "openai";
    if (baseUrl.includes("generativelanguage.googleapis.com")) return "google";
    if (baseUrl.includes("x.ai")) return "xai";
    if (baseUrl.includes("azure")) return "azure";
    if (baseUrl.includes("fireworks.ai")) return "fireworks";
    return "openai";
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

  private shouldUseResponsesApi(request: ChatCompletionRequest): boolean {
    const hasTools =
      Array.isArray(request.toolDefinitions) &&
      request.toolDefinitions.length > 0;
    if (!hasTools) return false;

    // Native tool search is Responses-only — this is what the path was built for.
    if (
      request.providerToolOptions?.openai?.nativeToolSearch?.enabled === true &&
      request.providerToolOptions.openai.nativeToolSearch.useResponsesApi !==
        false
    ) {
      return true;
    }

    // gpt-5.4+ reject function tools on /v1/chat/completions whenever reasoning is
    // in play. Only two ways out: send reasoning_effort:'none' (which disables
    // reasoning entirely — a real quality loss on a model billed for reasoning), or
    // use /v1/responses, which supports tools WITH reasoning intact. We take the
    // latter.
    //
    // Why this is model-gated rather than always-on: only 5.4+ have the restriction,
    // and Chat Completions remains the better-tested path here (true token streaming,
    // vision/attachment handling). Routing everything to Responses would regress
    // those for no benefit.
    //
    // Note this fires even though the SDK never sets reasoning_effort: gpt-5.6
    // reasons BY DEFAULT, so the conflict is server-side and omitting the param
    // does not opt out. On <=5.5 omitting it was sufficient, which is why this only
    // began failing with 5.6.
    return this.requiresResponsesApiForTools(
      request.config?.model || this.model,
    );
  }

  /**
   * Whether this model rejects function tools on /v1/chat/completions.
   *
   * Applies to OpenAI proper only — the adapter is reused for OpenAI-compatible
   * providers (Azure, xAI, Google, Fireworks) whose endpoints have no such
   * restriction and may not implement /v1/responses at all.
   */
  private requiresResponsesApiForTools(modelId: string | undefined): boolean {
    if (!modelId) return false;
    // gpt-5.4, 5.5, 5.6, ... — but NOT gpt-5 / gpt-5.1 / gpt-5-chat.
    if (!/^gpt-5\.(?:[4-9]|\d{2,})/i.test(modelId)) return false;

    // Must be OpenAI's OWN endpoint. `this.provider` is NOT sufficient:
    // resolveProviderName defaults to "openai" for any unrecognised baseUrl, so
    // TogetherAI, LiteLLM/vLLM gateways and self-hosted proxies all report
    // "openai". Those speak Chat Completions and may not implement /v1/responses
    // at all — routing them there would turn a working call into a 404.
    // Check the URL itself, and treat only api.openai.com (or an unset baseUrl,
    // which the openai client resolves to api.openai.com) as OpenAI proper.
    const baseUrl = this.config.baseUrl;
    if (!baseUrl) return true;
    try {
      return new URL(baseUrl).hostname === "api.openai.com";
    } catch {
      return false;
    }
  }

  /**
   * Convert one message's content to Responses content parts.
   *
   * The Responses API does not accept Chat Completions content blocks: input
   * parts are `input_text` / `input_image` (with a bare `image_url` string)
   * rather than `text` / `image_url: { url }`. Passing the Chat Completions
   * shape through unchanged makes the API reject the request, so anything
   * array-shaped has to be translated rather than forwarded.
   */
  private toResponsesContent(
    content: unknown,
    role: "user" | "assistant" | "developer",
  ): unknown {
    const textType = role === "assistant" ? "output_text" : "input_text";

    if (typeof content === "string") return content;
    if (!Array.isArray(content)) {
      return content == null ? "" : JSON.stringify(content);
    }

    return content.map((part) => {
      const p = part as Record<string, any>;

      if (p?.type === "text") return { type: textType, text: p.text ?? "" };

      if (p?.type === "image_url") {
        // Chat Completions nests the URL under image_url.url; Responses wants
        // it flat. Data URIs and https URLs are both valid here.
        const url =
          typeof p.image_url === "string" ? p.image_url : p.image_url?.url;
        return {
          type: "input_image",
          image_url: url,
          ...(p.image_url?.detail ? { detail: p.image_url.detail } : {}),
        };
      }

      // Already in Responses shape (input_text/input_image/input_file) — keep.
      return p;
    });
  }

  private buildResponsesInput(
    request: ChatCompletionRequest,
  ): Array<Record<string, unknown>> {
    const sourceMessages =
      request.rawMessages && request.rawMessages.length > 0
        ? request.rawMessages
        : (formatMessagesForOpenAI(request.messages, undefined) as Array<
            Record<string, unknown>
          >);
    const input: Array<Record<string, unknown>> = [];

    for (const message of sourceMessages) {
      if (message.role === "system") {
        // `instructions` carries the system prompt, but a caller may instead
        // pass it as a message. Dropping it silently loses the prompt, so
        // forward it as a developer turn (the Responses equivalent) unless
        // instructions already covers it.
        if (!request.systemPrompt && message.content) {
          input.push({
            type: "message",
            role: "developer",
            content: this.toResponsesContent(message.content, "developer"),
          });
        }
        continue;
      }

      if (message.role === "assistant") {
        const content = this.toResponsesContent(message.content, "assistant");

        if (
          typeof content === "string"
            ? content
            : Array.isArray(content) && content.length > 0
        ) {
          input.push({
            type: "message",
            role: "assistant",
            content,
          });
        }

        const toolCalls = Array.isArray(message.tool_calls)
          ? (message.tool_calls as Array<{
              id: string;
              function?: { name?: string; arguments?: string };
            }>)
          : [];

        for (const toolCall of toolCalls) {
          input.push({
            type: "function_call",
            call_id: toolCall.id,
            name: toolCall.function?.name,
            arguments: toolCall.function?.arguments ?? "{}",
          });
        }
        continue;
      }

      if (message.role === "tool") {
        input.push({
          type: "function_call_output",
          call_id: message.tool_call_id,
          output:
            typeof message.content === "string"
              ? message.content
              : JSON.stringify(message.content ?? null),
        });
        continue;
      }

      const role = message.role === "developer" ? "developer" : "user";
      input.push({
        type: "message",
        role,
        content: this.toResponsesContent(message.content, role),
      });
    }

    return input;
  }

  /**
   * Build the web_search tool for the Responses API, or undefined when web
   * search is off.
   *
   * The Chat Completions path uses `web_search_preview`; the Responses API
   * names the same built-in `web_search`. Without this, enabling web search
   * alongside a gpt-5.4+ function tool silently did nothing, because routing
   * to /v1/responses skipped the Chat Completions tool assembly entirely.
   */
  private buildResponsesWebSearchTool(
    request: ChatCompletionRequest,
  ): Record<string, unknown> | undefined {
    const webSearchConfig = request.webSearch ?? this.config.webSearch;
    if (!webSearchConfig) return undefined;

    const tool: Record<string, unknown> = { type: "web_search" };
    const wsConfig = typeof webSearchConfig === "object" ? webSearchConfig : {};
    if (wsConfig.userLocation) {
      tool.search_context_size = "medium";
    }
    return tool;
  }

  /**
   * Extract url_citation annotations from Responses output items.
   *
   * Annotations hang off the output_text content parts rather than arriving as
   * their own stream events, so both the streaming and non-streaming paths read
   * them from the same place.
   */
  private collectResponsesCitations(
    output: unknown,
    startIndex = 0,
  ): Citation[] {
    if (!Array.isArray(output)) return [];
    const citations: Citation[] = [];
    let index = startIndex;

    for (const item of output as any[]) {
      if (item?.type !== "message" || !Array.isArray(item.content)) continue;
      for (const part of item.content as any[]) {
        if (!Array.isArray(part?.annotations)) continue;
        for (const annotation of part.annotations as any[]) {
          const url = annotation?.url;
          if (annotation?.type !== "url_citation" || !url) continue;
          index++;
          const domain = extractDomain(url);
          citations.push({
            index,
            url,
            title: annotation.title || domain,
            domain,
            favicon: domain
              ? `https://www.google.com/s2/favicons?domain=${domain}&sz=32`
              : undefined,
          });
        }
      }
    }
    return citations;
  }

  private buildResponsesTools(
    tools: ToolDefinition[],
    includeToolSearch: boolean,
    webSearchTool?: Record<string, unknown>,
  ): Array<Record<string, unknown>> {
    const nativeTools = tools
      .filter((tool) => tool.available !== false)
      .map((tool) => ({
        type: "function",
        name: tool.name,
        description: tool.description,
        parameters: normalizeObjectJsonSchema(
          (tool.inputSchema as Record<string, unknown> | undefined) ?? {
            type: "object",
            properties: {},
            required: [],
          },
        ),
        strict: true,
        defer_loading: tool.deferLoading === true,
      }));

    // The built-in tool_search tool belongs ONLY to the native-tool-search feature.
    // Reasoning-model routing reaches this path too, and sending tool_search there
    // would enable a capability the caller never asked for (and bill for it).
    const builtins: Array<Record<string, unknown>> = [];
    if (includeToolSearch) builtins.push({ type: "tool_search" });
    if (webSearchTool) builtins.push(webSearchTool);

    return [...builtins, ...nativeTools];
  }

  private parseResponsesResult(response: any): CompletionResult {
    // `output_text` is a convenience getter synthesized by the openai package,
    // NOT a wire field — a raw HTTP response has no such key. Derive the text
    // from the documented structure (output[].content[].text) so this keeps
    // working if the response arrives by any route other than the SDK object,
    // and fall back to the getter when present.
    const textFromOutput = Array.isArray(response?.output)
      ? response.output
          .filter((item: any) => item?.type === "message")
          .flatMap((item: any) =>
            Array.isArray(item.content)
              ? item.content
                  .filter(
                    (part: any) =>
                      part?.type === "output_text" &&
                      typeof part.text === "string",
                  )
                  .map((part: any) => part.text as string)
              : [],
          )
          .join("")
      : "";
    const content =
      textFromOutput ||
      (typeof response?.output_text === "string" ? response.output_text : "");

    const toolCalls = Array.isArray(response?.output)
      ? response.output
          .filter((item: any) => item?.type === "function_call")
          .map((item: any) => ({
            id: item.call_id ?? item.id ?? generateToolCallId(),
            name: item.name,
            args: (() => {
              try {
                return JSON.parse(item.arguments ?? "{}");
              } catch {
                return {};
              }
            })(),
          }))
      : [];

    return {
      content,
      toolCalls,
      usage: response?.usage
        ? {
            promptTokens: response.usage.input_tokens ?? 0,
            completionTokens: response.usage.output_tokens ?? 0,
            totalTokens:
              response.usage.total_tokens ??
              (response.usage.input_tokens ?? 0) +
                (response.usage.output_tokens ?? 0),
          }
        : undefined,
      rawResponse: response as Record<string, unknown>,
    };
  }

  private buildResponsesPayload(
    request: ChatCompletionRequest,
    stream: boolean,
  ): Record<string, unknown> {
    const openaiToolOptions = request.providerToolOptions?.openai;
    const responsesTextFormat = toOpenAIResponsesTextFormat(
      request.config?.responseFormat,
    );
    const modelIdForPayload = request.config?.model || this.model;
    const payload = {
      model: modelIdForPayload,
      instructions: request.systemPrompt,
      input: this.buildResponsesInput(request),
      tools: this.buildResponsesTools(
        request.toolDefinitions ?? [],
        request.providerToolOptions?.openai?.nativeToolSearch?.enabled === true,
        this.buildResponsesWebSearchTool(request),
      ),
      tool_choice:
        openaiToolOptions?.toolChoice === "required"
          ? "required"
          : openaiToolOptions?.toolChoice === "auto"
            ? "auto"
            : undefined,
      parallel_tool_calls: openaiToolOptions?.parallelToolCalls,
      // Reasoning models reject `temperature` outright — sending it would swap one
      // 400 for another. isOpenAIReasoningModel already encodes that family test.
      ...(isOpenAIReasoningModel(modelIdForPayload)
        ? {}
        : {
            temperature: request.config?.temperature ?? this.config.temperature,
          }),
      max_output_tokens: request.config?.maxTokens ?? this.config.maxTokens,
      ...(responsesTextFormat ? { text: { format: responsesTextFormat } } : {}),
      stream,
    };

    return payload;
  }

  private async completeWithResponses(
    request: ChatCompletionRequest,
  ): Promise<CompletionResult> {
    const client = await this.getClient();
    const payload = this.buildResponsesPayload(request, false);

    logProviderPayload("openai", "request payload", payload, request.debug);
    const response = await client.responses.create(payload);
    logProviderPayload("openai", "response payload", response, request.debug);

    return this.parseResponsesResult(response);
  }

  /**
   * Stream from /v1/responses as real SSE.
   *
   * The Responses API emits semantic events rather than Chat Completions
   * deltas, so the interesting ones are:
   *   response.output_text.delta       — incremental assistant text
   *   response.output_item.added       — a function_call item begins (name/id)
   *   response.function_call_arguments.delta / .done — tool arguments
   *   response.completed               — terminal, carries usage
   *
   * Tool calls are buffered and flushed as contiguous start→args→end triples
   * because the runtime pairs action:args with the action:end that follows it.
   */
  private async *streamWithResponses(
    request: ChatCompletionRequest,
  ): AsyncGenerator<StreamEvent> {
    const client = await this.getClient();
    const payload = this.buildResponsesPayload(request, true);
    logProviderPayload("openai", "request payload", payload, request.debug);

    const stream = await client.responses.create(payload);

    // Keyed by the output_index the API uses to demultiplex concurrent items.
    const toolCalls = new Map<
      number,
      { id: string; name: string; arguments: string }
    >();
    let usage:
      | {
          prompt_tokens: number;
          completion_tokens: number;
          total_tokens: number;
        }
      | undefined;
    const citations: Citation[] = [];

    function* flushToolCalls(): Generator<StreamEvent> {
      for (const call of toolCalls.values()) {
        yield { type: "action:start", id: call.id, name: call.name };
        yield { type: "action:args", id: call.id, args: call.arguments };
        yield { type: "action:end", id: call.id, name: call.name };
      }
      toolCalls.clear();
    }

    for await (const event of stream as AsyncIterable<any>) {
      if (request.signal?.aborted) break;
      logProviderPayload("openai", "stream chunk", event, request.debug);

      const index: number = event?.output_index ?? 0;

      switch (event?.type) {
        case "response.output_text.delta":
          if (event.delta) {
            yield { type: "message:delta", content: event.delta };
          }
          break;

        case "response.output_item.added":
          if (event.item?.type === "function_call") {
            toolCalls.set(index, {
              id: event.item.call_id ?? event.item.id ?? generateToolCallId(),
              name: event.item.name ?? "",
              arguments: event.item.arguments ?? "",
            });
          }
          break;

        case "response.function_call_arguments.delta": {
          const existing = toolCalls.get(index);
          if (existing && event.delta) existing.arguments += event.delta;
          break;
        }

        case "response.function_call_arguments.done": {
          // Authoritative full argument string — prefer it over accumulation.
          const existing = toolCalls.get(index);
          if (existing && typeof event.arguments === "string") {
            existing.arguments = event.arguments;
          }
          break;
        }

        case "response.completed":
        case "response.incomplete": {
          // Citations ride on the output_text annotations rather than arriving
          // as their own events, so harvest them from the terminal payload.
          const found = this.collectResponsesCitations(
            event.response?.output,
            citations.length,
          );
          if (found.length > 0) citations.push(...found);

          const u = event.response?.usage;
          if (u) {
            usage = {
              prompt_tokens: u.input_tokens ?? 0,
              completion_tokens: u.output_tokens ?? 0,
              total_tokens:
                u.total_tokens ??
                (u.input_tokens ?? 0) + (u.output_tokens ?? 0),
            };
          }
          break;
        }

        case "error":
        case "response.failed":
          throw new Error(
            event.message ??
              event.response?.error?.message ??
              "Responses stream failed",
          );
      }
    }

    // Flush after the loop so a stream that ends without a terminal event
    // still emits its tool calls rather than dropping them.
    yield* flushToolCalls();

    if (citations.length > 0) {
      yield { type: "citation", citations: deduplicateCitations(citations) };
    }

    yield { type: "message:end" };
    yield { type: "done", usage };
  }

  async *stream(request: ChatCompletionRequest): AsyncGenerator<StreamEvent> {
    if (this.shouldUseResponsesApi(request)) {
      const messageId = generateMessageId();
      yield { type: "message:start", id: messageId };

      try {
        // Real SSE. action:end is emitted per tool call inside — it is REQUIRED,
        // not decorative: Runtime.processChatWithLoop invokes server-side tool
        // handlers exclusively in its `case "action:end"` branch. Without it a
        // server tool never executes, never lands in serverToolResults, and is
        // then misclassified as a client tool — the runtime suspends with
        // requiresAction and dispatches it to a browser that has no such tool,
        // hanging the turn forever.
        yield* this.streamWithResponses(request);
        return;
      } catch (error) {
        yield {
          type: "error",
          message: error instanceof Error ? error.message : "Unknown error",
          code: "OPENAI_RESPONSES_ERROR",
        };
        return;
      }
    }

    const client = await this.getClient();

    // Use raw messages if provided (for agent loop with tool calls), otherwise format from Message[]
    let messages: Array<Record<string, unknown>>;
    if (request.rawMessages && request.rawMessages.length > 0) {
      // Process raw messages - convert any attachments to OpenAI vision format
      const processedMessages = request.rawMessages.map((msg) => {
        // Normalize assistant messages with tool_calls: empty string content → null
        // Gemini/xAI (OpenAI-compatible) reject content: "" on assistant messages with tool_calls
        if (
          msg.role === "assistant" &&
          Array.isArray(msg.tool_calls) &&
          msg.tool_calls.length > 0 &&
          msg.content === ""
        ) {
          return { ...msg, content: null };
        }

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
      const openaiToolOptions = request.providerToolOptions?.openai;
      const toolChoice =
        openaiToolOptions?.toolChoice &&
        typeof openaiToolOptions.toolChoice === "object"
          ? {
              type: "function" as const,
              function: {
                name: openaiToolOptions.toolChoice.name,
              },
            }
          : openaiToolOptions?.toolChoice;
      const modelIdForPayload = request.config?.model || this.model;
      const payload = {
        model: modelIdForPayload,
        messages,
        tools: tools.length > 0 ? tools : undefined,
        tool_choice: tools.length > 0 ? toolChoice : undefined,
        parallel_tool_calls:
          tools.length > 0 ? openaiToolOptions?.parallelToolCalls : undefined,
        ...buildOpenAITokenParams(
          modelIdForPayload,
          request.config?.maxTokens ?? this.config.maxTokens,
          request.config?.temperature ?? this.config.temperature,
        ),
        response_format: toOpenAIResponseFormat(request.config?.responseFormat),
        stream: true,
        stream_options: { include_usage: true },
      };
      logProviderPayload("openai", "request payload", payload, request.debug);
      const stream = await client.chat.completions.create(payload);

      let currentToolCall: {
        id: string;
        name: string;
        arguments: string;
        extra_content?: Record<string, unknown>;
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
        logProviderPayload("openai", "stream chunk", chunk, request.debug);
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
                yield {
                  type: "action:end",
                  id: currentToolCall.id,
                  name: currentToolCall.name,
                };
              }

              const tcExtraContent = (toolCall as any).extra_content as
                | Record<string, unknown>
                | undefined;

              currentToolCall = {
                id: toolCall.id,
                name: toolCall.function?.name || "",
                arguments: toolCall.function?.arguments || "",
                ...(tcExtraContent ? { extra_content: tcExtraContent } : {}),
              };

              yield {
                type: "action:start",
                id: currentToolCall.id,
                name: currentToolCall.name,
                ...(currentToolCall.extra_content
                  ? { extra_content: currentToolCall.extra_content }
                  : {}),
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
            yield {
              type: "action:end",
              id: currentToolCall.id,
              name: currentToolCall.name,
            };
            currentToolCall = null;
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
        code: `${this.provider.toUpperCase()}_ERROR`,
      };
    }
  }

  async complete(request: ChatCompletionRequest): Promise<CompletionResult> {
    if (this.shouldUseResponsesApi(request)) {
      return this.completeWithResponses(request);
    }

    const client = await this.getClient();

    let messages: Array<Record<string, unknown>>;
    if (request.rawMessages && request.rawMessages.length > 0) {
      const sanitized = request.rawMessages.map((msg) => {
        // Gemini/xAI (OpenAI-compatible) reject content: "" on assistant messages with tool_calls
        if (
          msg.role === "assistant" &&
          Array.isArray(msg.tool_calls) &&
          msg.tool_calls.length > 0 &&
          msg.content === ""
        ) {
          return { ...msg, content: null };
        }
        return msg;
      });
      if (
        request.systemPrompt &&
        !sanitized.some((message) => message.role === "system")
      ) {
        messages = [
          { role: "system", content: request.systemPrompt },
          ...sanitized,
        ];
      } else {
        messages = sanitized;
      }
    } else {
      messages = formatMessagesForOpenAI(
        request.messages,
        request.systemPrompt,
      ) as Array<Record<string, unknown>>;
    }

    const tools: Array<Record<string, unknown>> = request.actions?.length
      ? formatTools(request.actions)
      : [];

    const openaiToolOptions = request.providerToolOptions?.openai;
    const toolChoice =
      openaiToolOptions?.toolChoice &&
      typeof openaiToolOptions.toolChoice === "object"
        ? {
            type: "function" as const,
            function: {
              name: openaiToolOptions.toolChoice.name,
            },
          }
        : openaiToolOptions?.toolChoice;

    const modelIdForCompletePayload = request.config?.model || this.model;
    const payload = {
      model: modelIdForCompletePayload,
      messages,
      tools: tools.length > 0 ? tools : undefined,
      tool_choice: tools.length > 0 ? toolChoice : undefined,
      parallel_tool_calls:
        tools.length > 0 ? openaiToolOptions?.parallelToolCalls : undefined,
      ...buildOpenAITokenParams(
        modelIdForCompletePayload,
        request.config?.maxTokens ?? this.config.maxTokens,
        request.config?.temperature ?? this.config.temperature,
      ),
      response_format: toOpenAIResponseFormat(request.config?.responseFormat),
      stream: false,
    };

    logProviderPayload("openai", "request payload", payload, request.debug);
    const response = await client.chat.completions.create(payload);
    logProviderPayload("openai", "response payload", response, request.debug);

    const choice = response.choices?.[0];
    const message = choice?.message;
    return {
      content: message?.content ?? "",
      toolCalls:
        message?.tool_calls?.map((toolCall: any) => ({
          id: toolCall.id ?? generateToolCallId(),
          name: toolCall.function?.name ?? "",
          args: (() => {
            try {
              return JSON.parse(toolCall.function?.arguments ?? "{}");
            } catch {
              return {};
            }
          })(),
          ...(toolCall.extra_content
            ? { extra_content: toolCall.extra_content }
            : {}),
        })) ?? [],
      usage: response.usage
        ? {
            promptTokens: response.usage.prompt_tokens,
            completionTokens: response.usage.completion_tokens,
            totalTokens: response.usage.total_tokens,
          }
        : undefined,
      rawResponse: response as Record<string, unknown>,
    };
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
