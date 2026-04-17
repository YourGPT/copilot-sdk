import type {
  Message,
  ActionDefinition,
  ActionParameter,
  StreamEvent,
  ToolDefinition,
  ToolCallInfo,
  AssistantToolMessage,
  DoneEventMessage,
  ToolResponse,
  AIResponseMode,
  AIContent,
  ToolContext,
  WebSearchConfig,
} from "../core/stream-events";
import type { AIProvider } from "../providers/types";
import { createMessage } from "../core/stream-events";
import type { LLMAdapter, ChatCompletionRequest } from "../adapters/base";
import type {
  RuntimeConfig,
  ChatRequest,
  HandleRequestOptions,
  HandleRequestResult,
  GenerateOptions,
} from "./types";
import type { StorageAdapter } from "../core/types";
import { extractInputMessages, mapOutputMessages } from "./storage-helpers";
import { createSSEResponse } from "./streaming";
import { StreamResult, type CollectedResult } from "./stream-result";
import { GenerateResult } from "./generate-result";
import {
  buildProviderToolOptions,
  filterToolsByProfile,
  resolveNativeToolSearch,
  searchTools,
  selectTools,
  shouldExposeToolSearch,
  type InternalToolSelectionConfig,
} from "./tool-selection";

type ToolSearchState = {
  loadedToolNames: string[];
};

type NativeToolSearchState = ReturnType<typeof resolveNativeToolSearch>;

type ToolSearchResult = {
  success: true;
  query: string;
  loadedTools: string[];
  results: Array<{
    name: string;
    description: string;
    location?: ToolDefinition["location"];
    category?: string;
    group?: string;
    profiles?: string[];
    searchKeywords?: string[];
    score: number;
  }>;
};

// ============================================
// AI Response Control
// ============================================

/**
 * Build the content string sent to AI for a tool result.
 *
 * This function transforms tool results based on the tool's aiResponseMode and aiContext settings,
 * controlling what information the AI receives to generate its response.
 *
 * @param tool - The tool definition (may include aiResponseMode, aiContext)
 * @param result - The tool result (may include _aiResponseMode, _aiContext, _aiContent overrides)
 * @param args - The arguments passed to the tool
 * @returns The content string to send to the AI, or multimodal content array
 */
function buildToolResultForAI(
  tool: ToolDefinition | undefined,
  result: ToolResponse | unknown,
  args: Record<string, unknown>,
): string | AIContent[] {
  // Type guard for ToolResponse with AI response fields
  const typedResult = result as ToolResponse | undefined;

  // Determine response mode (result override > tool config > default 'full')
  const responseMode: AIResponseMode =
    typedResult?._aiResponseMode ?? tool?.aiResponseMode ?? "full";

  // Check for multimodal content (images, etc.) - always include if present
  if (typedResult?._aiContent && typedResult._aiContent.length > 0) {
    return typedResult._aiContent;
  }

  // Get AI context (result override > tool config > undefined)
  let aiContext: string | undefined;

  if (typedResult?._aiContext) {
    aiContext = typedResult._aiContext;
  } else if (tool?.aiContext) {
    aiContext =
      typeof tool.aiContext === "function"
        ? tool.aiContext(typedResult as ToolResponse, args)
        : tool.aiContext;
  }

  // Apply response mode
  switch (responseMode) {
    case "none":
      // Minimal message so AI knows tool executed
      return aiContext ?? "[Result displayed to user]";

    case "brief":
      // Use context if available, otherwise minimal acknowledgment
      return (
        aiContext ?? `[Tool ${tool?.name ?? "unknown"} executed successfully]`
      );

    case "full":
    default:
      // Include context as prefix if available, then full data
      const fullData = JSON.stringify(result);
      return aiContext ? `${aiContext}\n\nFull data: ${fullData}` : fullData;
  }
}

/**
 * Serialize tool result content for API message.
 * Handles both string and multimodal (AIContent[]) results.
 */
function serializeToolResultContent(
  content: string | AIContent[],
): string | Array<{ type: string; [key: string]: unknown }> {
  if (typeof content === "string") {
    return content;
  }

  // Convert AIContent to API format (OpenAI multimodal format)
  return content.map((item) => {
    if (item.type === "image") {
      return {
        type: "image_url",
        image_url: {
          url: `data:${item.mediaType};base64,${item.data}`,
        },
      };
    }
    // Text content
    return {
      type: "text",
      text: item.text,
    };
  });
}

/**
 * Extract headers from HTTP request as a plain object
 */
function extractHeaders(request?: Request): Record<string, string> {
  if (!request) return {};
  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    headers[key.toLowerCase()] = value;
  });
  return headers;
}

/**
 * Build ToolContext from runtime config and HTTP request
 */
function buildToolContext(
  toolCallId: string,
  signal: AbortSignal | undefined,
  threadId: string | undefined,
  httpRequest: Request | undefined,
  toolContextData: Record<string, unknown> | undefined,
): ToolContext {
  const headers = extractHeaders(httpRequest);
  return {
    signal,
    threadId,
    toolCallId,
    headers,
    request: httpRequest
      ? {
          method: httpRequest.method,
          url: httpRequest.url,
          headers,
        }
      : undefined,
    data: toolContextData,
  };
}

/**
 * Copilot SDK Runtime
 *
 * Handles chat requests and manages LLM interactions.
 */
export class Runtime {
  private adapter: LLMAdapter;
  private config: RuntimeConfig;
  private storage: StorageAdapter | undefined;
  private actions: Map<string, ActionDefinition> = new Map();
  private tools: Map<string, ToolDefinition> = new Map();

  constructor(config: RuntimeConfig) {
    this.config = config;
    this.storage = config.storage;

    // Create adapter based on configuration type
    if ("provider" in config && config.provider) {
      // Use AIProvider to get adapter
      this.adapter = config.provider.languageModel(config.model);
    } else if ("adapter" in config && config.adapter) {
      // Direct adapter
      this.adapter = config.adapter;
    } else {
      throw new Error(
        "Runtime requires either 'provider' or 'adapter' configuration. " +
          "Use: createRuntime({ provider: createOpenAI({ apiKey }), model: 'gpt-4o' })",
      );
    }

    // Register actions (legacy)
    if (config.actions) {
      for (const action of config.actions) {
        this.actions.set(action.name, action);
      }
    }

    // Register tools
    if (config.tools) {
      for (const tool of config.tools) {
        this.tools.set(tool.name, tool);
      }
    }
  }

  /**
   * Process a chat request and return streaming response
   */
  async *processChat(
    request: ChatRequest,
    signal?: AbortSignal,
  ): AsyncGenerator<StreamEvent> {
    // Convert request messages to Message type
    const messages: Message[] = request.messages.map((m, i) =>
      createMessage({
        id: `msg_${i}`,
        role: m.role as Message["role"],
        content: m.content,
      }),
    );

    // Merge actions from config and request
    const allActions = [...this.actions.values()];
    if (request.actions) {
      for (const action of request.actions) {
        if (!this.actions.has(action.name)) {
          allActions.push({
            name: action.name,
            description: action.description,
            parameters: action.parameters as ActionDefinition["parameters"],
            handler: async () => {
              // Client-side action - will be handled by frontend
              return { handled: false };
            },
          });
        }
      }
    }

    // Create completion request
    const completionRequest: ChatCompletionRequest = {
      messages,
      actions: allActions.length > 0 ? allActions : undefined,
      systemPrompt: this.config.systemPrompt ?? request.systemPrompt,
      config: request.config,
      signal,
      webSearch: this.getWebSearchConfig(),
      debug: this.config.debug,
    };

    // Stream response from adapter
    const stream = this.adapter.stream(completionRequest);

    // Process events and handle tool calls
    for await (const event of stream) {
      // Handle action execution
      if (event.type === "action:args") {
        const action = this.actions.get(event.id);
        if (action) {
          try {
            const args = JSON.parse(event.args);
            const result = await action.handler(args);
            yield {
              type: "action:end",
              id: event.id,
              result,
            };
          } catch (error) {
            yield {
              type: "action:end",
              id: event.id,
              error: error instanceof Error ? error.message : "Action failed",
            };
          }
        } else {
          // Forward to client for handling
          yield event;
        }
      } else {
        yield event;
      }
    }
  }

  /**
   * Handle HTTP request (for use with any framework)
   *
   * @param request - The HTTP request
   * @param options - Optional configuration including onFinish callback for persistence
   *
   * @example
   * ```typescript
   * // Basic usage
   * return runtime.handleRequest(request);
   *
   * // With server-side persistence
   * return runtime.handleRequest(request, {
   *   onFinish: async ({ messages, threadId }) => {
   *     await db.thread.upsert({
   *       where: { id: threadId },
   *       update: { messages, updatedAt: new Date() },
   *       create: { id: threadId, messages },
   *     });
   *   },
   * });
   * ```
   */
  async handleRequest(
    request: Request,
    options?: HandleRequestOptions,
  ): Promise<Response> {
    try {
      const body = (await request.json()) as ChatRequest;

      if (this.config.debug) {
        console.log("[Copilot SDK] Request:", {
          messageCount: body.messages?.length ?? 0,
          toolCount: body.tools?.length ?? 0,
          hasSystemPrompt: Boolean(body.systemPrompt),
          threadId: body.threadId,
          streaming: body.streaming !== false,
          toolProfile: body.toolProfile,
        });
      }

      // Create abort controller from request signal
      const signal = request.signal;

      // Use agent loop if tools are present
      const hasTools =
        (body.tools && body.tools.length > 0) || this.tools.size > 0;
      const useAgentLoop = hasTools;

      // NON-STREAMING: Return JSON response instead of SSE
      if (body.streaming === false) {
        return this.handleNonStreamingRequest(
          body,
          signal,
          useAgentLoop || false,
          request,
          options,
        );
      }

      // STREAMING: Process chat and return SSE response
      // Always use processChatWithLoop for consistent message handling
      const generator = this.processChatWithLoop(
        body,
        signal,
        undefined,
        undefined,
        request,
      );

      // Wrap generator to intercept done event for onFinish callback
      const wrappedGenerator = this.wrapGeneratorWithOnFinish(
        generator,
        body.threadId,
        options,
      );

      return createSSEResponse(wrappedGenerator);
    } catch (error) {
      console.error("[Copilot SDK] Error:", error);

      return new Response(
        JSON.stringify({
          error: error instanceof Error ? error.message : "Unknown error",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        },
      );
    }
  }

  /**
   * Wrap a generator to intercept the done event and call onFinish
   */
  private async *wrapGeneratorWithOnFinish(
    generator: AsyncGenerator<StreamEvent>,
    threadId?: string,
    options?: HandleRequestOptions,
  ): AsyncGenerator<StreamEvent> {
    let doneMessages: DoneEventMessage[] | undefined;
    let doneUsage:
      | {
          prompt_tokens: number;
          completion_tokens: number;
          total_tokens?: number;
        }
      | undefined;

    for await (const event of generator) {
      // Capture messages and usage from done event
      if (event.type === "done") {
        if (event.messages) {
          doneMessages = event.messages;
        }
        if (event.usage) {
          doneUsage = event.usage;
        }
        // Strip usage from client-facing event (usage is server-side only for billing)
        const { usage: _usage, ...clientEvent } = event;
        yield clientEvent as StreamEvent;
      } else {
        yield event;
      }
    }

    // Call onFinish after stream completes
    if (options?.onFinish && doneMessages) {
      try {
        const result: HandleRequestResult = {
          messages: doneMessages,
          threadId,
          usage: doneUsage
            ? {
                promptTokens: doneUsage.prompt_tokens,
                completionTokens: doneUsage.completion_tokens,
                totalTokens:
                  doneUsage.total_tokens ??
                  doneUsage.prompt_tokens + doneUsage.completion_tokens,
              }
            : undefined,
        };
        await options.onFinish(result);
      } catch (error) {
        console.error("[Copilot SDK] onFinish callback error:", error);
      }
    }
  }

  /**
   * Handle non-streaming request - returns JSON instead of SSE
   */
  private async handleNonStreamingRequest(
    body: ChatRequest,
    signal: AbortSignal | undefined,
    _useAgentLoop: boolean, // Kept for backward compatibility, always uses agent loop now
    httpRequest: Request,
    options?: HandleRequestOptions,
  ): Promise<Response> {
    try {
      // Always use processChatWithLoop for consistent message handling
      const generator = this.processChatWithLoop(
        body,
        signal,
        undefined,
        undefined,
        httpRequest,
      );

      // Collect all events
      const events: StreamEvent[] = [];
      let content = "";
      const toolCalls: ToolCallInfo[] = [];
      const toolResults: Array<{ id: string; result: unknown }> = [];
      let messages: DoneEventMessage[] | undefined;
      let requiresAction = false;
      let error: { message: string; code?: string } | undefined;
      let doneUsage:
        | {
            prompt_tokens: number;
            completion_tokens: number;
            total_tokens?: number;
          }
        | undefined;

      for await (const event of generator) {
        events.push(event);

        switch (event.type) {
          case "message:delta":
            content += event.content;
            break;
          case "action:start":
            toolCalls.push({ id: event.id, name: event.name, args: {} });
            break;
          case "action:args":
            const tc = toolCalls.find((t) => t.id === event.id);
            if (tc) {
              try {
                tc.args = JSON.parse(event.args || "{}");
              } catch {
                tc.args = {};
              }
            }
            break;
          case "action:end":
            toolResults.push({
              id: event.id,
              result: event.result || event.error,
            });
            break;
          case "tool_calls":
            // Client-side tool calls
            break;
          case "done":
            messages = event.messages;
            requiresAction = event.requiresAction || false;
            if (event.usage) {
              doneUsage = event.usage;
            }
            break;
          case "error":
            error = { message: event.message, code: event.code };
            break;
        }
      }

      // Call onFinish callback if provided
      if (options?.onFinish && messages && !error) {
        try {
          const result: HandleRequestResult = {
            messages,
            threadId: body.threadId,
            usage: doneUsage
              ? {
                  promptTokens: doneUsage.prompt_tokens,
                  completionTokens: doneUsage.completion_tokens,
                  totalTokens:
                    doneUsage.total_tokens ??
                    doneUsage.prompt_tokens + doneUsage.completion_tokens,
                }
              : undefined,
          };
          await options.onFinish(result);
        } catch (callbackError) {
          console.error(
            "[Copilot SDK] onFinish callback error:",
            callbackError,
          );
        }
      }

      // Build JSON response
      const response = {
        success: !error,
        content,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        toolResults: toolResults.length > 0 ? toolResults : undefined,
        messages,
        requiresAction,
        error,
        // Include raw events for debugging
        _events: this.config.debug ? events : undefined,
      };

      console.log("[Copilot SDK] Non-streaming response:", {
        contentLength: content.length,
        toolCalls: toolCalls.length,
        toolResults: toolResults.length,
        messagesCount: messages?.length,
        requiresAction,
        hasError: !!error,
      });

      return new Response(JSON.stringify(response), {
        status: error ? 500 : 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    } catch (err) {
      console.error("[Copilot SDK] Non-streaming error:", err);
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            message: err instanceof Error ? err.message : "Unknown error",
          },
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        },
      );
    }
  }

  /**
   * Get registered actions
   */
  getActions(): ActionDefinition[] {
    return [...this.actions.values()];
  }

  /**
   * Register a new action
   */
  registerAction(action: ActionDefinition): void {
    this.actions.set(action.name, action);
  }

  /**
   * Unregister an action
   */
  unregisterAction(name: string): void {
    this.actions.delete(name);
  }

  /**
   * Register a new tool
   */
  registerTool(tool: ToolDefinition): void {
    this.tools.set(tool.name, tool);
  }

  /**
   * Unregister a tool
   */
  unregisterTool(name: string): void {
    this.tools.delete(name);
  }

  /**
   * Get registered tools
   */
  getTools(): ToolDefinition[] {
    return [...this.tools.values()];
  }

  /**
   * Get the AI provider instance (if using provider config)
   */
  getProvider(): AIProvider | null {
    if ("provider" in this.config) {
      return this.config.provider as AIProvider;
    }
    return null;
  }

  /**
   * Get the current model ID
   */
  getModel(): string {
    if ("provider" in this.config) {
      return this.config.model;
    }
    return this.adapter.model;
  }

  /**
   * Get web search configuration from runtime config
   */
  private getWebSearchConfig(): boolean | WebSearchConfig | undefined {
    if ("webSearch" in this.config) {
      return this.config.webSearch;
    }
    return undefined;
  }

  /**
   * Resolve effective tool selection config for a request.
   */
  private resolveEffectiveToolSelectionConfig(
    request: ChatRequest,
  ): InternalToolSelectionConfig | undefined {
    const toolSearch =
      "toolSearch" in this.config ? this.config.toolSearch : undefined;

    const hasDeferredServerTool = [...this.tools.values()].some(
      (t) => t.deferLoading,
    );
    const hasDeferredInRequest = request.tools?.some((t) => t.deferLoading);

    if (!hasDeferredServerTool && !hasDeferredInRequest && !toolSearch) {
      return undefined;
    }

    return {
      maxEagerTools: toolSearch?.maxEagerTools ?? 20,
      maxResults: toolSearch?.maxResults ?? 8,
      exposeWhenExceeds: toolSearch?.exposeWhenExceeds ?? 8,
      toolChoice: toolSearch?.toolChoice,
      parallelCalls: toolSearch?.parallelCalls,
      defaultProfile: toolSearch?.defaultProfile,
      profiles: toolSearch?.profiles,
      includeUnprofiled: toolSearch?.includeUnprofiled,
    };
  }

  private collectToolsForRequest(request: ChatRequest): ToolDefinition[] {
    const allTools: ToolDefinition[] = [...this.tools.values()];

    if (request.tools) {
      for (const tool of request.tools) {
        allTools.push({
          name: tool.name,
          description: tool.description,
          location: "client",
          category: tool.category,
          group: tool.group,
          deferLoading: tool.deferLoading,
          profiles: tool.profiles,
          searchKeywords: tool.searchKeywords,
          inputSchema: tool.inputSchema as ToolDefinition["inputSchema"],
        });
      }
    }

    return allTools;
  }

  private selectToolsForRequest(
    request: ChatRequest,
    allTools: ToolDefinition[],
    toolSearchState?: ToolSearchState,
  ): ToolDefinition[] {
    return selectTools({
      tools: allTools,
      messages: request.messages,
      config: this.resolveEffectiveToolSelectionConfig(request),
      activeProfile: request.toolProfile,
      forceIncludeNames: toolSearchState?.loadedToolNames,
    });
  }

  private resolveNativeToolSearchForRequest(
    request: ChatRequest,
  ): NativeToolSearchState {
    return resolveNativeToolSearch({
      providerName: this.adapter.provider,
      modelName: this.getModel(),
      config: this.resolveEffectiveToolSelectionConfig(request),
    });
  }

  private buildNativeToolCatalogForRequest(
    request: ChatRequest,
    allTools: ToolDefinition[],
  ): ToolDefinition[] {
    return filterToolsByProfile({
      tools: allTools,
      config: this.resolveEffectiveToolSelectionConfig(request),
      activeProfile: request.toolProfile,
    });
  }

  private buildProviderToolOptionsForRequest(
    selectedTools: ToolDefinition[],
    request: ChatRequest,
  ) {
    return buildProviderToolOptions({
      providerName: this.adapter.provider,
      modelName: this.getModel(),
      selectedTools,
      config: this.resolveEffectiveToolSelectionConfig(request),
      metaToolName: this.getToolSearchMetaToolName(),
    });
  }

  private getToolSearchMetaToolName(): string {
    const toolSearch =
      "toolSearch" in this.config ? this.config.toolSearch : undefined;
    return toolSearch?.name ?? "search_tools";
  }

  private createToolSearchTool(
    request: ChatRequest,
    allTools: ToolDefinition[],
    selectedTools: ToolDefinition[],
  ): ToolDefinition | null {
    if (
      !shouldExposeToolSearch({
        tools: allTools,
        config: this.resolveEffectiveToolSelectionConfig(request),
      })
    ) {
      return null;
    }

    const toolName = this.getToolSearchMetaToolName();
    const excludedNames = selectedTools.map((tool) => tool.name);

    return {
      name: toolName,
      description:
        ("toolSearch" in this.config && this.config.toolSearch?.description) ||
        "Search available deferred tools and load the most relevant ones for the next step when the right tool is not currently exposed.",
      location: "server",
      hidden: true,
      inputSchema: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Describe the tool capability you need to find.",
          },
          limit: {
            type: "number",
            description: "Maximum number of matching tools to load.",
          },
        },
        required: ["query"],
      },
      handler: async (params) => {
        const args = params as { query: string; limit?: number };
        const results = searchTools({
          tools: allTools,
          query: args.query,
          config: this.resolveEffectiveToolSelectionConfig(request),
          activeProfile: request.toolProfile,
          limit: args.limit,
          excludeNames: excludedNames,
        });

        if (this.config.debug) {
          console.log("[Copilot SDK] search_tools result:", {
            query: args.query,
            activeProfile: request.toolProfile,
            selectedToolCount: selectedTools.length,
            catalogCount: allTools.length,
            loadedTools: results.map((result) => result.name),
            results: results.map((result) => ({
              name: result.name,
              location: result.location,
              category: result.category,
              group: result.group,
              score: result.score,
            })),
          });
        }

        return {
          success: true,
          query: args.query,
          loadedTools: results.map((result) => result.name),
          results,
        } satisfies ToolSearchResult;
      },
    };
  }

  private extendLoadedToolNames(
    current: ToolSearchState | undefined,
    results: Array<{ name: string; result: unknown }>,
  ): ToolSearchState | undefined {
    const loaded = new Set(current?.loadedToolNames ?? []);
    const searchToolName = this.getToolSearchMetaToolName();

    for (const result of results) {
      if (result.name !== searchToolName) {
        continue;
      }
      const typedResult = result.result as {
        loadedTools?: unknown;
      } | null;
      if (!Array.isArray(typedResult?.loadedTools)) {
        continue;
      }
      for (const toolName of typedResult.loadedTools) {
        if (typeof toolName === "string" && toolName) {
          loaded.add(toolName);
        }
      }
    }

    if (loaded.size === 0) {
      return current;
    }

    return {
      loadedToolNames: [...loaded],
    };
  }

  /**
   * Process a chat request with tool support (Vercel AI SDK pattern)
   *
   * This method:
   * 1. Streams response from adapter
   * 2. Detects tool calls from streaming events
   * 3. Server-side tools are executed immediately
   * 4. Client-side tool calls are yielded for client to execute
   * 5. Loop continues until no more tool calls or max iterations reached
   * 6. Returns all new messages in the done event for client to append
   */
  async *processChatWithLoop(
    request: ChatRequest,
    signal?: AbortSignal,
    // Internal: accumulated messages from recursive calls (for returning in done event)
    _accumulatedMessages?: DoneEventMessage[],
    _isRecursive?: boolean,
    // HTTP request for extracting headers (auth context)
    _httpRequest?: Request,
    _toolSearchState?: ToolSearchState,
  ): AsyncGenerator<StreamEvent> {
    const debug = this.config.debug;

    // Check if non-streaming mode is requested
    // Use non-streaming for better comparison with original studio-ai behavior
    if (request.streaming === false) {
      if (debug) {
        console.log("[Copilot SDK] Using non-streaming mode");
      }
      // Delegate to non-streaming implementation
      for await (const event of this.processChatWithLoopNonStreaming(
        request,
        signal,
        _accumulatedMessages,
        _isRecursive,
        _httpRequest,
        _toolSearchState,
      )) {
        yield event;
      }
      return;
    }

    // Track new messages created during this request
    const newMessages: DoneEventMessage[] = _accumulatedMessages || [];
    const maxIterations = this.config.maxIterations ?? 20;

    const allTools = this.collectToolsForRequest(request);
    const nativeToolSearch = this.resolveNativeToolSearchForRequest(request);
    const nativeToolCatalog = nativeToolSearch
      ? this.buildNativeToolCatalogForRequest(request, allTools)
      : null;
    const selectedTools =
      nativeToolCatalog ??
      this.selectToolsForRequest(request, allTools, _toolSearchState);
    const toolSearchTool = nativeToolSearch
      ? null
      : this.createToolSearchTool(request, allTools, selectedTools);
    const effectiveSelectedTools = nativeToolCatalog
      ? nativeToolCatalog
      : toolSearchTool
        ? [...selectedTools, toolSearchTool]
        : selectedTools;
    const providerToolOptions = this.buildProviderToolOptionsForRequest(
      effectiveSelectedTools,
      request,
    );
    const selectedToolMap = new Map(
      effectiveSelectedTools.map((tool) => [tool.name, tool] as const),
    );

    if (debug) {
      console.log(
        `[Copilot SDK] Processing chat with ${allTools.length} tools`,
      );
      if (effectiveSelectedTools.length !== allTools.length) {
        console.log(
          `[Copilot SDK] Tool selection active: ${effectiveSelectedTools.length}/${allTools.length} tools`,
          {
            activeProfile: request.toolProfile,
            nativeSearch: nativeToolSearch?.provider ?? null,
          },
        );
      }
      // Log messages with attachments for debugging vision support
      for (let i = 0; i < request.messages.length; i++) {
        const msg = request.messages[i];
        const hasAttachments = msg.attachments && msg.attachments.length > 0;
        if (hasAttachments) {
          console.log(
            `[Copilot SDK] Message ${i} (${msg.role}) has ${msg.attachments!.length} attachments:`,
            msg.attachments!.map((a) => ({
              type: a.type,
              mimeType: a.mimeType,
              dataLength: a.data?.length || 0,
            })),
          );
        }
      }
    }

    // Build system prompt
    const systemPrompt = this.config.systemPrompt ?? request.systemPrompt ?? "";

    // Accumulate data from stream
    let accumulatedText = "";
    const toolCalls: ToolCallInfo[] = [];
    let currentToolCall: {
      id: string;
      name: string;
      args: string;
      extra_content?: Record<string, unknown>;
    } | null = null;

    // Server-side tool results (populated inline during stream, before message:end)
    const serverToolResults: Array<{
      id: string;
      name: string;
      args: Record<string, unknown>;
      result: unknown;
      tool: ToolDefinition;
    }> = [];

    // Tool context data for server-side tool handlers
    const toolContextData =
      "toolContext" in this.config ? this.config.toolContext : undefined;

    // Capture usage from adapter for onFinish callback (server-side only)
    let adapterUsage:
      | {
          prompt_tokens: number;
          completion_tokens: number;
          total_tokens?: number;
        }
      | undefined;

    // Create completion request
    // Use rawMessages if provided (when client sends tool results in messages)
    const completionRequest: ChatCompletionRequest = {
      messages: [], // Not used when rawMessages is provided
      rawMessages: request.messages as Array<Record<string, unknown>>,
      actions: nativeToolSearch
        ? undefined
        : this.convertToolsToActions(effectiveSelectedTools),
      toolDefinitions: nativeToolSearch ? effectiveSelectedTools : undefined,
      systemPrompt: systemPrompt,
      config: request.config,
      signal,
      webSearch: this.getWebSearchConfig(),
      providerToolOptions,
      debug,
    };

    // Stream from adapter
    const stream = this.adapter.stream(completionRequest);

    // Process stream events
    for await (const event of stream) {
      switch (event.type) {
        case "message:start":
          yield event; // Forward to client
          break;

        case "message:end":
          yield event; // Natural order — always arrives after action:end from every provider
          break;

        case "message:delta":
          accumulatedText += event.content;
          yield event; // Forward text to client
          break;

        case "action:start":
          currentToolCall = {
            id: event.id,
            name: event.name,
            args: "",
            ...(event.extra_content
              ? { extra_content: event.extra_content }
              : {}),
          };
          if (debug) {
            console.log(`[Copilot SDK] Tool call started: ${event.name}`);
          }
          yield event; // Forward to client
          break;

        case "action:args":
          if (currentToolCall) {
            // Accumulate the raw args string — progressive action:args
            // events carry the growing accumulated JSON, not deltas.
            // Only finalize (push to toolCalls) when JSON is parseable.
            currentToolCall.args = event.args || currentToolCall.args;
            try {
              const parsedArgs = JSON.parse(currentToolCall.args || "{}");
              // Successfully parsed — update or create the toolCall entry
              const existingIdx = toolCalls.findIndex(
                (t) => t.id === currentToolCall!.id,
              );
              const entry = {
                id: currentToolCall.id,
                name: currentToolCall.name,
                args: parsedArgs,
                ...(currentToolCall.extra_content
                  ? { extra_content: currentToolCall.extra_content }
                  : {}),
              };
              if (existingIdx >= 0) {
                toolCalls[existingIdx] = entry;
              } else {
                toolCalls.push(entry);
              }
              if (debug) {
                console.log(
                  `[Copilot SDK] Tool args for ${currentToolCall.name}:`,
                  parsedArgs,
                );
              }
            } catch {
              // Partial JSON — not parseable yet. Keep accumulating.
              // Ensure a placeholder entry exists so action:end can find it.
              if (!toolCalls.find((t) => t.id === currentToolCall!.id)) {
                toolCalls.push({
                  id: currentToolCall.id,
                  name: currentToolCall.name,
                  args: {},
                  ...(currentToolCall.extra_content
                    ? { extra_content: currentToolCall.extra_content }
                    : {}),
                });
              }
            }
            // Do NOT null currentToolCall — more action:args may follow
          }
          yield event; // Forward to client
          break;

        case "action:end": {
          // Clear currentToolCall — tool call generation is complete
          currentToolCall = null;

          const toolName = (event as StreamEvent & { name?: string }).name;
          const tool = toolName ? selectedToolMap.get(toolName) : undefined;

          if (tool?.location === "server" && tool.handler) {
            // Execute server-side tool inline — before message:end arrives naturally
            // This preserves the correct event order: action:end(result) → message:end
            if (debug) {
              console.log(
                `[Copilot SDK] Executing server-side tool: ${toolName}`,
              );
            }
            const tc = toolCalls.find((t) => t.id === event.id);
            const args = tc?.args ?? {};
            const toolContext = buildToolContext(
              event.id,
              signal,
              request.threadId,
              _httpRequest,
              toolContextData,
            );
            try {
              const result = await tool.handler(args, toolContext);
              serverToolResults.push({
                id: event.id,
                name: toolName!,
                args,
                result,
                tool,
              });
              yield {
                type: "action:end",
                id: event.id,
                name: toolName,
                result,
              } as StreamEvent;
            } catch (error) {
              const errorResult = {
                success: false,
                error:
                  error instanceof Error
                    ? error.message
                    : "Tool execution failed",
              };
              serverToolResults.push({
                id: event.id,
                name: toolName!,
                args,
                result: errorResult,
                tool,
              });
              yield {
                type: "action:end",
                id: event.id,
                name: toolName,
                error:
                  error instanceof Error
                    ? error.message
                    : "Tool execution failed",
              } as StreamEvent;
            }
          } else {
            yield event; // Client-side tool — forward as-is
          }
          break;
        }

        case "citation":
          // Forward web search citations to client
          yield event;
          break;

        case "error":
          yield event;
          return; // Exit on error

        case "done":
          // Capture usage from adapter's done event (for onFinish callback)
          // We don't yield done yet - we need to check for tool calls first
          if (event.usage) {
            adapterUsage = event.usage;
          }
          break;

        default:
          yield event;
      }
    }

    // Check if we got tool calls
    if (toolCalls.length > 0) {
      if (debug) {
        console.log(
          `[Copilot SDK] Detected ${toolCalls.length} tool calls:`,
          toolCalls.map((t) => t.name),
        );
      }

      // Client-side tool calls = those not executed server-side inline
      const serverToolIds = new Set(serverToolResults.map((r) => r.id));
      const clientToolCalls = toolCalls.filter(
        (tc) => !serverToolIds.has(tc.id),
      );

      // If there are server-side tools executed, continue the loop by making another LLM call
      if (serverToolResults.length > 0) {
        if (debug) {
          console.log(
            `[Copilot SDK] Server tools executed, continuing conversation...`,
          );
        }

        // Create assistant message with tool_calls
        const assistantWithToolCalls: DoneEventMessage = {
          role: "assistant",
          content: accumulatedText || null,
          tool_calls: serverToolResults.map((tr) => {
            const tc = toolCalls.find((t) => t.id === tr.id);
            return {
              id: tr.id,
              type: "function" as const,
              function: {
                name: tr.name,
                arguments: JSON.stringify(tr.args),
              },
              ...(tc?.extra_content ? { extra_content: tc.extra_content } : {}),
            };
          }),
        };

        // Create tool result messages (using buildToolResultForAI for AI response control)
        const toolResultMessages: DoneEventMessage[] = serverToolResults.map(
          (tr) => {
            const aiContent = buildToolResultForAI(tr.tool, tr.result, tr.args);
            // Serialize content (handles both string and multimodal)
            const content =
              typeof aiContent === "string"
                ? aiContent
                : JSON.stringify(serializeToolResultContent(aiContent));
            return {
              role: "tool" as const,
              content,
              tool_call_id: tr.id,
            };
          },
        );

        // Add to accumulated messages for client
        newMessages.push(assistantWithToolCalls);
        newMessages.push(...toolResultMessages);

        // Build messages for next LLM call (cast DoneEventMessage to Record for request)
        const messagesWithResults: Array<Record<string, unknown>> = [
          ...(request.messages as Array<Record<string, unknown>>),
          assistantWithToolCalls as unknown as Record<string, unknown>,
          ...(toolResultMessages as unknown as Array<Record<string, unknown>>),
        ];

        // Make recursive call with updated messages
        const nextRequest: ChatRequest = {
          ...request,
          messages: messagesWithResults as ChatRequest["messages"],
        };
        const nextToolSearchState = this.extendLoadedToolNames(
          _toolSearchState,
          serverToolResults.map((result) => ({
            name: result.name,
            result: result.result,
          })),
        );

        // Continue the agent loop - pass accumulated messages and HTTP request
        for await (const event of this.processChatWithLoop(
          nextRequest,
          signal,
          newMessages,
          true, // Mark as recursive
          _httpRequest,
          nextToolSearchState,
        )) {
          yield event;
        }
        return;
      }

      // If there are client-side tools, send them to client
      if (clientToolCalls.length > 0) {
        // Build assistant message with tool_calls for client to include in next request
        const assistantMessage: AssistantToolMessage = {
          role: "assistant",
          content: accumulatedText || null,
          tool_calls: clientToolCalls.map((tc) => ({
            id: tc.id,
            type: "function" as const,
            function: {
              name: tc.name,
              arguments: JSON.stringify(tc.args),
            },
            ...(tc.extra_content ? { extra_content: tc.extra_content } : {}),
          })),
        };

        // Add to accumulated messages (cast to DoneEventMessage since structure matches)
        newMessages.push(assistantMessage as DoneEventMessage);

        // Yield tool_calls event (Vercel AI SDK pattern)
        yield {
          type: "tool_calls",
          toolCalls: clientToolCalls,
          assistantMessage,
        } as StreamEvent;

        // Signal that client needs to execute tools and send results
        // Include accumulated messages so client can update state
        // Include usage for onFinish callback (will be stripped before sending to client)
        yield {
          type: "done",
          requiresAction: true,
          messages: newMessages,
          usage: adapterUsage,
        } as StreamEvent;
        return;
      }
    }

    // No tool calls - add final assistant message and we're done
    if (accumulatedText) {
      newMessages.push({
        role: "assistant" as const,
        content: accumulatedText,
      });
    }

    if (debug) {
      console.log(
        `[Copilot SDK] Stream complete, returning ${newMessages.length} new messages`,
      );
    }

    // Return all accumulated messages for client to append
    // Include usage for onFinish callback (will be stripped before sending to client)
    yield {
      type: "done",
      messages: newMessages.length > 0 ? newMessages : undefined,
      usage: adapterUsage,
    } as StreamEvent;
  }

  /**
   * Non-streaming agent loop implementation
   *
   * Uses adapter.complete() instead of stream() for:
   * - Better comparison with original studio-ai behavior
   * - Easier debugging (full response at once)
   * - More predictable retry behavior
   */
  private async *processChatWithLoopNonStreaming(
    request: ChatRequest,
    signal?: AbortSignal,
    _accumulatedMessages?: DoneEventMessage[],
    _isRecursive?: boolean,
    _httpRequest?: Request,
    _toolSearchState?: ToolSearchState,
  ): AsyncGenerator<StreamEvent> {
    const newMessages: DoneEventMessage[] = _accumulatedMessages || [];
    const debug = this.config.debug;
    const maxIterations = this.config.maxIterations ?? 20;
    // Track accumulated usage across iterations (for onFinish callback)
    let accumulatedUsage: {
      prompt_tokens: number;
      completion_tokens: number;
      total_tokens: number;
    } = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };

    const allTools = this.collectToolsForRequest(request);
    const nativeToolSearch = this.resolveNativeToolSearchForRequest(request);
    let toolSearchState = _toolSearchState;

    // Build system prompt
    const systemPrompt = this.config.systemPrompt ?? request.systemPrompt ?? "";

    // Main agent loop
    let iteration = 0;
    let conversationMessages = request.messages as Array<
      Record<string, unknown>
    >;

    while (iteration < maxIterations) {
      iteration++;

      if (debug) {
        console.log(`[Copilot SDK] Iteration ${iteration}/${maxIterations}`);
      }

      // Check for abort
      if (signal?.aborted) {
        yield {
          type: "error",
          message: "Aborted",
          code: "ABORTED",
        } as StreamEvent;
        return;
      }

      // Check if adapter supports non-streaming
      if (!this.adapter.complete) {
        if (debug) {
          console.log(
            "[Copilot SDK] Adapter does not support non-streaming, falling back to streaming",
          );
        }
        // Fall back to streaming by delegating to the streaming implementation
        // But set streaming to true to avoid infinite loop
        const streamingRequest = { ...request, streaming: true };
        for await (const event of this.processChatWithLoop(
          streamingRequest,
          signal,
          _accumulatedMessages,
          _isRecursive,
          _httpRequest,
          toolSearchState,
        )) {
          yield event;
        }
        return;
      }

      const nativeToolCatalog = nativeToolSearch
        ? this.buildNativeToolCatalogForRequest(request, allTools)
        : null;
      const selectedTools =
        nativeToolCatalog ??
        this.selectToolsForRequest(request, allTools, toolSearchState);
      const toolSearchTool = nativeToolSearch
        ? null
        : this.createToolSearchTool(request, allTools, selectedTools);
      const effectiveSelectedTools = nativeToolCatalog
        ? nativeToolCatalog
        : toolSearchTool
          ? [...selectedTools, toolSearchTool]
          : selectedTools;
      const providerToolOptions = this.buildProviderToolOptionsForRequest(
        effectiveSelectedTools,
        request,
      );
      const selectedToolMap = new Map(
        effectiveSelectedTools.map((tool) => [tool.name, tool] as const),
      );

      // Create completion request
      const completionRequest: ChatCompletionRequest = {
        messages: [],
        rawMessages: conversationMessages,
        actions: nativeToolSearch
          ? undefined
          : this.convertToolsToActions(effectiveSelectedTools),
        toolDefinitions: nativeToolSearch ? effectiveSelectedTools : undefined,
        systemPrompt: systemPrompt,
        config: request.config,
        signal,
        webSearch: this.getWebSearchConfig(),
        providerToolOptions,
        debug,
      };

      try {
        // Call the non-streaming complete method
        const result = await this.adapter.complete(completionRequest);

        // Capture usage from adapter response (convert camelCase to snake_case)
        if (result.usage) {
          accumulatedUsage.prompt_tokens += result.usage.promptTokens;
          accumulatedUsage.completion_tokens += result.usage.completionTokens;
          accumulatedUsage.total_tokens += result.usage.totalTokens;
        }

        if (debug) {
          console.log(
            `[Copilot SDK] Got response: ${result.content.length} chars, ${result.toolCalls.length} tool calls`,
          );
        }

        // Emit message events (for SSE compatibility)
        yield { type: "message:start", id: `msg_${Date.now()}` } as StreamEvent;
        if (result.content) {
          yield {
            type: "message:delta",
            content: result.content,
          } as StreamEvent;
        }
        yield { type: "message:end" } as StreamEvent;

        // Check for tool calls
        if (result.toolCalls.length > 0) {
          // Separate server and client tools
          const serverToolCalls: Array<{
            id: string;
            name: string;
            args: Record<string, unknown>;
          }> = [];
          const clientToolCalls: ToolCallInfo[] = [];

          for (const tc of result.toolCalls) {
            const tool = selectedToolMap.get(tc.name);
            if (tool?.location === "server" && tool.handler) {
              serverToolCalls.push(tc);
            } else {
              clientToolCalls.push({
                id: tc.id,
                name: tc.name,
                args: tc.args,
              });
            }
          }

          // Emit tool call events
          for (const tc of result.toolCalls) {
            const tool = selectedToolMap.get(tc.name);
            yield {
              type: "action:start",
              id: tc.id,
              name: tc.name,
              hidden: tool?.hidden ?? false,
            } as StreamEvent;
            yield {
              type: "action:args",
              id: tc.id,
              args: JSON.stringify(tc.args),
            } as StreamEvent;
          }

          // Execute server-side tools
          const serverToolResults: Array<{
            id: string;
            name: string;
            args: Record<string, unknown>;
            result: unknown;
            tool: ToolDefinition;
          }> = [];

          // Get toolContext from config (if available)
          const toolContextData =
            "toolContext" in this.config ? this.config.toolContext : undefined;

          for (const tc of serverToolCalls) {
            const tool = selectedToolMap.get(tc.name);
            if (tool?.handler) {
              if (debug) {
                console.log(`[Copilot SDK] Executing tool: ${tc.name}`);
              }

              // Build rich context for the tool handler
              const toolContext = buildToolContext(
                tc.id,
                signal,
                request.threadId,
                _httpRequest,
                toolContextData,
              );

              try {
                const toolResult = await tool.handler(tc.args, toolContext);
                serverToolResults.push({
                  id: tc.id,
                  name: tc.name,
                  args: tc.args,
                  result: toolResult,
                  tool,
                });
                yield {
                  type: "action:end",
                  id: tc.id,
                  name: tc.name,
                  result: toolResult,
                } as StreamEvent;
              } catch (error) {
                const errorResult = {
                  success: false,
                  error:
                    error instanceof Error
                      ? error.message
                      : "Tool execution failed",
                };
                serverToolResults.push({
                  id: tc.id,
                  name: tc.name,
                  args: tc.args,
                  result: errorResult,
                  tool,
                });
                yield {
                  type: "action:end",
                  id: tc.id,
                  name: tc.name,
                  error:
                    error instanceof Error
                      ? error.message
                      : "Tool execution failed",
                } as StreamEvent;
              }
            }
          }

          // If server tools were executed, continue the loop
          if (serverToolResults.length > 0) {
            // Build assistant message with tool_calls
            const assistantWithToolCalls: DoneEventMessage = {
              role: "assistant",
              content: result.content || null,
              tool_calls: result.toolCalls.map((tc) => ({
                id: tc.id,
                type: "function" as const,
                function: {
                  name: tc.name,
                  arguments: JSON.stringify(tc.args),
                },
                ...(tc.extra_content
                  ? { extra_content: tc.extra_content }
                  : {}),
              })),
            };

            // Build tool result messages (using buildToolResultForAI for AI response control)
            const toolResultMessages: DoneEventMessage[] =
              serverToolResults.map((tr) => {
                const aiContent = buildToolResultForAI(
                  tr.tool,
                  tr.result,
                  tr.args,
                );
                const content =
                  typeof aiContent === "string"
                    ? aiContent
                    : JSON.stringify(serializeToolResultContent(aiContent));
                return {
                  role: "tool" as const,
                  content,
                  tool_call_id: tr.id,
                };
              });

            // Add to accumulated messages
            newMessages.push(assistantWithToolCalls);
            newMessages.push(...toolResultMessages);

            // Update conversation for next iteration
            conversationMessages = [
              ...conversationMessages,
              assistantWithToolCalls as unknown as Record<string, unknown>,
              ...(toolResultMessages as unknown as Array<
                Record<string, unknown>
              >),
            ];
            toolSearchState = this.extendLoadedToolNames(
              toolSearchState,
              serverToolResults.map((toolResult) => ({
                name: toolResult.name,
                result: toolResult.result,
              })),
            );

            // Continue loop
            continue;
          }

          // Client tools - yield for client to execute and return
          if (clientToolCalls.length > 0) {
            const assistantMessage: AssistantToolMessage = {
              role: "assistant",
              content: result.content || null,
              tool_calls: clientToolCalls.map((tc) => ({
                id: tc.id,
                type: "function" as const,
                function: {
                  name: tc.name,
                  arguments: JSON.stringify(tc.args),
                },
                ...(tc.extra_content
                  ? { extra_content: tc.extra_content }
                  : {}),
              })),
            };

            newMessages.push(assistantMessage as DoneEventMessage);

            yield {
              type: "tool_calls",
              toolCalls: clientToolCalls,
              assistantMessage,
            } as StreamEvent;

            yield {
              type: "done",
              requiresAction: true,
              messages: newMessages,
              usage:
                accumulatedUsage.total_tokens > 0
                  ? accumulatedUsage
                  : undefined,
            } as StreamEvent;
            return;
          }
        }

        // No tool calls - we're done
        if (result.content) {
          newMessages.push({
            role: "assistant" as const,
            content: result.content,
          });
        }

        if (debug) {
          console.log(`[Copilot SDK] Complete after ${iteration} iterations`);
        }

        yield {
          type: "done",
          messages: newMessages.length > 0 ? newMessages : undefined,
          usage:
            accumulatedUsage.total_tokens > 0 ? accumulatedUsage : undefined,
        } as StreamEvent;
        return;
      } catch (error) {
        yield {
          type: "error",
          message: error instanceof Error ? error.message : "Unknown error",
          code: "COMPLETION_ERROR",
        } as StreamEvent;
        return;
      }
    }

    // Max iterations reached
    if (debug) {
      console.log(`[Copilot SDK] Max iterations (${maxIterations}) reached`);
    }

    yield {
      type: "done",
      messages: newMessages.length > 0 ? newMessages : undefined,
      usage: accumulatedUsage.total_tokens > 0 ? accumulatedUsage : undefined,
    } as StreamEvent;
  }

  /**
   * Convert tools to legacy action format (for adapter compatibility)
   */
  private convertToolsToActions(tools: ToolDefinition[]): ActionDefinition[] {
    return tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: this.convertInputSchemaToParameters(tool.inputSchema),
      handler: tool.handler || (async () => ({ handled: false })),
    }));
  }

  /**
   * Convert JSON Schema property to ActionParameter format recursively
   */
  private convertSchemaProperty(prop: unknown): ActionParameter {
    const p = prop as {
      type?: string;
      description?: string;
      enum?: string[];
      items?: unknown;
      properties?: Record<string, unknown>;
    };

    type ParamType = "string" | "number" | "boolean" | "object" | "array";
    const typeMap: Record<string, ParamType> = {
      string: "string",
      number: "number",
      integer: "number",
      boolean: "boolean",
      object: "object",
      array: "array",
    };

    const result: ActionParameter = {
      type: typeMap[p.type || "string"] || "string",
    };

    if (p.description) {
      result.description = p.description;
    }

    if (p.enum) {
      result.enum = p.enum;
    }

    // Preserve items for array types
    if (p.type === "array" && p.items) {
      result.items = this.convertSchemaProperty(p.items);
    }

    // Preserve properties for object types
    if (p.type === "object" && p.properties) {
      result.properties = Object.fromEntries(
        Object.entries(p.properties).map(([key, val]) => [
          key,
          this.convertSchemaProperty(val),
        ]),
      );
    }

    return result;
  }

  /**
   * Convert JSON Schema to legacy parameters format
   */
  private convertInputSchemaToParameters(
    schema: ToolDefinition["inputSchema"],
  ): Record<string, ActionParameter> {
    const parameters: Record<string, ActionParameter> = {};

    if (!schema?.properties) {
      return parameters;
    }

    for (const [name, prop] of Object.entries(schema.properties)) {
      const converted = this.convertSchemaProperty(prop);
      parameters[name] = {
        ...converted,
        required: schema.required?.includes(name),
      };
    }

    return parameters;
  }

  // ============================================
  // StreamResult API (Industry Standard Pattern)
  // ============================================

  /**
   * Stream chat and return StreamResult with helper methods
   *
   * This is the recommended API for new projects. It returns a StreamResult
   * object with multiple ways to consume the response:
   * - `pipeToResponse(res)` for Express/Node.js
   * - `toResponse()` for Next.js/Web API
   * - `collect()` for non-streaming use cases
   *
   * @example
   * ```typescript
   * // Express - one-liner
   * app.post('/chat', async (req, res) => {
   *   await runtime.stream(req.body).pipeToResponse(res);
   * });
   *
   * // Next.js App Router
   * export async function POST(req: Request) {
   *   const body = await req.json();
   *   return runtime.stream(body).toResponse();
   * }
   *
   * // With event handlers
   * const result = runtime.stream(body)
   *   .on('text', (text) => console.log(text))
   *   .on('done', (result) => console.log('Done:', result.text));
   * await result.pipeToResponse(res);
   *
   * // With onFinish for usage tracking
   * await runtime.stream(body, {
   *   onFinish: ({ messages, usage }) => {
   *     console.log('Tokens used:', usage?.totalTokens);
   *   }
   * }).pipeToResponse(res);
   * ```
   */
  stream(
    request: ChatRequest,
    options?: {
      signal?: AbortSignal;
      /**
       * Called after stream completes (for persistence, billing, etc.)
       * Usage data is only available server-side and is not exposed to clients.
       */
      onFinish?: (result: {
        messages: DoneEventMessage[];
        threadId?: string;
        usage?: {
          promptTokens: number;
          completionTokens: number;
          totalTokens: number;
        };
      }) => Promise<void> | void;
    },
  ): StreamResult {
    const storage = this.storage;

    if (!storage) {
      // No storage — original behavior
      const generator = this.processChatWithLoop(request, options?.signal);
      return new StreamResult(generator, { onFinish: options?.onFinish });
    }

    // With storage: wrap generator to auto-create session + save input before streaming
    let resolvedThreadId: string | undefined = request.threadId;
    const self = this;

    // Track whether storage is healthy for this request
    let storageHealthy = true;

    async function* storageWrappedGenerator(): AsyncGenerator<StreamEvent> {
      // Auto-create session if no threadId
      if (!resolvedThreadId) {
        try {
          const session = await storage!.createSession();
          resolvedThreadId = session.id;
        } catch (err) {
          console.error(
            "[Runtime] storage.createSession failed — generating fallback threadId:",
            err,
          );
          // Fallback: generate a local thread ID so the system doesn't break
          resolvedThreadId = `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
          storageHealthy = false;
        }
      }

      // Emit threadId early — before any message events — so the client can
      // adopt it immediately without waiting for the done chunk
      if (resolvedThreadId) {
        yield {
          type: "thread:created",
          threadId: resolvedThreadId,
        } as StreamEvent;
      }

      // Save input messages (user message / tool results)
      if (resolvedThreadId && storageHealthy) {
        try {
          const inputMsgs = extractInputMessages(request.messages);
          if (inputMsgs.length) {
            await storage!.saveMessages(resolvedThreadId, inputMsgs);
          }
        } catch (err) {
          console.error("[Runtime] storage.saveMessages (input) failed:", err);
        }
      }

      // Delegate to the real chat generator
      for await (const event of self.processChatWithLoop(
        request,
        options?.signal,
      )) {
        if (event.type === "done" && resolvedThreadId) {
          // Inject threadId into done event so client can adopt it
          yield { ...event, threadId: resolvedThreadId } as StreamEvent;
        } else {
          yield event;
        }
      }
    }

    return new StreamResult(storageWrappedGenerator(), {
      onFinish: async (result) => {
        // Save output messages after stream completes (skip if storage failed on createSession)
        if (resolvedThreadId && storageHealthy && result.messages.length > 0) {
          try {
            const outputMsgs = mapOutputMessages(result.messages);
            await storage.saveMessages(resolvedThreadId, outputMsgs);
          } catch (err) {
            console.error(
              "[Runtime] storage.saveMessages (output) failed:",
              err,
            );
          }
        }
        // Call user's onFinish
        if (options?.onFinish) {
          await options.onFinish({ ...result, threadId: resolvedThreadId });
        }
      },
    });
  }

  /**
   * Chat and collect the full response (non-streaming)
   *
   * Convenience method that calls stream().collect() for you.
   * Use this when you need the complete response before responding.
   *
   * @example
   * ```typescript
   * const { text, messages, toolCalls } = await runtime.chat(body);
   * console.log('Response:', text);
   * res.json({ response: text });
   *
   * // Usage is included in result - strip before sending to client
   * const { usage, ...clientResult } = await runtime.chat(body);
   * await billing.record(usage);
   * res.json(clientResult);
   * ```
   */
  async chat(
    request: ChatRequest,
    options?: {
      signal?: AbortSignal;
    },
  ): Promise<CollectedResult> {
    // Usage is included in result - user can strip before sending to client
    return this.stream(request, { signal: options?.signal }).collect({
      includeUsage: true,
    });
  }

  /**
   * Generate a complete response (non-streaming)
   *
   * Like Vercel AI SDK's generateText() - clean, non-streaming API.
   * Returns GenerateResult with .toResponse() for CopilotChat format.
   *
   * @example
   * ```typescript
   * // Simple usage
   * const result = await runtime.generate(body);
   * console.log(result.text);
   *
   * // CopilotChat format response (Express)
   * res.json(result.toResponse());
   *
   * // CopilotChat format response (Next.js)
   * return Response.json(result.toResponse());
   *
   * // With persistence callback
   * const result = await runtime.generate(body, {
   *   onFinish: async ({ messages }) => {
   *     await db.saveMessages(messages);
   *   },
   * });
   * ```
   */
  async generate(
    request: ChatRequest,
    options?: GenerateOptions,
  ): Promise<GenerateResult> {
    const generator = this.processChatWithLoop(
      { ...request, streaming: false },
      options?.signal,
      undefined,
      undefined,
      options?.httpRequest,
    );

    let text = "";
    const toolCalls: Array<{
      id: string;
      name: string;
      args: Record<string, unknown>;
    }> = [];
    const toolResults: Array<{ id: string; result: unknown }> = [];
    let messages: DoneEventMessage[] = [];
    let requiresAction = false;
    let error: { message: string; code?: string } | undefined;

    try {
      for await (const event of generator) {
        switch (event.type) {
          case "message:delta":
            text += event.content;
            break;
          case "action:start":
            toolCalls.push({ id: event.id, name: event.name, args: {} });
            break;
          case "action:args": {
            const tc = toolCalls.find((t) => t.id === event.id);
            if (tc) {
              try {
                tc.args = JSON.parse(event.args || "{}");
              } catch {
                tc.args = {};
              }
            }
            break;
          }
          case "action:end":
            toolResults.push({
              id: event.id,
              result: event.result || event.error,
            });
            break;
          case "done":
            messages = event.messages || [];
            requiresAction = event.requiresAction || false;
            break;
          case "error":
            error = { message: event.message, code: event.code };
            break;
        }
      }
    } catch (err) {
      error = {
        message: err instanceof Error ? err.message : "Unknown error",
        code: "GENERATION_ERROR",
      };
    }

    // Call onFinish callback if provided and no error
    if (options?.onFinish && messages.length > 0 && !error) {
      try {
        await options.onFinish({
          messages,
          threadId: request.threadId,
        });
      } catch (callbackError) {
        console.error(
          "[Copilot SDK] generate() onFinish callback error:",
          callbackError,
        );
      }
    }

    return new GenerateResult({
      text,
      messages,
      toolCalls,
      toolResults,
      requiresAction,
      error,
    });
  }

  /**
   * Create Express-compatible handler middleware
   *
   * Returns a function that can be used directly as Express middleware.
   *
   * @example
   * ```typescript
   * // Simple usage
   * app.post('/chat', runtime.expressHandler());
   *
   * // With options
   * app.post('/chat', runtime.expressHandler({ format: 'text' }));
   * ```
   */
  expressHandler(options?: {
    /** Response format: 'sse' (default) or 'text' */
    format?: "sse" | "text";
    /** Additional headers to include */
    headers?: Record<string, string>;
  }) {
    return async (
      req: { body: ChatRequest },
      res: {
        setHeader(name: string, value: string): void;
        write(chunk: string): boolean;
        end(): void;
        status(code: number): { json(data: unknown): void };
      },
    ) => {
      try {
        const result = this.stream(req.body);

        if (options?.format === "text") {
          await result.pipeTextToResponse(res, { headers: options?.headers });
        } else {
          await result.pipeToResponse(res, { headers: options?.headers });
        }
      } catch (error) {
        console.error("[Runtime] Express handler error:", error);
        res.status(500).json({
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    };
  }
}

/**
 * Create runtime instance
 */
export function createRuntime(config: RuntimeConfig): Runtime {
  return new Runtime(config);
}
