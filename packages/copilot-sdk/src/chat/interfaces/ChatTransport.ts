/**
 * ChatTransport Interface
 *
 * Contract for different transport implementations.
 * HTTP, WebSocket, or mock for testing.
 */

import type { UIMessage } from "../types";
import type { Resolvable } from "../../core/utils/resolvable";

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
  /**
   * Inline client skills to send to the server for merging with server-side skills.
   * Set by AbstractChat when useSkill() hooks are active.
   */
  __skills?: Array<{
    name: string;
    description: string;
    content: string;
    strategy?: string;
  }>;
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
    /** Tool call ID for tool result messages */
    tool_call_id?: string;
  }>;
  /** Session ID — present when server storage adapter created/resolved a session */
  threadId?: string;
  /** Whether client needs to execute tools */
  requiresAction?: boolean;
  /** Tool calls with metadata (includes hidden flag for server-side tools) */
  toolCalls?: Array<{
    id: string;
    name: string;
    args: Record<string, unknown>;
    hidden?: boolean;
  }>;
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
  | {
      type: "done";
      messages?: Array<{
        role: string;
        content: string | null;
        tool_calls?: unknown[];
        tool_call_id?: string;
      }>;
      requiresAction?: boolean;
      /** Session ID from server storage adapter */
      threadId?: string;
    }
  // Tool action events (from llm-sdk agent-loop)
  | { type: "action:start"; id: string; name: string; hidden?: boolean }
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

  /**
   * Update headers configuration (optional)
   * Can be static headers or a getter function for dynamic resolution
   */
  setHeaders?(headers: Resolvable<Record<string, string>>): void;

  /**
   * Update URL configuration (optional)
   * Can be static URL or a getter function for dynamic resolution
   */
  setUrl?(url: Resolvable<string>): void;

  /**
   * Update body configuration (optional)
   * Additional properties merged into every request body
   */
  setBody?(body: Resolvable<Record<string, unknown>>): void;
}

/**
 * Transport configuration
 *
 * Supports both static values and getter functions for dynamic configuration.
 * Getter functions are resolved at request time, ensuring fresh values.
 *
 * @example
 * ```typescript
 * // Static config
 * const config: TransportConfig = {
 *   url: "/api/chat",
 *   headers: { "x-api-key": "static-key" },
 * };
 *
 * // Dynamic config (resolved fresh on each request)
 * const config: TransportConfig = {
 *   url: () => getApiUrl(),
 *   headers: () => ({
 *     Authorization: `Bearer ${getToken()}`,
 *     ...getCustomHeaders(),
 *   }),
 * };
 * ```
 */
export interface TransportConfig {
  /** API endpoint URL - can be static or getter function */
  url: Resolvable<string>;
  /** Request headers - can be static or getter function */
  headers?: Resolvable<Record<string, string>>;
  /** Additional body properties - can be static or getter function */
  body?: Resolvable<Record<string, unknown>>;
  /** Enable streaming (default: true) */
  streaming?: boolean;
  /** Request timeout in ms */
  timeout?: number;
  /**
   * Custom error message extractor for non-2xx responses.
   * Receives the HTTP status code and the parsed response body.
   * Return a string to use as the error message, or null/undefined to fall back to the default extraction.
   *
   * @example
   * ```ts
   * // Handle nested or array error formats
   * parseError: (status, body) => {
   *   if (Array.isArray(body?.errors)) return body.errors[0]?.message;
   *   if (body?.detail) return body.detail;       // Django-style
   *   if (body?.data?.message) return body.data.message; // nested
   *   return null; // fall back to default (body.message || body.error)
   * }
   * ```
   */
  parseError?: (status: number, body: unknown) => string | null | undefined;
}
