/**
 * Sliding Window Strategy
 *
 * Keeps system prompt + most recent messages within token budget.
 * Tool-call pairs are always kept atomic (never split).
 */

import { findSafeWindowStart, isCompactionMarker } from "../message-utils";
import { estimateMessagesTokens } from "../token-counter";
import type { DisplayMessage, LLMMessage } from "../types";
import { toLLMMessages } from "../message-utils";

export interface SlidingWindowOptions {
  /** Total token budget (maxContextTokens - reserveForResponse) */
  tokenBudget: number;
  /** Minimum recent messages to always keep verbatim */
  recentBuffer: number;
}

/**
 * Apply sliding window to a set of display messages.
 * Returns the subset of messages that fit within the token budget.
 *
 * Guarantees:
 * - recentBuffer messages are always included
 * - Tool-call pairs are never split
 * - System messages and compaction markers are always included
 */
export function applySlidingWindow(
  messages: DisplayMessage[],
  options: SlidingWindowOptions,
): DisplayMessage[] {
  const { tokenBudget, recentBuffer } = options;

  if (messages.length === 0) return messages;

  // Always keep system/compaction messages
  const systemMessages = messages.filter(
    (m) => m.role === "system" || isCompactionMarker(m),
  );
  const conversationMessages = messages.filter(
    (m) => m.role !== "system" && !isCompactionMarker(m),
  );

  // Estimate system tokens
  const systemTokens = estimateMessagesTokens(toLLMMessages(systemMessages));
  const remainingBudget = tokenBudget - systemTokens;

  if (conversationMessages.length === 0) return systemMessages;

  // Always include the last recentBuffer messages
  const recentStart = Math.max(0, conversationMessages.length - recentBuffer);
  const recent = conversationMessages.slice(recentStart);
  const older = conversationMessages.slice(0, recentStart);

  // Check if everything fits
  const allTokens = estimateMessagesTokens(toLLMMessages(conversationMessages));
  if (allTokens <= remainingBudget) {
    return messages; // Everything fits, no trimming needed
  }

  // Greedily include older messages from newest-to-oldest until budget fills
  const recentTokens = estimateMessagesTokens(toLLMMessages(recent));
  let available = remainingBudget - recentTokens;
  const included: DisplayMessage[] = [];

  for (let i = older.length - 1; i >= 0; i--) {
    const msgTokens = estimateMessagesTokens(toLLMMessages([older[i]]));
    if (available - msgTokens < 0) break;
    included.unshift(older[i]);
    available -= msgTokens;
  }

  // Ensure the window start is safe (no split tool-call pairs)
  const combined = [...included, ...recent];
  const safeStart = findSafeWindowStart(combined, 0);
  const safeWindow = combined.slice(safeStart);

  // Reconstruct: system messages first, then windowed conversation
  return [...systemMessages, ...safeWindow];
}

/**
 * Apply toolResultMaxChars truncation to LLMMessages before sending.
 */
export function truncateToolResults(
  messages: LLMMessage[],
  maxChars: number,
): LLMMessage[] {
  if (maxChars === 0) return messages;

  return messages.map((msg) => {
    if (msg.role !== "tool") return msg;
    if (!msg.content || msg.content.length <= maxChars) return msg;

    return {
      ...msg,
      content:
        msg.content.slice(0, maxChars) +
        `\n[truncated — original ${msg.content.length} chars, limit ${maxChars}]`,
    };
  });
}
