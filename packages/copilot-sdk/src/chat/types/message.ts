/**
 * Message Types
 *
 * Pure type definitions for chat messages.
 * No logic, no side effects - just types.
 */

import type { MessageAttachment, ToolCall, Source } from "../../core";
import type { Citation } from "../interfaces/ChatTransport";

/**
 * Chat message roles
 */
export type MessageRole = "user" | "assistant" | "system" | "tool";

/**
 * UIMessage - The source of truth for UI state
 *
 * Inspired by Vercel AI SDK's UIMessage pattern.
 * This is what your UI renders and what gets persisted.
 */
export interface UIMessage {
  /** Unique message ID */
  id: string;
  /** Message role */
  role: MessageRole;
  /** Message content */
  content: string;
  /** Thinking/reasoning content (for extended thinking models) */
  thinking?: string;
  /** Message attachments (images, PDFs, etc) */
  attachments?: MessageAttachment[];
  /** Tool calls made by assistant */
  toolCalls?: ToolCall[];
  /** Tool call ID (for tool result messages) */
  toolCallId?: string;
  /** Sources from knowledge base */
  sources?: Source[];
  /** Creation timestamp */
  createdAt: Date;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
  /**
   * Parent message ID for branching support.
   * - null = root message (no parent)
   * - undefined = legacy linear message (no branch awareness)
   * - string = ID of parent message
   */
  parentId?: string | null;
  /** Direct children IDs for O(1) sibling lookup */
  childrenIds?: string[];
}

/**
 * Tool result from streaming
 */
export interface StreamToolResult {
  id: string;
  name: string;
  status: "pending" | "executing" | "completed" | "failed";
  args?: Record<string, unknown>;
  result?: unknown;
  error?: string;
  /** Whether this tool should be hidden from UI */
  hidden?: boolean;
}

/**
 * Stream state during message generation
 */
export interface StreamingMessageState {
  /** Message being built */
  messageId: string;
  /** Accumulated content */
  content: string;
  /** Accumulated thinking */
  thinking: string;
  /** Tool calls received (simplified format for internal use) */
  toolCalls: Array<{
    id: string;
    name: string;
    args: Record<string, unknown>;
  }>;
  /** Tool results received from server */
  toolResults: Map<string, StreamToolResult>;
  /** Citations from native web search */
  citations: Citation[];
  /** Whether action is required (tool execution) */
  requiresAction: boolean;
  /** Finish reason if done */
  finishReason?: string;
}

/**
 * Tool result message for API
 */
export interface ToolResultMessage {
  role: "tool";
  tool_call_id: string;
  content: string;
}

/**
 * Assistant message with tool calls for API
 */
export interface AssistantToolMessage {
  role: "assistant";
  content: string | null;
  tool_calls: Array<{
    id: string;
    type: "function";
    function: {
      name: string;
      arguments: string;
    };
  }>;
}
