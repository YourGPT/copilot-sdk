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
} from "@yourgpt/copilot-sdk-core";
import type { AIProvider } from "../providers/types";
import { createMessage } from "@yourgpt/copilot-sdk-core";
import type { LLMAdapter, ChatCompletionRequest } from "../adapters";
import {
  createOpenAIAdapter,
  createAnthropicAdapter,
  createGroqAdapter,
  createOllamaAdapter,
} from "../adapters";
import type { RuntimeConfig, ChatRequest } from "./types";
import { createSSEResponse } from "./streaming";

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
      // NEW: Use AIProvider to get adapter
      this.adapter = config.provider.languageModel(config.model);
    } else if ("adapter" in config && config.adapter) {
      // EXISTING: Direct adapter
      this.adapter = config.adapter;
    } else {
      // EXISTING: Legacy LLM config
      this.adapter = this.createAdapter(config);
    }

    // Register actions (legacy)
    if (config.actions) {
      for (const action of config.actions) {
        this.actions.set(action.name, action);
      }
    }

    // Register tools (new)
    if (config.tools) {
      for (const tool of config.tools) {
        this.tools.set(tool.name, tool);
      }
    }
  }

  /**
   * Create LLM adapter based on config
   */
  private createAdapter(config: RuntimeConfig): LLMAdapter {
    if (!("llm" in config) || !config.llm) {
      throw new Error(
        "LLM configuration is required when adapter is not provided",
      );
    }
    const { llm } = config;

    switch (llm.provider) {
      case "openai":
        return createOpenAIAdapter({
          apiKey: llm.apiKey,
          model: llm.model,
          baseUrl: llm.baseUrl,
          temperature: llm.temperature,
          maxTokens: llm.maxTokens,
        });

      case "anthropic":
        return createAnthropicAdapter({
          apiKey: llm.apiKey,
          model: llm.model,
          temperature: llm.temperature,
          maxTokens: llm.maxTokens,
        });

      case "groq":
        return createGroqAdapter({
          apiKey: llm.apiKey,
          model: llm.model,
          temperature: llm.temperature,
          maxTokens: llm.maxTokens,
        });

      case "ollama":
        return createOllamaAdapter({
          model: llm.model,
          baseUrl: llm.baseUrl,
          temperature: llm.temperature,
          maxTokens: llm.maxTokens,
        });

      default:
        // Default to OpenAI-compatible
        return createOpenAIAdapter({
          apiKey: llm.apiKey,
          model: llm.model,
          baseUrl: llm.baseUrl,
          temperature: llm.temperature,
          maxTokens: llm.maxTokens,
        });
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
   */
  async handleRequest(request: Request): Promise<Response> {
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
        );
      }

      // STREAMING: Process chat and return SSE response
      const generator = useAgentLoop
        ? this.processChatWithLoop(body, signal, undefined, undefined, request)
        : this.processChat(body, signal);
      return createSSEResponse(generator);
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
   * Handle non-streaming request - returns JSON instead of SSE
   */
  private async handleNonStreamingRequest(
    body: ChatRequest,
    signal: AbortSignal | undefined,
    useAgentLoop: boolean,
    httpRequest: Request,
  ): Promise<Response> {
    try {
      const generator = useAgentLoop
        ? this.processChatWithLoop(
            body,
            signal,
            undefined,
            undefined,
            httpRequest,
          )
        : this.processChat(body, signal);

      // Collect all events
      const events: StreamEvent[] = [];
      let content = "";
      const toolCalls: ToolCallInfo[] = [];
      const toolResults: Array<{ id: string; result: unknown }> = [];
      let messages: DoneEventMessage[] | undefined;
      let requiresAction = false;
      let error: { message: string; code?: string } | undefined;

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
            break;
          case "error":
            error = { message: event.message, code: event.code };
            break;
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
   * Get the AI provider name from config
   */
  private getProviderName(): string {
    if ("provider" in this.config && this.config.provider) {
      return this.config.provider.name;
    }
    if ("llm" in this.config && this.config.llm) {
      return this.config.llm.provider;
    }
    // Default to openai if using custom adapter
    return "openai";
  }

  /**
   * Get the AI provider instance (if using provider config)
   */
  getProvider(): AIProvider | null {
    if ("provider" in this.config && this.config.provider) {
      return this.config.provider as AIProvider;
    }
    return null;
  }

  /**
   * Get the current model ID
   */
  getModel(): string {
    if ("provider" in this.config && this.config.provider) {
      return this.config.model;
    }
    if ("llm" in this.config && this.config.llm) {
      return this.config.llm.model || "unknown";
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
          // Don't yield done yet - we need to check for tool calls first
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
        yield {
          type: "done",
          requiresAction: true,
          messages: newMessages,
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
    yield {
      type: "done",
      messages: newMessages.length > 0 ? newMessages : undefined,
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

    for (const [name, prop] of Object.entries(schema.properties)) {
      const converted = this.convertSchemaProperty(prop);
      parameters[name] = {
        ...converted,
        required: schema.required?.includes(name),
      };
    }

    return parameters;
  }
}

/**
 * Create runtime instance
 */
export function createRuntime(config: RuntimeConfig): Runtime {
  return new Runtime(config);
}
