/**
 * Stream Chunk Processing Functions
 *
 * Pure functions for processing stream chunks.
 * Returns new state without mutating input.
 */

import type { StreamChunk } from "../../interfaces";
import type { StreamingMessageState } from "../../types/index";

/**
 * Process a stream chunk and return updated state
 *
 * This is a pure function - it takes state and chunk,
 * returns new state without mutating the input.
 *
 * @param chunk - Stream chunk to process
 * @param state - Current streaming state
 * @returns New streaming state
 *
 * @example
 * ```typescript
 * let state = createStreamState('msg-1');
 *
 * state = processStreamChunk(
 *   { type: 'message:delta', content: 'Hello' },
 *   state
 * );
 * // state.content === 'Hello'
 *
 * state = processStreamChunk(
 *   { type: 'message:delta', content: ' World' },
 *   state
 * );
 * // state.content === 'Hello World'
 * ```
 */
export function processStreamChunk(
  chunk: StreamChunk,
  state: StreamingMessageState,
): StreamingMessageState {
  switch (chunk.type) {
    case "message:start":
      // Don't overwrite messageId - keep the client-generated ID
      // since that's what's stored in the messages array.
      // The server's ID is ignored to maintain consistency with updateMessageById.
      return state;

    case "message:delta":
      return {
        ...state,
        content: state.content + chunk.content,
      };

    case "message:end":
      return {
        ...state,
        finishReason: "stop",
      };

    case "thinking:delta":
      return {
        ...state,
        thinking: state.thinking + chunk.content,
      };

    case "tool_calls":
      return {
        ...state,
        toolCalls: parseToolCalls(chunk.toolCalls),
        requiresAction: true,
      };

    // Handle tool action events from server
    case "action:start": {
      const newResults = new Map(state.toolResults);
      newResults.set(chunk.id, {
        id: chunk.id,
        name: chunk.name,
        status: "executing",
      });
      return { ...state, toolResults: newResults };
    }

    case "action:args": {
      const existing = state.toolResults.get(chunk.id);
      if (existing) {
        const newResults = new Map(state.toolResults);
        try {
          newResults.set(chunk.id, {
            ...existing,
            args: JSON.parse(chunk.args),
          });
        } catch {
          // Keep existing args if parse fails
        }
        return { ...state, toolResults: newResults };
      }
      return state;
    }

    case "action:end": {
      const existing = state.toolResults.get(chunk.id);
      const newResults = new Map(state.toolResults);
      newResults.set(chunk.id, {
        id: chunk.id,
        name: chunk.name,
        status: chunk.error ? "failed" : "completed",
        args: existing?.args,
        result: chunk.result,
        error: chunk.error,
      });
      return { ...state, toolResults: newResults };
    }

    case "tool:result": {
      const existing = state.toolResults.get(chunk.id);
      const newResults = new Map(state.toolResults);
      newResults.set(chunk.id, {
        id: chunk.id,
        name: chunk.name,
        status: chunk.result?.success ? "completed" : "failed",
        args: existing?.args,
        result: chunk.result,
        error: chunk.result?.error,
      });
      return { ...state, toolResults: newResults };
    }

    case "citation": {
      // Append new citations to existing ones
      return {
        ...state,
        citations: [...state.citations, ...chunk.citations],
      };
    }

    case "done":
      return {
        ...state,
        requiresAction: chunk.requiresAction ?? false,
        finishReason: "stop",
      };

    case "error":
      return {
        ...state,
        finishReason: "error",
      };

    default:
      // Unknown chunk type, return unchanged
      return state;
  }
}

/**
 * Parse raw tool calls into typed format
 */
function parseToolCalls(
  rawToolCalls: unknown[],
): Array<{ id: string; name: string; args: Record<string, unknown> }> {
  return rawToolCalls.map((tc) => {
    const toolCall = tc as {
      id: string;
      function?: { name: string; arguments: string };
      name?: string;
      args?: Record<string, unknown>;
    };

    // Handle both OpenAI format and simplified format
    if (toolCall.function) {
      return {
        id: toolCall.id,
        name: toolCall.function.name,
        args: JSON.parse(toolCall.function.arguments),
      };
    }

    return {
      id: toolCall.id,
      name: toolCall.name ?? "",
      args: toolCall.args ?? {},
    };
  });
}

/**
 * Create initial streaming state
 *
 * @param messageId - ID for the message being built
 * @returns Initial streaming state
 */
export function createStreamState(messageId: string): StreamingMessageState {
  return {
    messageId,
    content: "",
    thinking: "",
    toolCalls: [],
    toolResults: new Map(),
    citations: [],
    requiresAction: false,
    finishReason: undefined,
  };
}

/**
 * Check if streaming is complete
 */
export function isStreamComplete(state: StreamingMessageState): boolean {
  return state.finishReason !== undefined;
}

/**
 * Check if stream has content
 */
export function hasContent(state: StreamingMessageState): boolean {
  return state.content.length > 0 || state.thinking.length > 0;
}
