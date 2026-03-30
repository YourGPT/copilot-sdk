/**
 * Summary Buffer Strategy
 *
 * Keeps the most recent recentBuffer messages verbatim.
 * Everything older is summarized into a rolling summary
 * injected as the first system message.
 *
 * Requires a /api/compact endpoint or custom summarizer.
 */

import type {
  DisplayMessage,
  LLMMessage,
  SessionCompactionState,
} from "../types";
import { isCompactionMarker, toLLMMessages } from "../message-utils";
import { estimateMessagesTokens } from "../token-counter";

export interface SummaryBufferOptions {
  recentBuffer: number;
  tokenBudget: number;
  compactionThreshold: number;
  compactionUrl?: string;
  summarizer?: (messages: LLMMessage[]) => Promise<string>;
}

export interface SummaryBufferResult {
  llmMessages: LLMMessage[];
  newSummary?: string;
  tokensSaved?: number;
  messagesSummarized?: number;
}

/**
 * Build LLM context using summary-buffer strategy.
 * Does NOT trigger compaction — call triggerCompaction() for that.
 * Just injects existing rollingSummary + recent messages.
 */
export function buildSummaryBufferContext(
  displayMessages: DisplayMessage[],
  compactionState: SessionCompactionState,
  options: SummaryBufferOptions,
): LLMMessage[] {
  const { recentBuffer } = options;

  // Always include system/compaction messages
  const systemMessages = displayMessages.filter(
    (m) => m.role === "system" || isCompactionMarker(m),
  );
  const conversationMessages = displayMessages.filter(
    (m) => m.role !== "system" && !isCompactionMarker(m),
  );

  const recentStart = Math.max(0, conversationMessages.length - recentBuffer);
  const recentMessages = conversationMessages.slice(recentStart);

  const result: LLMMessage[] = [];

  // 1. Inject working memory (always first)
  if (compactionState.workingMemory.length > 0) {
    result.push({
      role: "system",
      content: `[Working memory — always active]\n${compactionState.workingMemory.join("\n")}`,
    });
  }

  // 2. Inject rolling summary if it exists
  if (compactionState.rollingSummary) {
    result.push({
      role: "system",
      content: `[Previous conversation summary]\n${compactionState.rollingSummary}`,
    });
  }

  // 3. System messages
  result.push(...toLLMMessages(systemMessages));

  // 4. Recent messages verbatim
  result.push(...toLLMMessages(recentMessages));

  return result;
}

/**
 * Determine if compaction should fire based on current token usage.
 */
export function shouldCompact(
  currentTokens: number,
  maxTokens: number,
  threshold: number,
): boolean {
  return currentTokens / maxTokens >= threshold;
}

/**
 * Run compaction: summarize older messages and return new rolling summary.
 * Called by useMessageHistory when threshold is crossed.
 */
export async function runCompaction(
  displayMessages: DisplayMessage[],
  compactionState: SessionCompactionState,
  options: SummaryBufferOptions,
): Promise<SummaryBufferResult> {
  const { recentBuffer, compactionUrl, summarizer } = options;

  const conversationMessages = displayMessages.filter(
    (m) => m.role !== "system" && !isCompactionMarker(m),
  );

  const cutoff = Math.max(0, conversationMessages.length - recentBuffer);
  const toSummarize = conversationMessages.slice(0, cutoff);

  if (toSummarize.length === 0) {
    return { llmMessages: toLLMMessages(displayMessages) };
  }

  const llmToSummarize = toLLMMessages(toSummarize);
  const originalTokens = estimateMessagesTokens(llmToSummarize);

  let newSummary: string;

  if (summarizer) {
    newSummary = await summarizer(llmToSummarize);
  } else if (compactionUrl) {
    newSummary = await fetchSummary(compactionUrl, {
      messages: llmToSummarize,
      existingSummary: compactionState.rollingSummary,
      workingMemory: compactionState.workingMemory,
    });
  } else {
    // Fallback: plain concatenation (no LLM summarization)
    newSummary = buildFallbackSummary(
      llmToSummarize,
      compactionState.rollingSummary,
    );
  }

  const summaryTokens = Math.ceil(newSummary.length / 3.5);
  const tokensSaved = Math.max(0, originalTokens - summaryTokens);

  return {
    llmMessages: buildSummaryBufferContext(
      displayMessages,
      { ...compactionState, rollingSummary: newSummary },
      options,
    ),
    newSummary,
    tokensSaved,
    messagesSummarized: toSummarize.length,
  };
}

async function fetchSummary(
  url: string,
  body: {
    messages: LLMMessage[];
    existingSummary: string | null;
    workingMemory: string[];
  },
): Promise<string> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`Compaction endpoint returned ${res.status}`);
  }

  const data = await res.json();
  if (!data?.summary) {
    throw new Error("Compaction endpoint did not return { summary: string }");
  }

  return data.summary as string;
}

function buildFallbackSummary(
  messages: LLMMessage[],
  existingSummary: string | null,
): string {
  const lines = messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => `${m.role}: ${(m.content ?? "").slice(0, 200)}`)
    .join("\n");

  return existingSummary
    ? `${existingSummary}\n\n[Additional context]\n${lines}`
    : lines;
}
