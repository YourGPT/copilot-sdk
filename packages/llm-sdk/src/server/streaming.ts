import type { StreamEvent } from "../core/stream-events";
import { responseReplayMetadata } from "../core/openai-responses";

/**
 * Node.js ServerResponse interface (minimal subset for type safety)
 * Note: Return types are `unknown` to support both Node.js (returns `this`)
 * and Express (returns `void`) response objects.
 */
interface NodeServerResponse {
  setHeader(name: string, value: string | number | readonly string[]): unknown;
  write(chunk: string | Buffer): boolean;
  end(): unknown;
}

/**
 * Create SSE response headers
 */
export function createSSEHeaders(): Record<string, string> {
  return {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  };
}

/**
 * Create text stream response headers
 */
export function createTextStreamHeaders(): Record<string, string> {
  return {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-cache",
  };
}

/**
 * Format event as SSE data
 */
export function formatSSEData(event: StreamEvent): string {
  const safeEvent = { ...event };
  if ("providerMetadata" in safeEvent)
    safeEvent.providerMetadata = responseReplayMetadata(
      safeEvent.providerMetadata,
    );
  if (safeEvent.type === "done" && safeEvent.messages)
    safeEvent.messages = safeEvent.messages.map((message) => ({
      ...message,
      ...(message.providerMetadata
        ? { providerMetadata: responseReplayMetadata(message.providerMetadata) }
        : {}),
    }));
  return `data: ${JSON.stringify(safeEvent)}\n\n`;
}

/**
 * Create a ReadableStream from an async generator of events
 */
export function createEventStream(
  generator: AsyncGenerator<StreamEvent>,
  options?: { includeUsage?: boolean },
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      try {
        for await (const event of generator) {
          let clientEvent = event;
          if (event.type === "done" && !options?.includeUsage) {
            const { usage: _usage, ...withoutUsage } = event;
            clientEvent = withoutUsage;
          }
          const data = formatSSEData(clientEvent);
          controller.enqueue(encoder.encode(data));
        }
      } catch (error) {
        // Send error event
        const errorEvent: StreamEvent = {
          type: "error",
          message: error instanceof Error ? error.message : "Unknown error",
        };
        controller.enqueue(encoder.encode(formatSSEData(errorEvent)));
      } finally {
        // Send done event
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      }
    },
  });
}

/**
 * Create SSE Response object
 */
export function createSSEResponse(
  generator: AsyncGenerator<StreamEvent>,
  options?: { headers?: Record<string, string> },
): Response {
  return new Response(createEventStream(generator), {
    headers: {
      ...createSSEHeaders(),
      ...options?.headers,
    },
  });
}

/**
 * Create text-only stream Response (no SSE events, just text content)
 *
 * @example
 * ```typescript
 * const generator = runtime.processChatWithLoop(body);
 * return createTextStreamResponse(generator);
 * ```
 */
export function createTextStreamResponse(
  generator: AsyncGenerator<StreamEvent>,
  options?: { headers?: Record<string, string> },
): Response {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of generator) {
          if (event.type === "message:delta") {
            controller.enqueue(encoder.encode(event.content));
          }
        }
      } catch (error) {
        console.error("[Streaming] Text stream error:", error);
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      ...createTextStreamHeaders(),
      ...options?.headers,
    },
  });
}

/**
 * Pipe SSE stream to Node.js ServerResponse
 *
 * Standalone helper for piping streaming events directly to Express/Node.js responses.
 *
 * @example
 * ```typescript
 * // Express
 * app.post('/chat', async (req, res) => {
 *   const generator = runtime.processChatWithLoop(req.body);
 *   await pipeSSEToResponse(generator, res);
 * });
 * ```
 */
export async function pipeSSEToResponse(
  generator: AsyncGenerator<StreamEvent>,
  res: NodeServerResponse,
  options?: { headers?: Record<string, string> },
): Promise<void> {
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

  try {
    for await (const event of generator) {
      res.write(formatSSEData(event));
    }
  } catch (error) {
    // Send error event
    const errorEvent: StreamEvent = {
      type: "error",
      message: error instanceof Error ? error.message : "Unknown error",
    };
    res.write(formatSSEData(errorEvent));
  } finally {
    res.write("data: [DONE]\n\n");
    res.end();
  }
}

/**
 * Pipe text-only stream to Node.js ServerResponse
 *
 * Standalone helper for piping only text content to Express/Node.js responses.
 *
 * @example
 * ```typescript
 * // Express - text only
 * app.post('/chat', async (req, res) => {
 *   const generator = runtime.processChatWithLoop(req.body);
 *   await pipeTextToResponse(generator, res);
 * });
 * ```
 */
export async function pipeTextToResponse(
  generator: AsyncGenerator<StreamEvent>,
  res: NodeServerResponse,
  options?: { headers?: Record<string, string> },
): Promise<void> {
  // Set text headers
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache");

  // Apply custom headers
  if (options?.headers) {
    for (const [key, value] of Object.entries(options.headers)) {
      res.setHeader(key, value);
    }
  }

  try {
    for await (const event of generator) {
      if (event.type === "message:delta") {
        res.write(event.content);
      }
    }
  } finally {
    res.end();
  }
}
