/**
 * useMessageHistory
 *
 * Phase 1 skeleton — returns displayMessages and llmMessages from
 * the current CopilotProvider messages with no compaction applied.
 *
 * Strategy: 'none' (default) — identical to current SDK behaviour.
 * Future phases add compaction strategies on top of this foundation.
 */

import { useMemo } from "react";
import { useCopilot } from "../provider/CopilotProvider";
import { toDisplayMessage, toLLMMessages } from "./message-utils";
import {
  useMessageHistoryContext,
  defaultMessageHistoryConfig,
} from "./context";
import type {
  UseMessageHistoryOptions,
  UseMessageHistoryReturn,
  DisplayMessage,
  SessionCompactionState,
  TokenUsage,
} from "./types";

const DEFAULT_TOKEN_USAGE: TokenUsage = {
  current: 0,
  max: 128000,
  percentage: 0,
  isApproaching: false,
};

const DEFAULT_COMPACTION_STATE: SessionCompactionState = {
  rollingSummary: null,
  lastCompactionAt: null,
  compactionCount: 0,
  totalTokensSaved: 0,
  workingMemory: [],
  displayMessageCount: 0,
  llmMessageCount: 0,
};

/**
 * useMessageHistory — dual-layer message access.
 *
 * Phase 1: strategy='none' — no compaction, just type promotion.
 *
 * @example
 * ```tsx
 * const { displayMessages, llmMessages, tokenUsage } = useMessageHistory();
 * // displayMessages: pass to CopilotChat
 * // llmMessages: pass to your API route (Phase 2+ adds compaction)
 * ```
 */
export function useMessageHistory(
  options: UseMessageHistoryOptions = {},
): UseMessageHistoryReturn {
  const { messages } = useCopilot();
  const ctx = useMessageHistoryContext();

  // Merge: hook options override provider context which overrides defaults
  const config = useMemo(
    () => ({ ...defaultMessageHistoryConfig, ...ctx.config, ...options }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      ctx.config,
      options.strategy,
      options.maxContextTokens,
      options.recentBuffer,
    ],
  );

  // Promote UIMessages to DisplayMessages (adds timestamp field)
  const displayMessages: DisplayMessage[] = useMemo(
    () => messages.map(toDisplayMessage),
    [messages],
  );

  // Phase 1: no compaction — llmMessages === displayMessages converted
  // Future phases will apply sliding-window / summary-buffer here
  const llmMessages = useMemo(
    () => toLLMMessages(displayMessages),
    [displayMessages],
  );

  const tokenUsage: TokenUsage = useMemo(
    () => ({
      ...DEFAULT_TOKEN_USAGE,
      max: config.maxContextTokens,
      // Phase 2 will compute real token estimates
    }),
    [config.maxContextTokens],
  );

  const compactionState: SessionCompactionState = useMemo(
    () => ({
      ...DEFAULT_COMPACTION_STATE,
      displayMessageCount: displayMessages.length,
      llmMessageCount: llmMessages.length,
    }),
    [displayMessages.length, llmMessages.length],
  );

  // Phase 3 will implement these
  const compactSession = async (_instructions?: string) => {
    // noop in Phase 1
  };

  const addToWorkingMemory = (_fact: string) => {
    // noop in Phase 1
  };

  const clearWorkingMemory = () => {
    // noop in Phase 1
  };

  const resetSession = () => {
    // noop in Phase 1
  };

  return {
    displayMessages,
    llmMessages,
    tokenUsage,
    compactionState,
    compactSession,
    addToWorkingMemory,
    clearWorkingMemory,
    resetSession,
  };
}
