/**
 * MCP Transport Types
 *
 * Defines the base transport interface and common types.
 */

import type {
  JsonRpcRequest,
  JsonRpcNotification,
  JsonRpcMessage,
} from "../types";

/**
 * MCP transport interface
 *
 * All transports (HTTP, SSE, stdio) must implement this interface.
 */
export interface MCPTransport {
  /**
   * Connect the transport
   */
  connect(): Promise<void>;

  /**
   * Disconnect the transport
   */
  disconnect(): Promise<void>;

  /**
   * Send a JSON-RPC message
   */
  send(message: JsonRpcRequest | JsonRpcNotification): Promise<void>;

  /**
   * Set message handler for incoming messages
   */
  onMessage(handler: MessageHandler): void;

  /**
   * Set error handler
   */
  onError(handler: ErrorHandler): void;

  /**
   * Set close handler
   */
  onClose(handler: CloseHandler): void;

  /**
   * Check if transport is connected
   */
  isConnected(): boolean;
}

/**
 * Message handler callback
 */
export type MessageHandler = (message: JsonRpcMessage) => void;

/**
 * Error handler callback
 */
export type ErrorHandler = (error: Error) => void;

/**
 * Close handler callback
 */
export type CloseHandler = () => void;

/**
 * Base transport options
 */
export interface TransportOptions {
  /** Request timeout in milliseconds */
  timeout?: number;
}

/**
 * HTTP transport options
 */
export interface HttpTransportOptions extends TransportOptions {
  /** Server URL */
  url: string;
  /** Custom headers */
  headers?: Record<string, string>;
  /** Session ID (managed internally) */
  sessionId?: string;
}

/**
 * SSE transport options
 */
export interface SSETransportOptions extends TransportOptions {
  /** Server URL */
  url: string;
  /** Custom headers */
  headers?: Record<string, string>;
}

/**
 * Stdio transport options
 */
export interface StdioTransportOptions extends TransportOptions {
  /** Command to execute */
  command: string;
  /** Command arguments */
  args?: string[];
  /** Environment variables */
  env?: Record<string, string>;
  /** Working directory */
  cwd?: string;
}

/**
 * Abstract base transport class
 *
 * Provides common functionality for all transports.
 */
export abstract class BaseTransport implements MCPTransport {
  protected messageHandler?: MessageHandler;
  protected errorHandler?: ErrorHandler;
  protected closeHandler?: CloseHandler;
  protected connected = false;

  abstract connect(): Promise<void>;
  abstract disconnect(): Promise<void>;
  abstract send(message: JsonRpcRequest | JsonRpcNotification): Promise<void>;

  onMessage(handler: MessageHandler): void {
    this.messageHandler = handler;
  }

  onError(handler: ErrorHandler): void {
    this.errorHandler = handler;
  }

  onClose(handler: CloseHandler): void {
    this.closeHandler = handler;
  }

  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Emit a message to the handler
   */
  protected emitMessage(message: JsonRpcMessage): void {
    if (this.messageHandler) {
      this.messageHandler(message);
    }
  }

  /**
   * Emit an error to the handler
   */
  protected emitError(error: Error): void {
    if (this.errorHandler) {
      this.errorHandler(error);
    }
  }

  /**
   * Emit close event
   */
  protected emitClose(): void {
    this.connected = false;
    if (this.closeHandler) {
      this.closeHandler();
    }
  }
}
