/**
 * SSE (Server-Sent Events) Transport for MCP
 *
 * Implements SSE transport for MCP servers that prefer server-push
 * communication. Sends requests via HTTP POST and receives responses
 * and notifications via SSE.
 */

import type {
  JsonRpcRequest,
  JsonRpcNotification,
  JsonRpcMessage,
} from "../types";
import { MCPError, JSON_RPC_ERROR_CODES } from "../types";
import { BaseTransport, type SSETransportOptions } from "./types";

/**
 * SSE Transport
 *
 * Uses HTTP POST for sending requests and Server-Sent Events for
 * receiving responses and server-initiated notifications.
 */
export class SSETransport extends BaseTransport {
  private url: string;
  private headers: Record<string, string>;
  private timeout: number;
  private eventSource?: EventSource;
  private messageEndpoint?: string;
  private sessionId?: string;

  constructor(options: SSETransportOptions) {
    super();
    this.url = options.url;
    this.headers = options.headers ?? {};
    this.timeout = options.timeout ?? 30000;
  }

  /**
   * Connect to the SSE endpoint
   */
  async connect(): Promise<void> {
    if (this.connected) {
      return;
    }

    return new Promise((resolve, reject) => {
      try {
        // Create EventSource for receiving messages
        // Note: EventSource doesn't support custom headers natively
        // The URL should include auth via query params if needed
        const sseUrl = new URL(this.url);

        // Add any session ID if we have one
        if (this.sessionId) {
          sseUrl.searchParams.set("sessionId", this.sessionId);
        }

        this.eventSource = new EventSource(sseUrl.toString());

        // Handle SSE connection open
        this.eventSource.onopen = () => {
          this.connected = true;
          resolve();
        };

        // Handle incoming messages
        this.eventSource.onmessage = (event) => {
          this.handleSSEMessage(event.data);
        };

        // Handle named events
        this.eventSource.addEventListener("message", (event: MessageEvent) => {
          this.handleSSEMessage(event.data);
        });

        // Handle endpoint event (server tells us where to send requests)
        this.eventSource.addEventListener("endpoint", (event: MessageEvent) => {
          try {
            const data = JSON.parse(event.data);
            if (data.endpoint) {
              this.messageEndpoint = data.endpoint;
            }
            if (data.sessionId) {
              this.sessionId = data.sessionId;
            }
          } catch {
            // Ignore parse errors
          }
        });

        // Handle errors
        this.eventSource.onerror = (error) => {
          if (!this.connected) {
            reject(new MCPError("SSE connection failed"));
          } else {
            this.emitError(new MCPError("SSE connection error"));
          }
        };

        // Set a connection timeout
        setTimeout(() => {
          if (!this.connected) {
            this.eventSource?.close();
            reject(new MCPError("SSE connection timeout"));
          }
        }, this.timeout);
      } catch (error) {
        reject(
          error instanceof Error
            ? error
            : new MCPError("Failed to create SSE connection"),
        );
      }
    });
  }

  /**
   * Disconnect from the SSE endpoint
   */
  async disconnect(): Promise<void> {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = undefined;
    }
    this.messageEndpoint = undefined;
    this.sessionId = undefined;
    this.connected = false;
    this.emitClose();
  }

  /**
   * Send a JSON-RPC message via HTTP POST
   */
  async send(message: JsonRpcRequest | JsonRpcNotification): Promise<void> {
    if (!this.connected) {
      throw new MCPError(
        "Transport not connected",
        JSON_RPC_ERROR_CODES.INTERNAL_ERROR,
      );
    }

    // Use the endpoint provided by server, or fall back to base URL
    const endpoint = this.messageEndpoint || this.url;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...this.headers,
    };

    // Include session ID if available
    if (this.sessionId) {
      headers["Mcp-Session-Id"] = this.sessionId;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(message),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new MCPError(
          `HTTP error: ${response.status} ${response.statusText}`,
          JSON_RPC_ERROR_CODES.INTERNAL_ERROR,
        );
      }

      // Check for response body (some requests may have sync responses)
      const contentType = response.headers.get("content-type");
      if (contentType?.includes("application/json")) {
        const text = await response.text();
        if (text.trim()) {
          const messages = this.parseResponseText(text);
          for (const msg of messages) {
            this.emitMessage(msg);
          }
        }
      }

      // Main response will come via SSE
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof MCPError) {
        throw error;
      }

      if (error instanceof Error && error.name === "AbortError") {
        throw new MCPError(
          "Request timed out",
          JSON_RPC_ERROR_CODES.INTERNAL_ERROR,
        );
      }

      throw new MCPError(
        `Send failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        JSON_RPC_ERROR_CODES.INTERNAL_ERROR,
      );
    }
  }

  /**
   * Handle an SSE message
   */
  private handleSSEMessage(data: string): void {
    try {
      const messages = this.parseResponseText(data);
      for (const msg of messages) {
        this.emitMessage(msg);
      }
    } catch (error) {
      // Log but don't crash on parse errors
      console.warn("Failed to parse SSE message:", error);
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

    const parsed = JSON.parse(trimmed);

    // Check if it's a batch (array)
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

    // Request or notification
    if ("method" in m && typeof m.method === "string") {
      return true;
    }

    // Response
    if ("id" in m && ("result" in m || "error" in m)) {
      return true;
    }

    return false;
  }

  /**
   * Get the current session ID
   */
  getSessionId(): string | undefined {
    return this.sessionId;
  }
}
