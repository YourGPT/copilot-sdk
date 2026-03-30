/**
 * Message Creation Functions
 *
 * Pure factory functions for creating messages.
 */

import type { MessageAttachment, ToolCall } from "../../../core";
import type { UIMessage, StreamingMessageState } from "../../types/index";

/**
 * Generate a unique message ID
 */
export function generateMessageId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Create a user message
 *
 * @param content - Message content
 * @param attachments - Optional attachments
 * @param options - Optional branching options
 * @returns New user message
 */
export function createUserMessage(
  content: string,
  attachments?: MessageAttachment[],
  options?: {
    parentId?: string | null;
  },
): UIMessage {
  return {
    id: generateMessageId(),
    role: "user",
    content,
    attachments,
    createdAt: new Date(),
    ...(options?.parentId !== undefined ? { parentId: options.parentId } : {}),
  };
}

/**
 * Create an assistant message
 *
 * @param content - Message content
 * @param options - Optional properties
 * @returns New assistant message
 */
export function createAssistantMessage(
  content: string,
  options?: {
    id?: string;
    thinking?: string;
    toolCalls?: ToolCall[];
    metadata?: Record<string, unknown>;
  },
): UIMessage {
  return {
    id: options?.id ?? generateMessageId(),
    role: "assistant",
    content,
    thinking: options?.thinking,
    toolCalls: options?.toolCalls,
    createdAt: new Date(),
    metadata: options?.metadata,
  };
}

/**
 * Create a tool result message
 *
 * @param toolCallId - ID of the tool call
 * @param result - Tool execution result
 * @returns New tool message
 */
export function createToolMessage(
  toolCallId: string,
  result: unknown,
): UIMessage {
  return {
    id: generateMessageId(),
    role: "tool",
    content: typeof result === "string" ? result : JSON.stringify(result),
    toolCallId,
    createdAt: new Date(),
  };
}

/**
 * Create a system message
 *
 * @param content - Message content
 * @returns New system message
 */
export function createSystemMessage(content: string): UIMessage {
  return {
    id: generateMessageId(),
    role: "system",
    content,
    createdAt: new Date(),
  };
}

/**
 * Convert streaming state to UIMessage
 *
 * @param state - Current streaming state
 * @returns UIMessage representation
 */
export function streamStateToMessage(state: StreamingMessageState): UIMessage {
  // Convert simplified tool calls to ToolCall format
  const toolCalls: ToolCall[] | undefined =
    state.toolCalls.length > 0
      ? state.toolCalls.map((tc) => ({
          id: tc.id,
          type: "function" as const,
          function: {
            name: tc.name,
            arguments: JSON.stringify(tc.args),
          },
        }))
      : undefined;

  // Convert tool results to toolExecutions format for UI
  // This enables server-side tool results to be used by components like SourceGroup
  const toolExecutions =
    state.toolResults.size > 0
      ? Array.from(state.toolResults.values()).map((tr) => ({
          id: tr.id,
          name: tr.name,
          args: tr.args ?? {},
          status: tr.status,
          result: tr.result,
          error: tr.error,
          timestamp: Date.now(),
        }))
      : undefined;

  // Build metadata object
  const metadata: Record<string, unknown> = {};
  if (toolExecutions) {
    metadata.toolExecutions = toolExecutions;
  }
  if (state.citations && state.citations.length > 0) {
    metadata.citations = state.citations;
  }

  return {
    id: state.messageId,
    role: "assistant" as const,
    content: state.content,
    thinking: state.thinking || undefined,
    toolCalls,
    createdAt: new Date(),
    // Store tool executions and citations in metadata for UI components
    metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
  };
}

/**
 * Create an empty assistant message (for streaming)
 *
 * @param id - Optional message ID
 * @param options - Optional branching options
 * @returns Empty assistant message
 */
export function createEmptyAssistantMessage(
  id?: string,
  options?: {
    parentId?: string | null;
  },
): UIMessage {
  return {
    id: id ?? generateMessageId(),
    role: "assistant",
    content: "",
    createdAt: new Date(),
    ...(options?.parentId !== undefined ? { parentId: options.parentId } : {}),
  };
}
