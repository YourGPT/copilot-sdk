/**
 * Chat Types
 *
 * Configuration and status types for chat functionality.
 */

import type {
  ContextUsage,
  LLMConfig,
  MessageAttachment,
  ToolDefinition,
  ToolOptimizationConfig,
} from "../../core";
import type { Resolvable } from "../../core/utils/resolvable";
import type { UIMessage } from "./message";

/**
 * Chat status
 */
export type ChatStatus = "ready" | "submitted" | "streaming" | "error";

/**
 * YourGPT configuration for automatic session management
 */
export interface YourGPTConfig {
  /** YourGPT API key (sent as api-key header) */
  apiKey: string;
  /** Widget UID to scope sessions to */
  widgetUid: string;
  /** API base URL (default: https://api.yourgpt.ai) */
  endpoint?: string;
}

/**
 * Chat configuration
 *
 * Supports both static values and getter functions for dynamic configuration.
 * Using getter functions ensures fresh values on every request.
 *
 * @example
 * ```typescript
 * const config: ChatConfig = {
 *   // Static URL
 *   runtimeUrl: "/api/chat",
 *
 *   // Dynamic headers - resolved fresh on every request
 *   headers: () => ({
 *     Authorization: `Bearer ${getToken()}`,
 *     ...getCustomHeaders(),
 *   }),
 * };
 * ```
 */
export interface ChatConfig {
  /** Runtime API endpoint - can be static or getter function */
  runtimeUrl: Resolvable<string>;
  /** LLM configuration */
  llm?: Partial<LLMConfig>;
  /** System prompt */
  systemPrompt?: string;
  /** Enable streaming (default: true) */
  streaming?: boolean;
  /** Request headers - can be static or getter function */
  headers?: Resolvable<Record<string, string>>;
  /** Additional body properties - can be static or getter function */
  body?: Resolvable<Record<string, unknown>>;
  /** Thread ID for conversation persistence */
  threadId?: string;
  /**
   * Called once before the first message on a new thread to obtain a session/thread ID.
   * The returned value IS the thread ID — session and thread are the same identity.
   *
   * Only called when `config.threadId` is not set (new thread).
   * If `threadId` is already provided, this is skipped entirely.
   * Takes priority over `yourgptConfig` when both are provided.
   *
   * @example Async server session
   * ```ts
   * onCreateSession={async () => {
   *   const res = await fetch('/api/sessions', { method: 'POST' })
   *   return (await res.json()).id
   * }}
   * ```
   */
  onCreateSession?: () => string | Promise<string>;
  /**
   * YourGPT config — enables automatic session creation with zero boilerplate.
   * When provided, the SDK calls YourGPT's createSession API before the first
   * message and uses the returned session_uid as `threadId`.
   *
   * @example
   * ```tsx
   * yourgptConfig={{
   *   apiKey: process.env.YOURGPT_API_KEY,
   *   widgetUid: widgetUid,
   * }}
   * ```
   */
  yourgptConfig?: YourGPTConfig;
  /** Enable debug logging */
  debug?: boolean;
  /** Available tools (passed to LLM) */
  tools?: ToolDefinition[];
  /** Optional prompt/tool optimization controls */
  optimization?: ToolOptimizationConfig;
}

/**
 * Chat request options (per-message)
 */
export interface ChatRequestOptions {
  /** Additional headers */
  headers?: Record<string, string>;
  /** Additional body properties */
  body?: Record<string, unknown>;
  /** Message metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Server-side tool execution info (from streaming action events)
 */
export interface ServerToolInfo {
  id: string;
  name: string;
  args?: Record<string, unknown>;
  hidden?: boolean;
}

/**
 * Chat callbacks for state updates
 */
export interface ChatCallbacks<T extends UIMessage = UIMessage> {
  /** Called when messages change */
  onMessagesChange?: (messages: T[]) => void;
  /** Called when status changes */
  onStatusChange?: (status: ChatStatus) => void;
  /** Called when an error occurs */
  onError?: (error: Error | null) => void;
  /** Called when a message starts streaming */
  onMessageStart?: (messageId: string) => void;
  /** Called when message content is streamed */
  onMessageDelta?: (messageId: string, delta: string) => void;
  /** Called when a message finishes */
  onMessageFinish?: (message: T) => void;
  /** Called when tool calls are received */
  onToolCalls?: (toolCalls: T["toolCalls"]) => void;
  /** Called when generation is complete */
  onFinish?: (messages: T[]) => void;
  /** Called when prompt context usage changes */
  onContextUsageChange?: (usage: ContextUsage) => void;
  /**
   * Called once when a new session/thread ID is assigned (null → sessionId transition).
   * Use this to persist the session ID in your storage layer.
   * The returned ID is the same as the threadId that will be used for all subsequent requests.
   */
  onThreadChange?: (id: string) => void;
  /**
   * Called when the session creation status changes.
   * Use this to show/hide a spinner while the session is being created.
   */
  onSessionStatusChange?: (
    status: "idle" | "creating" | "ready" | "error",
  ) => void;
  /** Called when a server-side tool starts executing (action:start event) */
  onServerToolStart?: (info: ServerToolInfo) => void;
  /** Called when a server-side tool receives args (action:args event) */
  onServerToolArgs?: (info: ServerToolInfo) => void;
  /** Called when a server-side tool finishes (action:end event) */
  onServerToolEnd?: (
    info: ServerToolInfo & { result?: unknown; error?: string },
  ) => void;
  /**
   * Called for every raw stream chunk as it arrives.
   * Use this to build custom real-time UI on top of the SDK — e.g. thinking
   * step parsers, tool progress trackers, loop iteration counters.
   * The `messageId` field is the ID of the assistant message being streamed.
   */
  onStreamChunk?: (
    chunk: import("../interfaces/ChatTransport").StreamChunk & {
      messageId?: string;
    },
  ) => void;
}

/**
 * Chat initialization options
 */
export interface ChatInit<T extends UIMessage = UIMessage> extends ChatConfig {
  /** Initial messages */
  initialMessages?: T[];
  /** State implementation (injected by framework adapter) */
  state?: import("../interfaces/ChatState").ChatState<T>;
  /** Transport implementation */
  transport?: import("../interfaces/ChatTransport").ChatTransport;
  /** Callbacks */
  callbacks?: ChatCallbacks<T>;
}

/**
 * Send message options
 */
export interface SendMessageOptions {
  /** Message content */
  content: string;
  /** Attachments */
  attachments?: MessageAttachment[];
  /** Request options */
  options?: ChatRequestOptions;
}
