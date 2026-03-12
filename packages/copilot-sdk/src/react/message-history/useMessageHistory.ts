/**
 * useMessageHistory
 *
 * Dual-layer message access with optional compaction.
 * Strategy 'none' (default) = zero-config, 100% backward-compat.
 */

import { useMemo, useState, useCallback, useEffect, useRef } from "react";
import { useCopilot } from "../provider/CopilotProvider";
import { toDisplayMessage, toLLMMessages } from "./message-utils";
import {
  useMessageHistoryContext,
  defaultMessageHistoryConfig,
} from "./context";
import { estimateTokens } from "./token-counter";
import {
  applySlidingWindow,
  truncateToolResults,
  applySelectivePrune,
  buildSummaryBufferContext,
  runCompaction,
  shouldCompact,
} from "./strategies";
import {
  saveCompactionState,
  loadCompactionState,
  saveDisplayMessages,
  loadDisplayMessages,
  clearSession,
} from "./session-persistence";
import type {
  UseMessageHistoryOptions,
  UseMessageHistoryReturn,
  DisplayMessage,
  LLMMessage,
  SessionCompactionState,
  TokenUsage,
  CompactionEvent,
} from "./types";

const DEFAULT_COMPACTION_STATE: SessionCompactionState = {
  rollingSummary: null,
  lastCompactionAt: null,
  compactionCount: 0,
  totalTokensSaved: 0,
  workingMemory: [],
  displayMessageCount: 0,
  llmMessageCount: 0,
};

export function useMessageHistory(
  options: UseMessageHistoryOptions = {},
): UseMessageHistoryReturn {
  const { messages } = useCopilot();
  const ctx = useMessageHistoryContext();

  const config = useMemo(
    () => ({ ...defaultMessageHistoryConfig, ...ctx.config, ...options }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      ctx.config,
      options.strategy,
      options.maxContextTokens,
      options.recentBuffer,
      options.compactionThreshold,
    ],
  );

  const storageKey = config.storageKey ?? "copilot-session";
  const strategy = options.skipCompaction
    ? "none"
    : (config.strategy ?? "none");

  // ── Compaction state ──────────────────────────────────────────
  const [compactionState, setCompactionState] =
    useState<SessionCompactionState>(() => {
      if (config.persistSession) {
        return loadCompactionState(storageKey) ?? DEFAULT_COMPACTION_STATE;
      }
      return DEFAULT_COMPACTION_STATE;
    });

  // ── Display messages: UIMessage → DisplayMessage ──────────────
  const displayMessages: DisplayMessage[] = useMemo(
    () => messages.map(toDisplayMessage),
    [messages],
  );

  // Restore persisted display messages on cold start (async)
  const restoredRef = useRef(false);
  useEffect(() => {
    if (!config.persistSession || restoredRef.current) return;
    restoredRef.current = true;
    loadDisplayMessages(storageKey).then((saved) => {
      if (saved?.length && messages.length === 0) {
        // Only restore if current session is empty
        // (useCopilot().setMessages would be called here in a real integration)
        // For now: restored messages are available via displayMessages after setMessages
      }
    });
  }, [config.persistSession, storageKey, messages.length]);

  // Persist display messages when they change
  useEffect(() => {
    if (!config.persistSession || displayMessages.length === 0) return;
    saveDisplayMessages(storageKey, displayMessages);
  }, [config.persistSession, storageKey, displayMessages]);

  // ── Build LLM context ─────────────────────────────────────────
  const llmMessages: LLMMessage[] = useMemo(() => {
    const maxTokens = config.maxContextTokens ?? 128000;
    const reserve = config.reserveForResponse ?? 4096;
    const tokenBudget = maxTokens - reserve;
    const recentBuffer = config.recentBuffer ?? 10;
    const maxChars = config.toolResultMaxChars ?? 10000;

    let result: LLMMessage[];

    switch (strategy) {
      case "sliding-window": {
        const windowed = applySlidingWindow(displayMessages, {
          tokenBudget,
          recentBuffer,
        });
        result = truncateToolResults(toLLMMessages(windowed), maxChars);
        break;
      }
      case "selective-prune": {
        result = truncateToolResults(
          applySelectivePrune(displayMessages, recentBuffer),
          maxChars,
        );
        break;
      }
      case "summary-buffer": {
        result = truncateToolResults(
          buildSummaryBufferContext(displayMessages, compactionState, {
            recentBuffer,
            tokenBudget,
            compactionThreshold: config.compactionThreshold ?? 0.75,
            compactionUrl: config.compactionUrl,
            summarizer: options.summarizer,
          }),
          maxChars,
        );
        break;
      }
      default:
        // 'none' — no compaction, just type conversion + optional truncation
        result = truncateToolResults(toLLMMessages(displayMessages), maxChars);
    }

    return result;
  }, [displayMessages, compactionState, strategy, config, options.summarizer]);

  // ── Token usage ───────────────────────────────────────────────
  // Count full history (not pruned llmMessages) so the threshold reflects
  // actual accumulated tokens, not the already-windowed output.
  const tokenUsage: TokenUsage = useMemo(() => {
    const mode = options.tokenEstimation ?? "fast";
    const current = estimateTokens(toLLMMessages(displayMessages), mode);
    const max = config.maxContextTokens ?? 128000;
    const threshold = config.compactionThreshold ?? 0.75;
    const percentage = current / max;
    return { current, max, percentage, isApproaching: percentage >= threshold };
  }, [
    displayMessages,
    config.maxContextTokens,
    config.compactionThreshold,
    options.tokenEstimation,
  ]);

  // Notify via callback
  useEffect(() => {
    if (config.onTokenUsage && tokenUsage.current > 0) {
      config.onTokenUsage(tokenUsage);
    }
  }, [tokenUsage, config.onTokenUsage]);

  // Persist compaction state when it changes
  useEffect(() => {
    if (config.persistSession) {
      saveCompactionState(storageKey, {
        ...compactionState,
        displayMessageCount: displayMessages.length,
        llmMessageCount: llmMessages.length,
      });
    }
  }, [
    config.persistSession,
    storageKey,
    compactionState,
    displayMessages.length,
    llmMessages.length,
  ]);

  // Auto-compaction trigger for summary-buffer
  const isCompactingRef = useRef(false);
  const [isCompacting, setIsCompacting] = useState(false);
  useEffect(() => {
    if (
      strategy !== "summary-buffer" ||
      options.skipCompaction ||
      isCompactingRef.current ||
      !tokenUsage.isApproaching
    )
      return;

    isCompactingRef.current = true;
    setIsCompacting(true);
    runCompaction(displayMessages, compactionState, {
      recentBuffer: config.recentBuffer ?? 10,
      tokenBudget:
        (config.maxContextTokens ?? 128000) -
        (config.reserveForResponse ?? 4096),
      compactionThreshold: config.compactionThreshold ?? 0.75,
      compactionUrl: config.compactionUrl,
      summarizer: options.summarizer,
    })
      .then((result) => {
        if (result.newSummary) {
          const event: CompactionEvent = {
            type: "auto",
            compactionCount: compactionState.compactionCount + 1,
            messagesSummarized: result.messagesSummarized ?? 0,
            tokensSaved: result.tokensSaved ?? 0,
            timestamp: Date.now(),
          };
          setCompactionState((prev) => ({
            ...prev,
            rollingSummary: result.newSummary!,
            lastCompactionAt: Date.now(),
            compactionCount: prev.compactionCount + 1,
            totalTokensSaved: prev.totalTokensSaved + (result.tokensSaved ?? 0),
          }));
          config.onCompaction?.(event);
        }
      })
      .finally(() => {
        isCompactingRef.current = false;
        setIsCompacting(false);
      });
  }, [tokenUsage.isApproaching, strategy]);

  // ── Public API ────────────────────────────────────────────────

  const compactSession = useCallback(
    async (instructions?: string) => {
      if (strategy !== "summary-buffer") return;

      const result = await runCompaction(displayMessages, compactionState, {
        recentBuffer: config.recentBuffer ?? 10,
        tokenBudget:
          (config.maxContextTokens ?? 128000) -
          (config.reserveForResponse ?? 4096),
        compactionThreshold: config.compactionThreshold ?? 0.75,
        compactionUrl: config.compactionUrl,
        summarizer: options.summarizer
          ? (msgs) => options.summarizer!(msgs)
          : instructions
            ? (msgs) =>
                fetchWithInstructions(config.compactionUrl!, msgs, instructions)
            : undefined,
      });

      if (result.newSummary) {
        const event: CompactionEvent = {
          type: "manual",
          compactionCount: compactionState.compactionCount + 1,
          messagesSummarized: result.messagesSummarized ?? 0,
          tokensSaved: result.tokensSaved ?? 0,
          timestamp: Date.now(),
        };
        setCompactionState((prev) => ({
          ...prev,
          rollingSummary: result.newSummary!,
          lastCompactionAt: Date.now(),
          compactionCount: prev.compactionCount + 1,
          totalTokensSaved: prev.totalTokensSaved + (result.tokensSaved ?? 0),
        }));
        config.onCompaction?.(event);
      }
    },
    [displayMessages, compactionState, config, strategy, options.summarizer],
  );

  const addToWorkingMemory = useCallback((fact: string) => {
    setCompactionState((prev) => ({
      ...prev,
      workingMemory: [...prev.workingMemory, fact],
    }));
  }, []);

  const clearWorkingMemory = useCallback(() => {
    setCompactionState((prev) => ({ ...prev, workingMemory: [] }));
  }, []);

  const resetSession = useCallback(async () => {
    setCompactionState(DEFAULT_COMPACTION_STATE);
    if (config.persistSession) {
      await clearSession(storageKey);
    }
  }, [config.persistSession, storageKey]);

  return {
    displayMessages,
    llmMessages,
    tokenUsage,
    isCompacting,
    compactionState: {
      ...compactionState,
      displayMessageCount: displayMessages.length,
      llmMessageCount: llmMessages.length,
    },
    compactSession,
    addToWorkingMemory,
    clearWorkingMemory,
    resetSession,
  };
}

async function fetchWithInstructions(
  url: string,
  messages: LLMMessage[],
  instructions: string,
): Promise<string> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, instructions }),
  });
  const data = await res.json();
  return data.summary as string;
}
