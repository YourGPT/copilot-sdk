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
import { createSSEResponse } from "./streaming";
import { StreamResult, type CollectedResult } from "./stream-result";
import { GenerateResult } from "./generate-result";

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
  private actions: Map<string, ActionDefinition> = new Map();
  private tools: Map<string, ToolDefinition> = new Map();

  constructor(config: RuntimeConfig) {
    this.config = config;

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
      systemPrompt: request.systemPrompt || this.config.systemPrompt,
      config: request.config,
      signal,
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
        console.log("[Copilot SDK] Request:", JSON.stringify(body, null, 2));
      }

      // Create abort controller from request signal
      const signal = request.signal;

      // Use agent loop if tools are present or explicitly enabled
      const hasTools =
        (body.tools && body.tools.length > 0) || this.tools.size > 0;
      const useAgentLoop = hasTools || this.config.agentLoop?.enabled;

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
  ): AsyncGenerator<StreamEvent> {
    const debug = this.config.debug || this.config.agentLoop?.debug;

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
      )) {
        yield event;
      }
      return;
    }

    // Track new messages created during this request
    const newMessages: DoneEventMessage[] = _accumulatedMessages || [];
    const maxIterations = this.config.agentLoop?.maxIterations || 20;

    // Collect all tools (server + client from request)
    const allTools: ToolDefinition[] = [...this.tools.values()];

    // Add client tools from request
    if (request.tools) {
      for (const tool of request.tools) {
        allTools.push({
          name: tool.name,
          description: tool.description,
          location: "client",
          inputSchema: tool.inputSchema as ToolDefinition["inputSchema"],
        });
      }
    }

    if (debug) {
      console.log(
        `[Copilot SDK] Processing chat with ${allTools.length} tools`,
      );
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
    const systemPrompt = request.systemPrompt || this.config.systemPrompt || "";

    // Accumulate data from stream
    let accumulatedText = "";
    const toolCalls: ToolCallInfo[] = [];
    let currentToolCall: { id: string; name: string; args: string } | null =
      null;
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
      actions: this.convertToolsToActions(allTools),
      systemPrompt: systemPrompt,
      config: request.config,
      signal,
    };

    // Stream from adapter
    const stream = this.adapter.stream(completionRequest);

    // Process stream events
    for await (const event of stream) {
      switch (event.type) {
        case "message:start":
        case "message:end":
          yield event; // Forward to client
          break;

        case "message:delta":
          accumulatedText += event.content;
          yield event; // Forward text to client
          break;

        case "action:start":
          currentToolCall = { id: event.id, name: event.name, args: "" };
          if (debug) {
            console.log(`[Copilot SDK] Tool call started: ${event.name}`);
          }
          yield event; // Forward to client
          break;

        case "action:args":
          if (currentToolCall) {
            try {
              const parsedArgs = JSON.parse(event.args || "{}");
              if (debug) {
                console.log(
                  `[Copilot SDK] Tool args for ${currentToolCall.name}:`,
                  parsedArgs,
                );
              }
              toolCalls.push({
                id: currentToolCall.id,
                name: currentToolCall.name,
                args: parsedArgs,
              });
            } catch (e) {
              console.error(
                "[Copilot SDK] Failed to parse tool args:",
                event.args,
                e,
              );
              toolCalls.push({
                id: currentToolCall.id,
                name: currentToolCall.name,
                args: {},
              });
            }
            currentToolCall = null;
          }
          yield event; // Forward to client
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

      // Separate server-side and client-side tool calls
      const serverToolCalls: ToolCallInfo[] = [];
      const clientToolCalls: ToolCallInfo[] = [];

      for (const tc of toolCalls) {
        const tool = allTools.find((t) => t.name === tc.name);
        if (tool?.location === "server" && tool.handler) {
          serverToolCalls.push(tc);
        } else {
          clientToolCalls.push(tc);
        }
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
        const tool = allTools.find((t) => t.name === tc.name);
        if (tool?.handler) {
          if (debug) {
            console.log(`[Copilot SDK] Executing server-side tool: ${tc.name}`);
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
            const result = await tool.handler(tc.args, toolContext);
            serverToolResults.push({
              id: tc.id,
              name: tc.name,
              args: tc.args,
              result,
              tool,
            });

            yield {
              type: "action:end",
              id: tc.id,
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
              id: tc.id,
              name: tc.name,
              args: tc.args,
              result: errorResult,
              tool,
            });

            yield {
              type: "action:end",
              id: tc.id,
              error:
                error instanceof Error
                  ? error.message
                  : "Tool execution failed",
            } as StreamEvent;
          }
        }
      }

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
          tool_calls: serverToolCalls.map((tc) => ({
            id: tc.id,
            type: "function" as const,
            function: {
              name: tc.name,
              arguments: JSON.stringify(tc.args),
            },
          })),
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

        // Continue the agent loop - pass accumulated messages and HTTP request
        for await (const event of this.processChatWithLoop(
          nextRequest,
          signal,
          newMessages,
          true, // Mark as recursive
          _httpRequest,
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
  ): AsyncGenerator<StreamEvent> {
    const newMessages: DoneEventMessage[] = _accumulatedMessages || [];
    const debug = this.config.debug || this.config.agentLoop?.debug;
    const maxIterations = this.config.agentLoop?.maxIterations || 20;
    // Track accumulated usage across iterations (for onFinish callback)
    const accumulatedUsage: {
      prompt_tokens: number;
      completion_tokens: number;
      total_tokens: number;
    } = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };

    // Collect all tools (server + client from request)
    const allTools: ToolDefinition[] = [...this.tools.values()];

    // Add client tools from request
    if (request.tools) {
      for (const tool of request.tools) {
        allTools.push({
          name: tool.name,
          description: tool.description,
          location: "client",
          inputSchema: tool.inputSchema as ToolDefinition["inputSchema"],
        });
      }
    }

    // Build system prompt
    const systemPrompt = request.systemPrompt || this.config.systemPrompt || "";

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
        )) {
          yield event;
        }
        return;
      }

      // Create completion request
      const completionRequest: ChatCompletionRequest = {
        messages: [],
        rawMessages: conversationMessages,
        actions: this.convertToolsToActions(allTools),
        systemPrompt: systemPrompt,
        config: request.config,
        signal,
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
            const tool = allTools.find((t) => t.name === tc.name);
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
            yield {
              type: "action:start",
              id: tc.id,
              name: tc.name,
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
            const tool = allTools.find((t) => t.name === tc.name);
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
        usage?: {
          promptTokens: number;
          completionTokens: number;
          totalTokens: number;
        };
      }) => Promise<void> | void;
    },
  ): StreamResult {
    const generator = this.processChatWithLoop(request, options?.signal);
    return new StreamResult(generator, { onFinish: options?.onFinish });
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
