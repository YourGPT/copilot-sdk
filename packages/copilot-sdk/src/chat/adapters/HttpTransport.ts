/**
 * HttpTransport - HTTP/SSE implementation of ChatTransport
 *
 * Uses fetch with streaming for SSE responses.
 * Supports dynamic configuration via getter functions.
 */

import type {
  ChatTransport,
  ChatRequest,
  ChatResponse,
  StreamChunk,
  TransportConfig,
} from "../interfaces";
import { parseSSELine } from "../functions";
import { resolveValues } from "../../core/utils/resolvable";

/**
 * HTTP Transport for chat API
 *
 * Supports both static and dynamic configuration. When using getter functions,
 * values are resolved fresh on every request.
 *
 * @example
 * ```typescript
 * // Static config
 * const transport = new HttpTransport({
 *   url: '/api/chat',
 *   headers: { "x-api-key": "static" },
 * });
 *
 * // Dynamic config (recommended for auth/runtime values)
 * const transport = new HttpTransport({
 *   url: () => getApiEndpoint(),
 *   headers: () => ({
 *     Authorization: `Bearer ${getToken()}`,
 *     ...getCustomHeaders(),
 *   }),
 * });
 *
 * const stream = await transport.send(request);
 * for await (const chunk of stream) {
 *   console.log(chunk);
 * }
 * ```
 */
export class HttpTransport implements ChatTransport {
  private config: TransportConfig;
  private abortController: AbortController | null = null;
  private streaming = false;

  constructor(config: TransportConfig) {
    this.config = {
      streaming: true,
      timeout: 60000,
      ...config,
    };
  }

  /**
   * Send a chat request
   * Resolves dynamic config values (url, headers, body) fresh at request time
   */
  async send(
    request: ChatRequest,
  ): Promise<AsyncIterable<StreamChunk> | ChatResponse> {
    // Create new abort controller
    this.abortController = new AbortController();
    this.streaming = true;

    try {
      // Resolve dynamic values at request time (not constructor time)
      // This ensures fresh values on every request
      // Optimized: skips async overhead if all values are static
      console.log(
        "[HttpTransport] Config headers type:",
        typeof this.config.headers,
      );
      console.log("[HttpTransport] Config headers:", this.config.headers);

      const resolved = await resolveValues({
        url: this.config.url,
        headers: this.config.headers ?? {},
        configBody: this.config.body ?? {},
      });

      console.log("[HttpTransport] Resolved headers:", resolved.headers);

      const response = await fetch(resolved.url as string, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(resolved.headers as Record<string, string>),
        },
        body: JSON.stringify({
          messages: request.messages,
          threadId: request.threadId,
          systemPrompt: request.systemPrompt,
          llm: request.llm,
          tools: request.tools,
          actions: request.actions,
          streaming: this.config.streaming,
          ...(resolved.configBody as Record<string, unknown>),
          ...request.body,
        }),
        signal: this.abortController.signal,
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`HTTP ${response.status}: ${error}`);
      }

      const contentType = response.headers.get("content-type") || "";

      // Handle non-streaming JSON response
      if (contentType.includes("application/json")) {
        this.streaming = false;
        const json = await response.json();
        return json as ChatResponse;
      }

      // Handle streaming SSE response
      if (!response.body) {
        throw new Error("No response body");
      }

      return this.createStreamIterable(response.body);
    } catch (error) {
      this.streaming = false;
      if ((error as Error).name === "AbortError") {
        // Return empty iterable for aborted requests
        return (async function* () {})();
      }
      throw error;
    }
  }

  /**
   * Abort the current request
   */
  abort(): void {
    this.abortController?.abort();
    this.abortController = null;
    this.streaming = false;
  }

  /**
   * Check if currently streaming
   */
  isStreaming(): boolean {
    return this.streaming;
  }

  /**
   * Update headers configuration
   * Can be static headers or a getter function for dynamic resolution
   *
   * @example
   * ```typescript
   * // Static
   * transport.setHeaders({ "x-api-key": "new-key" });
   *
   * // Dynamic (resolved fresh on each request)
   * transport.setHeaders(() => ({ Authorization: `Bearer ${getToken()}` }));
   * ```
   */
  setHeaders(headers: TransportConfig["headers"]): void {
    this.config.headers = headers;
  }

  /**
   * Update URL configuration
   * Can be static URL or a getter function for dynamic resolution
   */
  setUrl(url: TransportConfig["url"]): void {
    this.config.url = url;
  }

  /**
   * Update body configuration
   * Additional properties merged into every request body
   */
  setBody(body: TransportConfig["body"]): void {
    this.config.body = body;
  }

  /**
   * Create an async iterable from a ReadableStream
   */
  private createStreamIterable(
    body: ReadableStream<Uint8Array>,
  ): AsyncIterable<StreamChunk> {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    // Queue to hold parsed chunks that haven't been returned yet
    const chunkQueue: StreamChunk[] = [];
    let streamDone = false;

    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;

    return {
      [Symbol.asyncIterator]() {
        return {
          async next(): Promise<IteratorResult<StreamChunk>> {
            // First, return any queued chunks
            if (chunkQueue.length > 0) {
              return { value: chunkQueue.shift()!, done: false };
            }

            // If stream is done and no more chunks, we're done
            if (streamDone) {
              return { value: undefined as unknown as StreamChunk, done: true };
            }

            try {
              const { done, value } = await reader.read();

              if (done) {
                self.streaming = false;
                streamDone = true;
                // Process any remaining buffer
                if (buffer.trim()) {
                  const chunk = parseSSELine(buffer.trim());
                  if (chunk) {
                    buffer = "";
                    return { value: chunk, done: false };
                  }
                }
                return {
                  value: undefined as unknown as StreamChunk,
                  done: true,
                };
              }

              // Decode and add to buffer
              buffer += decoder.decode(value, { stream: true });

              // Process complete lines
              const lines = buffer.split("\n");
              buffer = lines.pop() || ""; // Keep incomplete line in buffer

              // Parse all lines and queue the chunks
              for (const line of lines) {
                const chunk = parseSSELine(line);
                if (chunk) {
                  chunkQueue.push(chunk);
                }
              }

              // Return first chunk if available, otherwise read more
              if (chunkQueue.length > 0) {
                return { value: chunkQueue.shift()!, done: false };
              }

              // No complete chunk yet, continue reading
              return this.next();
            } catch (error) {
              self.streaming = false;
              streamDone = true;
              if ((error as Error).name === "AbortError") {
                return {
                  value: undefined as unknown as StreamChunk,
                  done: true,
                };
              }
              throw error;
            }
          },
        };
      },
    };
  }
}

/**
 * Create an HTTP transport instance
 */
export function createHttpTransport(config: TransportConfig): HttpTransport {
  return new HttpTransport(config);
}
