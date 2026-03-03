/**
 * JSON-RPC 2.0 Handler for MCP
 *
 * Handles creation, parsing, and validation of JSON-RPC messages.
 */

import type {
  JsonRpcRequest,
  JsonRpcNotification,
  JsonRpcResponse,
  JsonRpcMessage,
  JsonRpcError,
  JsonRpcSuccessResponse,
  JsonRpcErrorResponse,
  PendingRequest,
} from "../types";
import { MCPError, JSON_RPC_ERROR_CODES } from "../types";

/**
 * JSON-RPC 2.0 Handler
 *
 * Manages request/response lifecycle, message creation, and parsing.
 */
export class JsonRpcHandler {
  private requestId = 0;
  private pendingRequests = new Map<string | number, PendingRequest>();
  private defaultTimeout: number;

  constructor(options?: { timeout?: number }) {
    this.defaultTimeout = options?.timeout ?? 30000;
  }

  /**
   * Generate a unique request ID
   */
  generateId(): string {
    return `req_${++this.requestId}_${Date.now()}`;
  }

  /**
   * Create a JSON-RPC request
   */
  createRequest(
    method: string,
    params?: Record<string, unknown>,
  ): JsonRpcRequest {
    const request: JsonRpcRequest = {
      jsonrpc: "2.0",
      id: this.generateId(),
      method,
    };

    if (params !== undefined) {
      request.params = params;
    }

    return request;
  }

  /**
   * Create a JSON-RPC notification (no response expected)
   */
  createNotification(
    method: string,
    params?: Record<string, unknown>,
  ): JsonRpcNotification {
    const notification: JsonRpcNotification = {
      jsonrpc: "2.0",
      method,
    };

    if (params !== undefined) {
      notification.params = params;
    }

    return notification;
  }

  /**
   * Register a pending request and return a promise that resolves when response is received
   */
  registerRequest(request: JsonRpcRequest, timeout?: number): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const timeoutMs = timeout ?? this.defaultTimeout;

      const timeoutHandle = setTimeout(() => {
        this.pendingRequests.delete(request.id);
        reject(
          new MCPError(
            `Request timed out after ${timeoutMs}ms: ${request.method}`,
            JSON_RPC_ERROR_CODES.INTERNAL_ERROR,
          ),
        );
      }, timeoutMs);

      this.pendingRequests.set(request.id, {
        resolve,
        reject,
        timeout: timeoutHandle,
      });
    });
  }

  /**
   * Handle an incoming JSON-RPC response
   */
  handleResponse(response: JsonRpcResponse): boolean {
    // Error responses can have null id if request couldn't be parsed
    if (response.id === null) {
      return false;
    }

    const pending = this.pendingRequests.get(response.id);
    if (!pending) {
      return false;
    }

    this.pendingRequests.delete(response.id);
    clearTimeout(pending.timeout);

    if (isErrorResponse(response)) {
      pending.reject(MCPError.fromJsonRpcError(response.error));
    } else {
      pending.resolve(response.result);
    }

    return true;
  }

  /**
   * Parse a JSON-RPC message from string
   */
  parse(data: string): JsonRpcMessage {
    try {
      const parsed = JSON.parse(data);

      if (!this.isValidMessage(parsed)) {
        throw new MCPError(
          "Invalid JSON-RPC message",
          JSON_RPC_ERROR_CODES.INVALID_REQUEST,
        );
      }

      return parsed;
    } catch (error) {
      if (error instanceof MCPError) {
        throw error;
      }
      throw new MCPError(
        "Failed to parse JSON-RPC message",
        JSON_RPC_ERROR_CODES.PARSE_ERROR,
        error,
      );
    }
  }

  /**
   * Serialize a JSON-RPC message to string
   */
  serialize(message: JsonRpcMessage): string {
    return JSON.stringify(message);
  }

  /**
   * Validate a JSON-RPC message
   */
  isValidMessage(message: unknown): message is JsonRpcMessage {
    if (!message || typeof message !== "object") {
      return false;
    }

    const msg = message as Record<string, unknown>;

    // Must have jsonrpc: "2.0"
    if (msg.jsonrpc !== "2.0") {
      return false;
    }

    // Check if it's a request (has id and method)
    if ("method" in msg && typeof msg.method === "string") {
      // Requests have id, notifications don't
      return true;
    }

    // Check if it's a response (has id and result or error)
    if ("id" in msg) {
      return "result" in msg || "error" in msg;
    }

    return false;
  }

  /**
   * Check if message is a request
   */
  isRequest(message: JsonRpcMessage): message is JsonRpcRequest {
    return "method" in message && "id" in message;
  }

  /**
   * Check if message is a notification
   */
  isNotification(message: JsonRpcMessage): message is JsonRpcNotification {
    return "method" in message && !("id" in message);
  }

  /**
   * Check if message is a response
   */
  isResponse(message: JsonRpcMessage): message is JsonRpcResponse {
    return "id" in message && ("result" in message || "error" in message);
  }

  /**
   * Cancel all pending requests
   */
  cancelAllPending(reason?: string): void {
    const error = new MCPError(
      reason ?? "All pending requests cancelled",
      JSON_RPC_ERROR_CODES.INTERNAL_ERROR,
    );

    for (const [id, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout);
      pending.reject(error);
    }

    this.pendingRequests.clear();
  }

  /**
   * Get number of pending requests
   */
  getPendingCount(): number {
    return this.pendingRequests.size;
  }

  /**
   * Check if a specific request is pending
   */
  isPending(id: string | number): boolean {
    return this.pendingRequests.has(id);
  }
}

/**
 * Type guard for error response
 */
export function isErrorResponse(
  response: JsonRpcResponse,
): response is JsonRpcErrorResponse {
  return "error" in response;
}

/**
 * Type guard for success response
 */
export function isSuccessResponse(
  response: JsonRpcResponse,
): response is JsonRpcSuccessResponse {
  return "result" in response;
}

/**
 * Create a JSON-RPC error response
 */
export function createErrorResponse(
  id: string | number | null,
  error: JsonRpcError,
): JsonRpcErrorResponse {
  return {
    jsonrpc: "2.0",
    id,
    error,
  };
}

/**
 * Create a JSON-RPC success response
 */
export function createSuccessResponse(
  id: string | number,
  result: unknown,
): JsonRpcSuccessResponse {
  return {
    jsonrpc: "2.0",
    id,
    result,
  };
}
