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
  /** Called when a server-side tool starts executing (action:start event) */
  onServerToolStart?: (info: ServerToolInfo) => void;
  /** Called when a server-side tool receives args (action:args event) */
  onServerToolArgs?: (info: ServerToolInfo) => void;
  /** Called when a server-side tool finishes (action:end event) */
  onServerToolEnd?: (
    info: ServerToolInfo & { result?: unknown; error?: string },
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
