/**
 * Token Counter
 *
 * Phase 2: Two-tier token estimation.
 * - Tier 1: estimateTokensFast() — zero deps, chars/3.5, always available (~85-90% accurate)
 * - Tier 2: countTokensAccurate() — lazy-loads gpt-tokenizer only when near threshold
 */

import type { LLMMessage } from "./types";

// ── Tier 1: Fast (zero deps) ──────────────────────────────────────

/**
 * Fast token estimate using chars/3.5 heuristic.
 * ~85-90% accurate for English. Zero dependencies.
 */
export function estimateTokensFast(text: string): number {
  return Math.ceil(text.length / 3.5);
}

/**
 * Estimate tokens for a single LLMMessage.
 */
export function estimateMessageTokens(msg: LLMMessage): number {
  let chars = msg.content?.length ?? 0;

  if (msg.tool_calls?.length) {
    for (const tc of msg.tool_calls) {
      chars += JSON.stringify(tc).length;
    }
  }

  // ~4 tokens overhead per message (role, formatting)
  return Math.ceil(chars / 3.5) + 4;
}

/**
 * Estimate total tokens for an array of LLMMessages.
 */
export function estimateMessagesTokens(messages: LLMMessage[]): number {
  return messages.reduce((sum, msg) => sum + estimateMessageTokens(msg), 0);
}

// ── Tier 2: Accurate (lazy-loaded) ───────────────────────────────

let _encoder: ((text: string) => number[]) | undefined = undefined;

/**
 * Accurate token count using gpt-tokenizer.
 * Lazy-loaded only when near threshold to avoid bundle cost.
 * Falls back to fast estimation if tokenizer unavailable.
 */
export async function countTokensAccurate(text: string): Promise<number> {
  if (!_encoder) {
    try {
      const mod = await import("gpt-tokenizer/encoding/o200k_base" as string);
      _encoder = mod.encode as (text: string) => number[];
    } catch {
      // gpt-tokenizer not installed — fall back to fast
      return estimateTokensFast(text);
    }
  }
  return (_encoder as (text: string) => number[])(text).length;
}

/**
 * Accurate token count for all messages combined.
 * Falls back to fast estimation if tokenizer unavailable.
 */
export async function countMessagesTokensAccurate(
  messages: LLMMessage[],
): Promise<number> {
  const text = messages
    .map(
      (m) =>
        `${m.role}: ${m.content ?? ""} ${JSON.stringify(m.tool_calls ?? "")}`,
    )
    .join("\n");
  return countTokensAccurate(text);
}

// ── Dispatcher ────────────────────────────────────────────────────

export type TokenEstimationMode = "fast" | "accurate" | "off";

/**
 * Estimate tokens for messages using the specified mode.
 */
export function estimateTokens(
  messages: LLMMessage[],
  mode: TokenEstimationMode = "fast",
): number {
  if (mode === "off") return 0;
  return estimateMessagesTokens(messages);
}
