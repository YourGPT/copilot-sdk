/**
 * Selective Prune Strategy
 *
 * Removes high-cost, low-value content from older messages without
 * losing the conversation thread:
 * - Tool results older than N turns → compact stub
 * - Reasoning/thinking blocks in older turns → stripped
 * - Repeated skill injections → deduplicated
 */

import type { DisplayMessage, LLMMessage, CompactedToolResult } from "../types";
import { estimateMessageTokens } from "../token-counter";
import { toLLMMessage } from "../message-utils";

export interface SelectivePruneOptions {
  /** Tool results older than this many turns are compacted. @default 3 */
  toolResultAgeTurns?: number;
  /** Strip reasoning/thinking content from older messages. @default true */
  stripOldReasoning?: boolean;
  /** Deduplicate repeated skill injections. @default true */
  deduplicateSkills?: boolean;
}

/**
 * Apply selective pruning to LLMMessages.
 * Only touches messages older than recentBuffer.
 */
export function applySelectivePrune(
  displayMessages: DisplayMessage[],
  recentBuffer: number,
  options: SelectivePruneOptions = {},
): LLMMessage[] {
  const {
    toolResultAgeTurns = 3,
    stripOldReasoning = true,
    deduplicateSkills = true,
  } = options;

  const cutoff = Math.max(0, displayMessages.length - recentBuffer);
  const seenSkillContent = new Set<string>();

  return displayMessages.map((msg, idx): LLMMessage => {
    const llm = toLLMMessage(msg);
    const isOld = idx < cutoff;

    // Deduplicate skill injections (system messages with skill content)
    if (deduplicateSkills && msg.role === "system" && llm.content) {
      const key = llm.content.slice(0, 100); // fingerprint on first 100 chars
      if (seenSkillContent.has(key)) {
        return { ...llm, content: "[skill instruction — deduplicated]" };
      }
      seenSkillContent.add(key);
    }

    if (!isOld) return llm;

    // Strip reasoning/thinking from old assistant messages
    if (stripOldReasoning && msg.role === "assistant" && msg.thinking) {
      llm.content = llm.content; // content stays, thinking stripped (not in LLMMessage)
    }

    // Compact old tool results
    if (msg.role === "tool" && llm.content) {
      const originalSize = llm.content.length;
      if (originalSize > 500) {
        const stub = buildToolResultStub(msg, llm.content);
        return {
          role: "tool",
          tool_call_id: llm.tool_call_id,
          content: JSON.stringify(stub),
        };
      }
    }

    return llm;
  });
}

function buildToolResultStub(
  msg: DisplayMessage,
  content: string,
): CompactedToolResult {
  return {
    type: "compacted-tool-result",
    toolName: (msg.metadata?.toolName as string) ?? "tool",
    toolCallId: msg.toolCallId ?? "",
    args: (msg.metadata?.toolArgs as Record<string, unknown>) ?? {},
    executedAt: msg.timestamp,
    status: content.includes('"error"') ? "error" : "success",
    originalSize: content.length,
    summary: buildSummary(content),
    extract: content.slice(0, 200),
  };
}

function buildSummary(content: string): string {
  try {
    const parsed = JSON.parse(content);
    if (parsed?.message) return String(parsed.message).slice(0, 120);
    if (parsed?.error) return `Error: ${String(parsed.error).slice(0, 100)}`;
    if (Array.isArray(parsed)) return `Array result — ${parsed.length} items`;
    const keys = Object.keys(parsed).slice(0, 3).join(", ");
    return `Object result — keys: ${keys}`;
  } catch {
    return content.slice(0, 120);
  }
}
