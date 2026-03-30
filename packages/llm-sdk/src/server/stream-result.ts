/**
 * StreamResult - Industry-standard streaming result object
 *
 * Provides multiple ways to consume streaming responses:
 * - Web API: toResponse(), toTextResponse()
 * - Node.js/Express: pipeToResponse(), pipeTextToResponse()
 * - Collection: collect(), text()
 * - Iteration: for await...of
 *
 * @example
 * ```typescript
 * // Express - one-liner
 * app.post('/chat', async (req, res) => {
 *   await runtime.stream(req.body).pipeToResponse(res);
 * });
 *
 * // Next.js
 * export async function POST(req: Request) {
 *   const body = await req.json();
 *   return runtime.stream(body).toResponse();
 * }
 *
 * // Collect full response
 * const { text, messages } = await runtime.stream(body).collect();
 * ```
 */

import type {
  StreamEvent,
  DoneEventMessage,
  ToolCallInfo,
  TokenUsageRaw,
} from "../core/stream-events";
import {
  createSSEHeaders,
  formatSSEData,
  createEventStream,
} from "./streaming";

/**
 * Options for response methods
 */
export interface StreamResultOptions {
  /** Additional headers to include in response */
  headers?: Record<string, string>;
  /**
   * Include token usage in response (default: false)
   * Set to true for raw API access where you need usage data.
   * When false, usage is stripped from client-facing responses
   * but still available in onFinish callback for billing.
   */
  includeUsage?: boolean;
}

/**
 * Result passed to onFinish callback
 */
export interface OnFinishResult {
  /** All messages from the stream (for persistence) */
  messages: DoneEventMessage[];
  /** Token usage for billing/tracking (server-side only) */
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  /** Session ID — present when storage adapter created/resolved a session */
  threadId?: string;
}

/**
 * Options for StreamResult constructor
 */
export interface StreamResultConstructorOptions {
  /**
   * Called after stream completes (for persistence, billing, etc.)
   * Usage data is only available server-side and is not exposed to clients.
   */
  onFinish?: (result: OnFinishResult) => Promise<void> | void;
}

/**
 * Collected result after consuming the stream
 */
export interface CollectedResult {
  /** Accumulated text content */
  text: string;
  /** All messages from the stream (for persistence) */
  messages: DoneEventMessage[];
  /** Tool calls that were made */
  toolCalls: ToolCallInfo[];
  /** Whether client action is required (client-side tools) */
  requiresAction: boolean;
  /** Token usage for billing/tracking */
  usage?: TokenUsageRaw;
  /** Session ID — present when storage adapter created/resolved a session */
  threadId?: string;
  /** Raw events (for debugging) */
  events: StreamEvent[];
}

/**
 * Node.js ServerResponse interface (minimal subset)
 * Note: Return types are `unknown` to support both Node.js (returns `this`)
 * and Express (returns `void`) response objects.
 */
interface NodeServerResponse {
  setHeader(name: string, value: string | number | readonly string[]): unknown;
  write(chunk: string | Buffer): boolean;
  end(): unknown;
}

/**
 * Event handler types for the on() method
 */
type TextHandler = (text: string) => void;
type ToolCallHandler = (toolCall: ToolCallInfo) => void;
type DoneHandler = (result: CollectedResult) => void;
type ErrorHandler = (error: Error) => void;

/**
 * StreamResult provides multiple ways to consume a streaming response.
 *
 * This follows the industry-standard pattern used by Vercel AI SDK,
 * OpenAI SDK, and Anthropic SDK.
 */
export class StreamResult {
  private generator: AsyncGenerator<StreamEvent>;
  private consumed = false;
  private eventHandlers = new Map<string, Function>();
  private onFinishCallback?: StreamResultConstructorOptions["onFinish"];
  // Store usage from done event (before it's stripped for client)
  private capturedUsage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens?: number;
  };

  constructor(
    generator: AsyncGenerator<StreamEvent>,
    options?: StreamResultConstructorOptions,
  ) {
    this.generator = generator;
    this.onFinishCallback = options?.onFinish;
  }

  // ============================================
  // Async Iteration (base pattern)
  // ============================================

  /**
   * Iterate over stream events
   *
   * @example
   * ```typescript
   * const result = runtime.stream(body);
   * for await (const event of result) {
   *   if (event.type === 'message:delta') {
   *     console.log(event.content);
   *   }
   * }
   * ```
   */
  [Symbol.asyncIterator](): AsyncIterator<StreamEvent> {
    this.ensureNotConsumed();
    return this.generator;
  }

  // ============================================
  // Web API Response Methods (Next.js, Cloudflare, Deno)
  // ============================================

  /**
   * Returns SSE Response for Web API frameworks
   *
   * @example
   * ```typescript
   * // Next.js App Router
   * export async function POST(req: Request) {
   *   const body = await req.json();
   *   return runtime.stream(body).toResponse();
   * }
   * ```
   */
  toResponse(options?: StreamResultOptions): Response {
    this.ensureNotConsumed();

    const headers = {
      ...createSSEHeaders(),
      ...options?.headers,
    };

    return new Response(createEventStream(this.generator), { headers });
  }

  /**
   * Alias for toResponse() - returns SSE Response
   */
  toSSEResponse(options?: StreamResultOptions): Response {
    return this.toResponse(options);
  }

  /**
   * Returns text-only Response (no SSE events, just text content)
   *
   * @example
   * ```typescript
   * // Simple text streaming
   * return runtime.stream(body).toTextResponse();
   * ```
   */
  toTextResponse(options?: StreamResultOptions): Response {
    this.ensureNotConsumed();

    const encoder = new TextEncoder();
    const generator = this.generator;

    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of generator) {
            if (event.type === "message:delta") {
              controller.enqueue(encoder.encode(event.content));
            }
          }
        } catch (error) {
          console.error("[StreamResult] Text stream error:", error);
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
        ...options?.headers,
      },
    });
  }

  /**
   * Returns the underlying ReadableStream
   *
   * @example
   * ```typescript
   * const stream = runtime.stream(body).toReadableStream();
   * // Use with custom handling
   * ```
   */
  toReadableStream(): ReadableStream<Uint8Array> {
    this.ensureNotConsumed();
    return createEventStream(this.generator);
  }

  // ============================================
  // Node.js/Express Response Methods
  // ============================================

  /**
   * Pipe SSE stream to Node.js ServerResponse
   *
   * @example
   * ```typescript
   * // Express - one-liner
   * app.post('/chat', async (req, res) => {
   *   await runtime.stream(req.body).pipeToResponse(res);
   * });
   * ```
   */
  async pipeToResponse(
    res: NodeServerResponse,
    options?: StreamResultOptions,
  ): Promise<CollectedResult> {
    this.ensureNotConsumed();

    // Set SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");

    // Apply custom headers
    if (options?.headers) {
      for (const [key, value] of Object.entries(options.headers)) {
        res.setHeader(key, value);
      }
    }

    // Collect result while streaming
    const collected = this.createCollector();

    const includeUsage = options?.includeUsage ?? false;

    try {
      for await (const event of this.generator) {
        // Collect event (captures usage for onFinish)
        this.collectEvent(event, collected);

        // Call event handlers
        this.callEventHandlers(event, collected);

        // Write to response (conditionally strip usage from done event)
        if (!includeUsage && event.type === "done" && "usage" in event) {
          const { usage: _usage, ...clientEvent } = event;
          res.write(formatSSEData(clientEvent as StreamEvent));
        } else {
          res.write(formatSSEData(event));
        }
      }
    } catch (error) {
      // Send error event
      const errorEvent: StreamEvent = {
        type: "error",
        message: error instanceof Error ? error.message : "Unknown error",
      };
      res.write(formatSSEData(errorEvent));

      // Call error handler
      const errorHandler = this.eventHandlers.get("error") as ErrorHandler;
      if (errorHandler) {
        errorHandler(error instanceof Error ? error : new Error(String(error)));
      }
    } finally {
      res.write("data: [DONE]\n\n");
      res.end();
    }

    // Call done handler
    const doneHandler = this.eventHandlers.get("done") as DoneHandler;
    if (doneHandler) {
      doneHandler(collected);
    }

    // Call onFinish callback (has access to usage)
    await this.callOnFinish(collected);

    // Return result (strip usage unless includeUsage is true)
    return includeUsage ? collected : this.stripUsageFromResult(collected);
  }

  /**
   * Pipe text-only stream to Node.js ServerResponse
   *
   * @example
   * ```typescript
   * // Express - text-only streaming
   * app.post('/chat', async (req, res) => {
   *   await runtime.stream(req.body).pipeTextToResponse(res);
   * });
   * ```
   */
  async pipeTextToResponse(
    res: NodeServerResponse,
    options?: StreamResultOptions,
  ): Promise<CollectedResult> {
    this.ensureNotConsumed();

    // Set text headers
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache");

    // Apply custom headers
    if (options?.headers) {
      for (const [key, value] of Object.entries(options.headers)) {
        res.setHeader(key, value);
      }
    }

    // Collect result while streaming
    const collected = this.createCollector();

    try {
      for await (const event of this.generator) {
        // Collect event
        this.collectEvent(event, collected);

        // Call event handlers
        this.callEventHandlers(event, collected);

        // Write text content only
        if (event.type === "message:delta") {
          res.write(event.content);
        }
      }
    } catch (error) {
      const errorHandler = this.eventHandlers.get("error") as ErrorHandler;
      if (errorHandler) {
        errorHandler(error instanceof Error ? error : new Error(String(error)));
      }
    } finally {
      res.end();
    }

    // Call done handler
    const doneHandler = this.eventHandlers.get("done") as DoneHandler;
    if (doneHandler) {
      doneHandler(collected);
    }

    // Call onFinish callback (has access to usage)
    await this.callOnFinish(collected);

    // Return result (strip usage unless includeUsage is true)
    const includeUsage = options?.includeUsage ?? false;
    return includeUsage ? collected : this.stripUsageFromResult(collected);
  }

  // ============================================
  // Collection Methods
  // ============================================

  /**
   * Collect all events and return final result
   *
   * @example
   * ```typescript
   * // Default: usage stripped for client-facing responses
   * const { text, messages, toolCalls } = await runtime.stream(body).collect();
   *
   * // Raw: include usage for server-side processing
   * const { text, usage } = await runtime.stream(body).collect({ includeUsage: true });
   * ```
   */
  async collect(options?: StreamResultOptions): Promise<CollectedResult> {
    this.ensureNotConsumed();

    const collected = this.createCollector();

    for await (const event of this.generator) {
      this.collectEvent(event, collected);
      this.callEventHandlers(event, collected);
    }

    // Call done handler
    const doneHandler = this.eventHandlers.get("done") as DoneHandler;
    if (doneHandler) {
      doneHandler(collected);
    }

    // Call onFinish callback (has access to usage)
    await this.callOnFinish(collected);

    // Return result (strip usage unless includeUsage is true)
    const includeUsage = options?.includeUsage ?? false;
    return includeUsage ? collected : this.stripUsageFromResult(collected);
  }

  /**
   * Get final text (convenience method)
   *
   * @example
   * ```typescript
   * const text = await runtime.stream(body).text();
   * ```
   */
  async text(): Promise<string> {
    const result = await this.collect();
    return result.text;
  }

  // ============================================
  // Event Emitter Pattern (like Anthropic SDK)
  // ============================================

  /**
   * Register event handler for streaming events
   *
   * @example
   * ```typescript
   * const result = runtime.stream(body)
   *   .on('text', (text) => console.log('Text:', text))
   *   .on('toolCall', (call) => console.log('Tool:', call.name))
   *   .on('done', (result) => console.log('Final:', result.text))
   *   .on('error', (err) => console.error('Error:', err));
   *
   * await result.pipeToResponse(res);
   * ```
   */
  on(event: "text", handler: TextHandler): this;
  on(event: "toolCall", handler: ToolCallHandler): this;
  on(event: "done", handler: DoneHandler): this;
  on(event: "error", handler: ErrorHandler): this;
  on(event: string, handler: Function): this {
    this.eventHandlers.set(event, handler);
    return this;
  }

  // ============================================
  // Internal Methods
  // ============================================

  /**
   * Ensure stream hasn't been consumed
   */
  private ensureNotConsumed(): void {
    if (this.consumed) {
      throw new Error(
        "StreamResult has already been consumed. " +
          "Each StreamResult can only be consumed once.",
      );
    }
    this.consumed = true;
  }

  /**
   * Create empty collector object
   */
  private createCollector(): CollectedResult {
    return {
      text: "",
      messages: [],
      toolCalls: [],
      requiresAction: false,
      usage: undefined,
      threadId: undefined,
      events: [],
    };
  }

  /**
   * Collect event into result
   */
  private collectEvent(event: StreamEvent, collected: CollectedResult): void {
    collected.events.push(event);

    switch (event.type) {
      case "message:delta":
        collected.text += event.content;
        break;

      case "tool_calls":
        collected.toolCalls.push(...event.toolCalls);
        break;

      case "action:start":
        // Capture tool call with hidden flag (for server-side tools)
        collected.toolCalls.push({
          id: event.id,
          name: event.name,
          args: {},
          hidden: event.hidden,
        });
        break;

      case "action:args": {
        // Update args for the tool call
        const tc = collected.toolCalls.find((t) => t.id === event.id);
        if (tc) {
          try {
            tc.args = JSON.parse(event.args || "{}");
          } catch {
            tc.args = {};
          }
        }
        break;
      }

      case "done":
        if (event.messages) {
          collected.messages.push(...event.messages);
        }
        if (event.requiresAction) {
          collected.requiresAction = true;
        }
        if (event.usage) {
          // Capture usage before it might be stripped
          this.capturedUsage = event.usage;
          collected.usage = event.usage;
        }
        if (event.threadId) {
          collected.threadId = event.threadId;
        }
        break;
    }
  }

  /**
   * Call onFinish callback with collected result
   */
  private async callOnFinish(collected: CollectedResult): Promise<void> {
    if (this.onFinishCallback) {
      try {
        const usage = this.capturedUsage;
        await this.onFinishCallback({
          messages: collected.messages,
          threadId: collected.threadId,
          usage: usage
            ? {
                promptTokens: usage.prompt_tokens,
                completionTokens: usage.completion_tokens,
                totalTokens:
                  usage.total_tokens ??
                  usage.prompt_tokens + usage.completion_tokens,
              }
            : undefined,
        });
      } catch (error) {
        console.error("[StreamResult] onFinish callback error:", error);
      }
    }
  }

  /**
   * Call registered event handlers
   */
  private callEventHandlers(
    event: StreamEvent,
    collected: CollectedResult,
  ): void {
    switch (event.type) {
      case "message:delta": {
        const textHandler = this.eventHandlers.get("text") as TextHandler;
        if (textHandler) {
          textHandler(event.content);
        }
        break;
      }

      case "tool_calls": {
        const toolCallHandler = this.eventHandlers.get(
          "toolCall",
        ) as ToolCallHandler;
        if (toolCallHandler) {
          for (const toolCall of event.toolCalls) {
            toolCallHandler(toolCall);
          }
        }
        break;
      }

      case "error": {
        const errorHandler = this.eventHandlers.get("error") as ErrorHandler;
        if (errorHandler) {
          errorHandler(new Error(event.message));
        }
        break;
      }
    }
  }

  /**
   * Strip usage from result (usage is server-side only for billing)
   * Client-facing APIs should not expose token usage
   */
  private stripUsageFromResult(collected: CollectedResult): CollectedResult {
    const { usage: _usage, events, ...clientResult } = collected;
    // Also strip usage from done event in events array
    const cleanedEvents = events.map((event) => {
      if (event.type === "done" && "usage" in event) {
        const { usage: _eventUsage, ...cleanEvent } = event;
        return cleanEvent as StreamEvent;
      }
      return event;
    });
    return { ...clientResult, events: cleanedEvents } as CollectedResult;
  }
}

/**
 * Create a StreamResult from an async generator
 *
 * @example
 * ```typescript
 * const result = createStreamResult(generator);
 * await result.pipeToResponse(res);
 * ```
 */
export function createStreamResult(
  generator: AsyncGenerator<StreamEvent>,
): StreamResult {
  return new StreamResult(generator);
}
