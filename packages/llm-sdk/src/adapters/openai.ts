import type {
  LLMConfig,
  StreamEvent,
  WebSearchConfig,
  Citation,
  ToolDefinition,
  ActionDefinition,
} from "../core/stream-events";
import { generateMessageId, generateToolCallId } from "../core/utils";
import type {
  LLMAdapter,
  ChatCompletionRequest,
  CompletionResult,
} from "./base";
import {
  formatMessagesForOpenAI,
  formatTools,
  logProviderPayload,
  normalizeObjectJsonSchema,
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
  /** Disable extended thinking/reasoning for OpenRouter models */
  disableThinking?: boolean;
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
    if (baseUrl.includes("openrouter.ai")) return "openrouter";
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
    return (
      request.providerToolOptions?.openai?.nativeToolSearch?.enabled === true &&
      request.providerToolOptions.openai.nativeToolSearch.useResponsesApi !==
        false &&
      Array.isArray(request.toolDefinitions) &&
      request.toolDefinitions.length > 0
    );
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
        continue;
      }

      if (message.role === "assistant") {
        const content =
          typeof message.content === "string"
            ? message.content
            : Array.isArray(message.content)
              ? message.content
              : message.content
                ? JSON.stringify(message.content)
                : "";

        if (content) {
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

      input.push({
        type: "message",
        role: message.role === "developer" ? "developer" : "user",
        content:
          typeof message.content === "string"
            ? message.content
            : Array.isArray(message.content)
              ? message.content
              : JSON.stringify(message.content ?? ""),
      });
    }

    return input;
  }

  private buildResponsesTools(
    tools: ToolDefinition[],
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

    return [{ type: "tool_search" }, ...nativeTools];
  }

  private parseResponsesResult(response: any): CompletionResult {
    const content =
      typeof response?.output_text === "string" ? response.output_text : "";
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

  /**
   * OpenAI reasoning models on OpenRouter (o1/o3/o4/gpt-5 family) hide their
   * reasoning content on the chat-completions endpoint. To surface reasoning
   * SUMMARIES (not raw CoT, which OpenAI never exposes) we have to use the
   * Responses API, which streams `response.reasoning_summary_text.delta` events.
   *
   * Match by prefix on the OpenRouter model id. Excludes openai/gpt-4o,
   * openai/gpt-4.1, openai/chatgpt-* — those continue on chat-completions.
   */
  private isOpenAIReasoningModelOnOpenRouter(activeModel: string): boolean {
    if (this.provider !== "openrouter") return false;
    return (
      activeModel.startsWith("openai/o1") ||
      activeModel.startsWith("openai/o3") ||
      activeModel.startsWith("openai/o4") ||
      activeModel.startsWith("openai/gpt-5")
    );
  }

  /**
   * Convert ActionDefinition[] (the chat-completions tool shape used by the
   * adapter) to the Responses API tool shape.
   */
  private buildResponsesToolsFromActions(
    actions: ActionDefinition[] | undefined,
  ): Array<Record<string, unknown>> | undefined {
    if (!actions || actions.length === 0) return undefined;
    const formatted = formatTools(actions);
    return formatted.map((t) => ({
      type: "function",
      name: t.function.name,
      description: t.function.description,
      parameters: t.function.parameters,
    }));
  }

  /**
   * Streaming Responses API path for OpenAI reasoning models on OpenRouter.
   *
   * Maps Responses API SSE events back to the same StreamEvent shapes the
   * chat-completions path emits, so downstream consumers (processChunk.ts,
   * frontend tool handlers, plan approval, specialist delegations) see
   * identical events regardless of which path produced them.
   *
   *   response.reasoning_summary_text.delta  → thinking:start (once) + thinking:delta
   *   response.output_text.delta             → message:delta
   *   response.output_item.added (function_call) → action:start (queued buffer)
   *   response.function_call_arguments.delta → action:args (progressive)
   *   response.output_item.done (function_call) → final action:args + action:end
   *   response.completed                     → message:end + done(usage)
   *   response.error                         → error
   */
  private async *streamWithResponsesAPI(
    request: ChatCompletionRequest,
    activeModel: string,
    messageId: string,
  ): AsyncGenerator<StreamEvent> {
    const client = await this.getClient();
    const maxTokensValue = request.config?.maxTokens ?? this.config.maxTokens;
    const payload: Record<string, unknown> = {
      model: activeModel,
      input: this.buildResponsesInput(request),
      stream: true,
      reasoning: {
        effort: request.config?.reasoningEffort ?? "medium",
        summary: "auto",
      },
    };
    if (request.systemPrompt) payload.instructions = request.systemPrompt;
    if (typeof maxTokensValue === "number")
      payload.max_output_tokens = maxTokensValue;
    const tools = this.buildResponsesToolsFromActions(request.actions);
    if (tools && tools.length > 0) payload.tools = tools;

    logProviderPayload(
      "openai",
      "responses-api request payload",
      payload,
      request.debug,
    );

    let stream: any;
    try {
      stream = await client.responses.create(payload);
    } catch (error) {
      yield {
        type: "error",
        message: error instanceof Error ? error.message : "Unknown error",
        code: "OPENAI_RESPONSES_ERROR",
      };
      return;
    }

    // Tool-call accumulators keyed by call_id (the id used in function_call_output).
    // Some relays use item_id internally and call_id externally; we key on whichever
    // arrives, but normalize to call_id when emitting.
    const toolBuffers = new Map<
      string,
      { id: string; name: string; arguments: string; emittedStart: boolean }
    >();
    const itemIdToCallId = new Map<string, string>();

    let usage:
      | {
          prompt_tokens: number;
          completion_tokens: number;
          total_tokens: number;
        }
      | undefined;
    let reasoningStarted = false;
    let textStarted = false;
    let finishEmitted = false;

    const resolveCallId = (evt: any): string => {
      if (evt?.call_id) return evt.call_id;
      if (evt?.item_id) return itemIdToCallId.get(evt.item_id) ?? evt.item_id;
      if (evt?.item?.call_id) return evt.item.call_id;
      if (evt?.item?.id) return evt.item.id;
      return "";
    };

    try {
      for await (const evt of stream) {
        logProviderPayload(
          "openai",
          "responses-api stream chunk",
          evt,
          request.debug,
        );

        if (request.signal?.aborted) break;

        const t: string = evt?.type ?? "";

        if (t === "response.reasoning_summary_text.delta") {
          const delta: string = evt.delta ?? "";
          if (!delta) continue;
          if (!reasoningStarted) {
            yield { type: "thinking:start" } as any;
            reasoningStarted = true;
          }
          yield { type: "thinking:delta", content: delta } as any;
          continue;
        }
        if (
          t === "response.reasoning_summary_text.done" ||
          t === "response.reasoning.done"
        ) {
          continue;
        }

        if (t === "response.output_text.delta") {
          const text: string = evt.delta ?? "";
          if (!text) continue;
          if (reasoningStarted && !textStarted) {
            yield { type: "thinking:end" } as any;
            textStarted = true;
          }
          yield { type: "message:delta", content: text };
          continue;
        }

        if (t === "response.output_item.added") {
          const item = evt.item;
          if (item?.type === "function_call") {
            const callId: string = item.call_id ?? item.id ?? "";
            const itemId: string = item.id ?? callId;
            if (callId) {
              if (itemId && itemId !== callId) {
                itemIdToCallId.set(itemId, callId);
              }
              if (!toolBuffers.has(callId)) {
                toolBuffers.set(callId, {
                  id: callId,
                  name: item.name ?? "",
                  arguments: item.arguments ?? "",
                  emittedStart: false,
                });
              }
              const buf = toolBuffers.get(callId)!;
              if (buf.name && !buf.emittedStart) {
                yield { type: "action:start", id: buf.id, name: buf.name };
                buf.emittedStart = true;
              }
            }
          }
          continue;
        }

        if (t === "response.function_call_arguments.delta") {
          const callId = resolveCallId(evt);
          const delta: string = evt.delta ?? "";
          if (!callId || !delta) continue;
          let buf = toolBuffers.get(callId);
          if (!buf) {
            buf = { id: callId, name: "", arguments: "", emittedStart: false };
            toolBuffers.set(callId, buf);
          }
          buf.arguments += delta;
          if (buf.emittedStart) {
            yield {
              type: "action:args",
              id: buf.id,
              args: buf.arguments,
            };
          }
          continue;
        }

        if (t === "response.output_item.done") {
          const item = evt.item;
          if (item?.type === "function_call") {
            const callId: string = item.call_id ?? item.id ?? "";
            const buf = toolBuffers.get(callId);
            const name = buf?.name || item.name || "";
            const argsStr = buf?.arguments || item.arguments || "{}";
            if (callId && name) {
              if (!buf?.emittedStart) {
                yield { type: "action:start", id: callId, name };
              }
              yield {
                type: "action:args",
                id: callId,
                args: argsStr,
              };
              yield {
                type: "action:end",
                id: callId,
                name,
              };
            }
            toolBuffers.delete(callId);
          }
          continue;
        }

        if (t === "response.completed") {
          const u = evt.response?.usage;
          if (u) {
            usage = {
              prompt_tokens: u.input_tokens ?? 0,
              completion_tokens: u.output_tokens ?? 0,
              total_tokens:
                u.total_tokens ??
                (u.input_tokens ?? 0) + (u.output_tokens ?? 0),
            };
          }
          // Defensive: flush any tool buffers that didn't get an explicit done event.
          for (const buf of toolBuffers.values()) {
            if (!buf.id || !buf.name) continue;
            if (!buf.emittedStart) {
              yield { type: "action:start", id: buf.id, name: buf.name };
            }
            yield {
              type: "action:args",
              id: buf.id,
              args: buf.arguments || "{}",
            };
            yield { type: "action:end", id: buf.id, name: buf.name };
          }
          toolBuffers.clear();
          if (reasoningStarted && !textStarted) {
            yield { type: "thinking:end" } as any;
          }
          yield { type: "message:end" };
          yield { type: "done", usage };
          finishEmitted = true;
          continue;
        }

        if (t === "response.error" || t === "error") {
          const msg: string =
            evt.error?.message || evt.message || "Responses API error";
          yield {
            type: "error",
            message: msg,
            code: "OPENAI_RESPONSES_ERROR",
          };
          return;
        }
      }
    } catch (error) {
      yield {
        type: "error",
        message: error instanceof Error ? error.message : "Unknown error",
        code: "OPENAI_RESPONSES_ERROR",
      };
      return;
    }

    // Stream ended without an explicit response.completed — emit a synthetic finish.
    if (!finishEmitted) {
      if (reasoningStarted && !textStarted) {
        yield { type: "thinking:end" } as any;
      }
      yield { type: "message:end" };
      yield { type: "done", usage };
    }
  }

  private async completeWithResponses(
    request: ChatCompletionRequest,
  ): Promise<CompletionResult> {
    const client = await this.getClient();
    const openaiToolOptions = request.providerToolOptions?.openai;
    const payload = {
      model: request.config?.model || this.model,
      instructions: request.systemPrompt,
      input: this.buildResponsesInput(request),
      tools: this.buildResponsesTools(request.toolDefinitions ?? []),
      tool_choice:
        openaiToolOptions?.toolChoice === "required"
          ? "required"
          : openaiToolOptions?.toolChoice === "auto"
            ? "auto"
            : undefined,
      parallel_tool_calls: openaiToolOptions?.parallelToolCalls,
      temperature: request.config?.temperature ?? this.config.temperature,
      max_output_tokens: request.config?.maxTokens ?? this.config.maxTokens,
      stream: false,
    };

    logProviderPayload("openai", "request payload", payload, request.debug);
    const response = await client.responses.create(payload);
    logProviderPayload("openai", "response payload", response, request.debug);

    return this.parseResponsesResult(response);
  }

  async *stream(request: ChatCompletionRequest): AsyncGenerator<StreamEvent> {
    if (this.shouldUseResponsesApi(request)) {
      const messageId = generateMessageId();
      yield { type: "message:start", id: messageId };

      try {
        const result = await this.completeWithResponses(request);

        if (result.content) {
          yield { type: "message:delta", content: result.content };
        }

        for (const toolCall of result.toolCalls) {
          yield {
            type: "action:start",
            id: toolCall.id,
            name: toolCall.name,
          };
          yield {
            type: "action:args",
            id: toolCall.id,
            args: JSON.stringify(toolCall.args),
          };
        }

        yield { type: "message:end" };
        yield {
          type: "done",
          usage: result.usage
            ? {
                prompt_tokens: result.usage.promptTokens,
                completion_tokens: result.usage.completionTokens,
                total_tokens: result.usage.totalTokens,
              }
            : undefined,
        };
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
      const isOpenRouter = this.provider === "openrouter";
      const activeModel = request.config?.model || this.model;
      // Detect o-series OpenAI models (both direct and via OpenRouter)
      // Matches: o1, o3, o4-mini, o1-preview, o3-mini, o3-2025-04-16, etc.
      const modelSlug = activeModel.replace("openai/", "");
      const isOSeries = /^o[1-9]/.test(modelSlug);
      const isOpenAIOnOpenRouter =
        isOpenRouter && activeModel.startsWith("openai/");

      // OpenAI reasoning models on OpenRouter: chat-completions hides reasoning
      // entirely. Route to Responses API to surface reasoning summaries.
      // disableThinking opts out (falls through to chat-completions, no reasoning shown).
      if (
        !this.config.disableThinking &&
        this.isOpenAIReasoningModelOnOpenRouter(activeModel)
      ) {
        yield* this.streamWithResponsesAPI(request, activeModel, messageId);
        return;
      }
      const maxTokensValue = request.config?.maxTokens ?? this.config.maxTokens;
      const payload: any = {
        model: activeModel,
        messages,
        tools: tools.length > 0 ? tools : undefined,
        tool_choice: tools.length > 0 ? toolChoice : undefined,
        parallel_tool_calls:
          tools.length > 0 ? openaiToolOptions?.parallelToolCalls : undefined,
        stream: true,
        stream_options: { include_usage: true },
        // o-series: use max_completion_tokens + reasoning_effort, no temperature
        // regular models: use max_tokens + temperature
        ...(isOSeries
          ? {
              max_completion_tokens: maxTokensValue,
              reasoning_effort: request.config?.reasoningEffort ?? "medium",
            }
          : {
              temperature:
                request.config?.temperature ?? this.config.temperature,
              max_tokens: maxTokensValue,
            }),
        // Non-OpenAI OpenRouter models support OR's reasoning/include_reasoning params.
        // When disableThinking=true we must explicitly send include_reasoning:false because
        // models like Qwen3 and DeepSeek-R1 reason by default even without the reasoning param.
        ...(isOpenRouter && !isOpenAIOnOpenRouter
          ? this.config.disableThinking
            ? { include_reasoning: false }
            : { reasoning: { max_tokens: 8000 }, include_reasoning: true }
          : {}),
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

      let adapterReasoningStarted = false;

      for await (const chunk of stream) {
        logProviderPayload("openai", "stream chunk", chunk, request.debug);
        // Check for abort
        if (request.signal?.aborted) {
          break;
        }

        const delta = chunk.choices[0]?.delta as any;
        const choice = chunk.choices[0];

        // Handle content
        if (delta?.content) {
          yield { type: "message:delta", content: delta.content };
        }

        // Handle native reasoning tokens (OpenRouter models with reasoning_content)
        if (isOpenRouter) {
          const rc = delta?.reasoning_content ?? delta?.reasoning ?? null;
          if (rc) {
            const rcText =
              typeof rc === "string"
                ? rc
                : Array.isArray(rc) && (rc[0] as any)?.text
                  ? (rc[0] as any).text
                  : "";
            if (rcText) {
              if (!adapterReasoningStarted) {
                yield { type: "thinking:start" } as any;
                adapterReasoningStarted = true;
              }
              yield { type: "thinking:delta", content: rcText } as any;
            }
          } else if (
            adapterReasoningStarted &&
            (delta?.content || choice?.finish_reason)
          ) {
            yield { type: "thinking:end" } as any;
            adapterReasoningStarted = false;
          }
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
              // Emit progressive action:args for streaming rendering
              yield {
                type: "action:args",
                id: currentToolCall.id,
                args: currentToolCall.arguments,
              };
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

    const activeModel2 = request.config?.model || this.model;
    const modelSlug2 = activeModel2.replace("openai/", "");
    const isOSeries2 = /^o[1-9]/.test(modelSlug2);
    const maxTokensValue2 = request.config?.maxTokens ?? this.config.maxTokens;
    const payload: any = {
      model: activeModel2,
      messages,
      tools: tools.length > 0 ? tools : undefined,
      tool_choice: tools.length > 0 ? toolChoice : undefined,
      parallel_tool_calls:
        tools.length > 0 ? openaiToolOptions?.parallelToolCalls : undefined,
      stream: false,
      ...(isOSeries2
        ? {
            max_completion_tokens: maxTokensValue2,
            reasoning_effort: request.config?.reasoningEffort ?? "medium",
          }
        : {
            temperature: request.config?.temperature ?? this.config.temperature,
            max_tokens: maxTokensValue2,
          }),
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
