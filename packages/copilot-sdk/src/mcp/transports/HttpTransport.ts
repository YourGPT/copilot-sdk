/**
 * HTTP Streamable Transport for MCP
 *
 * Implements the HTTP Streamable transport as recommended by the MCP specification.
 * This transport uses HTTP POST requests for sending messages and can handle
 * streaming responses via SSE when needed.
 */

import type {
  JsonRpcRequest,
  JsonRpcNotification,
  JsonRpcMessage,
  JsonRpcResponse,
} from "../types";
import { MCPError, JSON_RPC_ERROR_CODES } from "../types";
import { BaseTransport, type HttpTransportOptions } from "./types";

/**
 * HTTP Streamable Transport
 *
 * The recommended transport for MCP over HTTP. Supports both request/response
 * and server-initiated messages via SSE.
 */
export class HttpTransport extends BaseTransport {
  private url: string;
  private headers: Record<string, string>;
  private timeout: number;
  private sessionId?: string;
  private eventSource?: EventSource;
  private abortController?: AbortController;

  constructor(options: HttpTransportOptions) {
    super();
    this.url = options.url;
    this.headers = options.headers ?? {};
    this.timeout = options.timeout ?? 30000;
    this.sessionId = options.sessionId;
  }

  /**
   * Connect the HTTP transport
   *
   * For HTTP transport, "connecting" means verifying the endpoint is reachable.
   * The actual session is established during the initialize handshake.
   */
  async connect(): Promise<void> {
    if (this.connected) {
      return;
    }

    this.abortController = new AbortController();
    this.connected = true;
  }

  /**
   * Disconnect the HTTP transport
   */
  async disconnect(): Promise<void> {
    if (!this.connected) {
      return;
    }

    // Close any SSE connection
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = undefined;
    }

    // Abort any pending requests
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = undefined;
    }

    this.sessionId = undefined;
    this.connected = false;
    this.emitClose();
  }

  /**
   * Send a JSON-RPC message and handle the response
   */
  async send(message: JsonRpcRequest | JsonRpcNotification): Promise<void> {
    if (!this.connected) {
      throw new MCPError(
        "Transport not connected",
        JSON_RPC_ERROR_CODES.INTERNAL_ERROR,
      );
    }

    const isRequest = "id" in message;

    try {
      const response = await this.sendRequest(message);

      // Handle response based on content type
      const contentType = response.headers.get("content-type") || "";

      // Check for session ID in response headers
      const newSessionId = response.headers.get("mcp-session-id");
      if (newSessionId) {
        this.sessionId = newSessionId;
      }

      if (contentType.includes("text/event-stream")) {
        // Server wants to use SSE for this response
        await this.handleSSEResponse(response);
      } else if (contentType.includes("application/json")) {
        // Standard JSON response
        const text = await response.text();
        if (text.trim()) {
          // Parse potentially multiple JSON-RPC messages (batch)
          const messages = this.parseResponseText(text);
          for (const msg of messages) {
            this.emitMessage(msg);
          }
        }
      } else if (!response.ok) {
        throw new MCPError(
          `HTTP error: ${response.status} ${response.statusText}`,
          JSON_RPC_ERROR_CODES.INTERNAL_ERROR,
        );
      }
      // 202 Accepted or 204 No Content - no response body expected
    } catch (error) {
      if (error instanceof MCPError) {
        throw error;
      }

      if (error instanceof Error) {
        if (error.name === "AbortError") {
          throw new MCPError(
            "Request aborted",
            JSON_RPC_ERROR_CODES.INTERNAL_ERROR,
          );
        }
        throw new MCPError(
          `Transport error: ${error.message}`,
          JSON_RPC_ERROR_CODES.INTERNAL_ERROR,
          error,
        );
      }

      throw new MCPError(
        "Unknown transport error",
        JSON_RPC_ERROR_CODES.INTERNAL_ERROR,
      );
    }
  }

  /**
   * Send an HTTP request
   */
  private async sendRequest(
    message: JsonRpcRequest | JsonRpcNotification,
  ): Promise<Response> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      ...this.headers,
    };

    // Include session ID if we have one
    if (this.sessionId) {
      headers["Mcp-Session-Id"] = this.sessionId;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(this.url, {
        method: "POST",
        headers,
        body: JSON.stringify(message),
        signal: controller.signal,
      });

      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Handle an SSE response stream
   */
  private async handleSSEResponse(response: Response): Promise<void> {
    const reader = response.body?.getReader();
    if (!reader) {
      throw new MCPError(
        "No response body for SSE stream",
        JSON_RPC_ERROR_CODES.INTERNAL_ERROR,
      );
    }

    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });

        // Process complete SSE events
        const events = buffer.split("\n\n");
        buffer = events.pop() || ""; // Keep incomplete event in buffer

        for (const event of events) {
          if (!event.trim()) continue;

          const lines = event.split("\n");
          let data = "";

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              data += line.slice(6);
            }
          }

          if (data) {
            try {
              const messages = this.parseResponseText(data);
              for (const msg of messages) {
                this.emitMessage(msg);
              }
            } catch {
              // Skip invalid JSON in SSE
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Parse response text into JSON-RPC messages
   */
  private parseResponseText(text: string): JsonRpcMessage[] {
    const trimmed = text.trim();
    if (!trimmed) {
      return [];
    }

    try {
      const parsed = JSON.parse(trimmed);

      // Check if it's a batch response (array)
      if (Array.isArray(parsed)) {
        return parsed.filter((msg): msg is JsonRpcMessage =>
          this.isValidJsonRpcMessage(msg),
        );
      }

      // Single message
      if (this.isValidJsonRpcMessage(parsed)) {
        return [parsed];
      }

      return [];
    } catch {
      throw new MCPError(
        "Failed to parse JSON-RPC response",
        JSON_RPC_ERROR_CODES.PARSE_ERROR,
      );
    }
  }

  /**
   * Validate a JSON-RPC message
   */
  private isValidJsonRpcMessage(msg: unknown): msg is JsonRpcMessage {
    if (!msg || typeof msg !== "object") {
      return false;
    }

    const m = msg as Record<string, unknown>;
    if (m.jsonrpc !== "2.0") {
      return false;
    }

    // Request or notification: has method
    if ("method" in m && typeof m.method === "string") {
      return true;
    }

    // Response: has id and (result or error)
    if ("id" in m && ("result" in m || "error" in m)) {
      return true;
    }

    return false;
  }

  /**
   * Start listening for server-initiated events via SSE
   *
   * This is optional and used when the server supports server-initiated
   * notifications (e.g., tools/list_changed).
   */
  startEventStream(): void {
    if (this.eventSource || typeof EventSource === "undefined") {
      return;
    }

    // Build URL with session ID if available
    const url = new URL(this.url);
    if (this.sessionId) {
      url.searchParams.set("sessionId", this.sessionId);
    }

    // Note: EventSource doesn't support custom headers natively
    // For authenticated endpoints, the server should use query params or cookies
    this.eventSource = new EventSource(url.toString());

    this.eventSource.onmessage = (event) => {
      try {
        const messages = this.parseResponseText(event.data);
        for (const msg of messages) {
          this.emitMessage(msg);
        }
      } catch {
        // Ignore parse errors from event stream
      }
    };

    this.eventSource.onerror = () => {
      // EventSource will automatically reconnect
      this.emitError(new MCPError("SSE connection error"));
    };
  }

  /**
   * Stop the event stream
   */
  stopEventStream(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = undefined;
    }
  }

  /**
   * Get the current session ID
   */
  getSessionId(): string | undefined {
    return this.sessionId;
  }

  /**
   * Set the session ID (used after initialization)
   */
  setSessionId(sessionId: string): void {
    this.sessionId = sessionId;
  }
}
