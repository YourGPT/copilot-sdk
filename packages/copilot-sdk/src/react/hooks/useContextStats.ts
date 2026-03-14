"use client";

import { useMemo } from "react";
import { useCopilot } from "../provider/CopilotProvider";
import type { UIMessage } from "../../chat";
import type { ContextUsage } from "../../core";

/**
 * Per-message token usage returned by the LLM provider.
 */
export interface MessageTokenUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

/**
 * Context window stats — updated reactively as messages are sent and contexts change.
 */
export interface ContextStats {
  /**
   * Full context usage snapshot from the last send — includes token counts and
   * percentages for every budget bucket (systemPrompt, history, toolResults, tools).
   * null until the first message is sent.
   */
  contextUsage: ContextUsage | null;

  /**
   * Convenience: total estimated tokens currently in the prompt (from contextUsage).
   * Falls back to a fast chars/3.5 estimate from contextChars before first send.
   */
  totalTokens: number;

  /**
   * Convenience: percentage of context window used (0–1).
   * 0 until first send.
   */
  usagePercent: number;

  /** Total characters currently in the AI context (system prompt contribution). */
  contextChars: number;

  /** Number of tools currently registered in the agent loop. */
  toolCount: number;

  /** Number of visible (non-system) messages in the active thread. */
  messageCount: number;

  /**
   * Actual token usage from the last assistant message metadata (if provider returned it).
   * null if not available.
   */
  lastResponseUsage: MessageTokenUsage | null;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getLastResponseUsage(messages: UIMessage[]): MessageTokenUsage | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role === "assistant" && msg.metadata?.usage) {
      const u = msg.metadata.usage as {
        prompt_tokens?: number;
        completion_tokens?: number;
        total_tokens?: number;
      };
      const prompt = u.prompt_tokens ?? 0;
      const completion = u.completion_tokens ?? 0;
      return {
        prompt_tokens: prompt,
        completion_tokens: completion,
        total_tokens: u.total_tokens ?? prompt + completion,
      };
    }
  }
  return null;
}

// ── Hook ─────────────────────────────────────────────────────────────────────

/**
 * useContextStats — live snapshot of the AI copilot's context window usage.
 *
 * `contextUsage` is the richest field — it has full breakdown by bucket with
 * token counts and percentages, updated on every message send.
 *
 * @example
 * ```tsx
 * const { contextUsage, toolCount, totalTokens, usagePercent } = useContextStats();
 * // contextUsage.breakdown.systemPrompt.percent — % of window used by system prompt
 * // contextUsage.breakdown.history.tokens — tokens from conversation history
 * // usagePercent — overall window fill (0–1)
 * ```
 */
export function useContextStats(): ContextStats {
  const { contextChars, contextUsage, registeredTools, messages } =
    useCopilot();

  const toolCount = useMemo(() => registeredTools.length, [registeredTools]);

  const messageCount = useMemo(
    () => messages.filter((m) => m.role !== "system").length,
    [messages],
  );

  const totalTokens = useMemo(() => {
    if (contextUsage) return contextUsage.total.tokens;
    // fallback before first send: estimate from context chars
    return Math.ceil(contextChars / 3.5);
  }, [contextUsage, contextChars]);

  const usagePercent = useMemo(() => {
    if (contextUsage) return contextUsage.total.percent;
    return 0;
  }, [contextUsage]);

  const lastResponseUsage = useMemo(
    () => getLastResponseUsage(messages),
    [messages],
  );

  return {
    contextUsage,
    totalTokens,
    usagePercent,
    contextChars,
    toolCount,
    messageCount,
    lastResponseUsage,
  };
}
