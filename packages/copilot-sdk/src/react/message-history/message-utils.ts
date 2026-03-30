/**
 * Message Utilities
 *
 * Conversion helpers between UIMessage / DisplayMessage / LLMMessage.
 * Core invariant: tool-call pairs are always kept atomic.
 */

import type { UIMessage } from "../../chat/types/message";
import type { DisplayMessage, LLMMessage, CompactionMarker } from "./types";

// ── Conversion ────────────────────────────────────────────────────

/**
 * Promote a UIMessage to a DisplayMessage.
 * Safe to call on an existing DisplayMessage (idempotent).
 */
export function toDisplayMessage(msg: UIMessage): DisplayMessage {
  return {
    ...msg,
    timestamp:
      msg.createdAt instanceof Date ? msg.createdAt.getTime() : Date.now(),
  };
}

/**
 * Convert a DisplayMessage to the LLMMessage format sent to the model.
 * CompactionMarkers are converted to system messages with the rolling summary.
 */
export function toLLMMessage(msg: DisplayMessage): LLMMessage {
  // CompactionMarkers become system messages in LLM context
  if (isCompactionMarker(msg)) {
    return {
      role: "system",
      content: `[Previous conversation summary]\n${msg.content}`,
    };
  }

  const base: LLMMessage = {
    role: msg.role,
    content: msg.content,
  };

  if (msg.toolCalls?.length) {
    base.tool_calls = msg.toolCalls;
  }

  if (msg.toolCallId) {
    base.tool_call_id = msg.toolCallId;
  }

  return base;
}

/**
 * Convert an array of DisplayMessages to LLMMessages.
 */
export function toLLMMessages(messages: DisplayMessage[]): LLMMessage[] {
  return messages.map(toLLMMessage);
}

// ── Atomic tool-call pair enforcement ────────────────────────────

/**
 * Keep tool-call pairs atomic — an assistant message with tool_calls
 * must always be followed by its tool-result messages.
 *
 * When slicing/pruning, call this to ensure the window boundary never
 * splits an assistant message from its tool results.
 *
 * Returns the input array with any split pairs re-attached at the start.
 */
export function keepToolPairsAtomic(
  messages: DisplayMessage[],
): DisplayMessage[] {
  if (messages.length === 0) return messages;

  // Find the first message that has pending tool-call results following it
  const firstIdx = messages.findIndex((msg, i) => {
    if (msg.role !== "assistant" || !msg.toolCalls?.length) return false;
    const toolCallIds = new Set(msg.toolCalls.map((tc) => tc.id));
    // Check if ALL tool results for this message are present in the slice
    const resultIds = new Set(
      messages
        .slice(i + 1)
        .filter((m) => m.role === "tool" && m.toolCallId)
        .map((m) => m.toolCallId as string),
    );
    return [...toolCallIds].some((id) => !resultIds.has(id));
  });

  // No orphaned tool calls
  if (firstIdx === -1) return messages;

  // Drop back to before the split assistant message
  return messages.slice(firstIdx);
}

/**
 * Find the safe window boundary — the index after which all tool-call
 * pairs are complete. Used by sliding-window to avoid splits.
 *
 * Returns the earliest index we can safely start a window from.
 */
export function findSafeWindowStart(
  messages: DisplayMessage[],
  desiredStart: number,
): number {
  // Walk backward from desiredStart to find an assistant message with tool_calls
  // whose results fall inside the window
  for (let i = desiredStart; i < messages.length; i++) {
    const msg = messages[i];
    if (
      msg.role === "user" ||
      (msg.role === "assistant" && !msg.toolCalls?.length)
    ) {
      return i;
    }
  }
  return desiredStart;
}

// ── Type guards ───────────────────────────────────────────────────

export function isCompactionMarker(
  msg: DisplayMessage,
): msg is CompactionMarker {
  return (
    msg.role === "system" &&
    (msg as CompactionMarker).type === "compaction-marker"
  );
}

export function isToolMessage(msg: DisplayMessage): boolean {
  return msg.role === "tool";
}

export function isAssistantWithToolCalls(msg: DisplayMessage): boolean {
  return msg.role === "assistant" && !!msg.toolCalls?.length;
}
