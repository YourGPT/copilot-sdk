/**
 * ChatTransport Interface
 *
 * Contract for different transport implementations.
 * HTTP, WebSocket, or mock for testing.
 */

import type { UIMessage } from "../types";

/**
 * Chat request to send
 */
export interface ChatRequest {
  /** Messages to send */
  messages: Array<{
    role: string;
    content: string | null;
    tool_calls?: unknown[];
    tool_call_id?: string;
    attachments?: unknown[];
  }>;
  /** Thread ID */
  threadId?: string;
  /** System prompt */
  systemPrompt?: string;
  /** LLM config */
  llm?: Record<string, unknown>;
  /** Tool definitions */
  tools?: unknown[];
  /** Action definitions */
  actions?: unknown[];
  /** Additional body properties */
  body?: Record<string, unknown>;
}

/**
 * Chat response (non-streaming)
 */
export interface ChatResponse {
  /** Response messages */
  messages: Array<{
    role: string;
    content: string | null;
    tool_calls?: unknown[];
  }>;
  /** Whether client needs to execute tools */
  requiresAction?: boolean;
}

/**
 * Tool result from server
 */
export interface ToolResultData {
  success: boolean;
  data?: unknown;
  error?: string;
  _aiContext?: string;
}

/**
 * Citation from web search (unified format for all providers)
 */
export interface Citation {
  /** Unique citation index (1-based) */
  index: number;
  /** Source URL */
  url: string;
  /** Page title */
  title: string;
  /** Cited text snippet (optional) */
  citedText?: string;
  /** Source domain (extracted from URL) */
  domain?: string;
  /** Favicon URL (generated from domain) */
  favicon?: string;
}

/**
 * Stream chunk types
 */
export type StreamChunk =
  | { type: "message:start"; id: string }
  | { type: "message:delta"; content: string }
  | { type: "message:end" }
  | { type: "thinking:delta"; content: string }
  | { type: "tool_calls"; toolCalls: unknown[]; assistantMessage: unknown }
  | { type: "source:add"; source: unknown }
  | { type: "error"; message: string }
  | { type: "done"; messages?: unknown[]; requiresAction?: boolean }
  // Tool action events (from llm-sdk agent-loop)
  | { type: "action:start"; id: string; name: string }
  | { type: "action:args"; id: string; args: string }
  | {
      type: "action:end";
      id: string;
      name: string;
      result?: ToolResultData;
      error?: string;
    }
  | { type: "tool:result"; id: string; name: string; result: ToolResultData }
  // Loop events
  | { type: "loop:iteration"; iteration: number; maxIterations: number }
  | {
      type: "loop:complete";
      iterations: number;
      maxIterationsReached?: boolean;
      aborted?: boolean;
    }
  // Citation event (from native web search)
  | { type: "citation"; citations: Citation[] };

/**
 * ChatTransport interface
 *
 * Allows different transport implementations:
 * - HTTP (default) - uses fetch with SSE
 * - WebSocket - for real-time connections
 * - Mock - for testing
 *
 * @example
 * ```typescript
 * const transport = new HttpTransport({
 *   url: '/api/chat',
 *   headers: { ... }
 * });
 *
 * const stream = await transport.send(request);
 * for await (const chunk of stream) {
 *   console.log(chunk);
 * }
 * ```
 */
export interface ChatTransport {
  /**
   * Send a chat request
   *
   * @param request - The chat request
   * @returns AsyncIterable of stream chunks, or ChatResponse for non-streaming
   */
  send(
    request: ChatRequest,
  ): Promise<AsyncIterable<StreamChunk> | ChatResponse>;

  /**
   * Abort the current request
   */
  abort(): void;

  /**
   * Check if currently streaming
   */
  isStreaming(): boolean;
}

/**
 * Transport configuration
 */
export interface TransportConfig {
  /** API endpoint URL */
  url: string;
  /** Request headers */
  headers?: Record<string, string>;
  /** Enable streaming (default: true) */
  streaming?: boolean;
  /** Request timeout in ms */
  timeout?: number;
}
