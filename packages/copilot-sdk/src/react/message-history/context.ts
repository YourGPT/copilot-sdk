/**
 * MessageHistoryContext
 *
 * React context for sharing MessageHistory config and state
 * across the component tree. Optional — useMessageHistory() works
 * standalone without this provider.
 */

import { createContext, useContext } from "react";
import type {
  MessageHistoryConfig,
  SessionCompactionState,
  TokenUsage,
} from "./types";

export interface MessageHistoryContextValue {
  /** Merged config (provider defaults, overridable per-component) */
  config: Required<
    Pick<
      MessageHistoryConfig,
      | "strategy"
      | "maxContextTokens"
      | "reserveForResponse"
      | "compactionThreshold"
      | "recentBuffer"
      | "toolResultMaxChars"
      | "persistSession"
      | "storageKey"
    >
  > &
    MessageHistoryConfig;
  /** Current token usage (updated after each AI response) */
  tokenUsage: TokenUsage;
  /** Current compaction state */
  compactionState: SessionCompactionState;
}

const defaultTokenUsage: TokenUsage = {
  current: 0,
  max: 128000,
  percentage: 0,
  isApproaching: false,
};

const defaultCompactionState: SessionCompactionState = {
  rollingSummary: null,
  lastCompactionAt: null,
  compactionCount: 0,
  totalTokensSaved: 0,
  workingMemory: [],
  displayMessageCount: 0,
  llmMessageCount: 0,
};

export const defaultMessageHistoryConfig = {
  strategy: "none" as const,
  maxContextTokens: 128000,
  reserveForResponse: 4096,
  compactionThreshold: 0.75,
  recentBuffer: 10,
  toolResultMaxChars: 10000,
  persistSession: false,
  storageKey: "copilot-session",
};

export const MessageHistoryContext = createContext<MessageHistoryContextValue>({
  config: defaultMessageHistoryConfig,
  tokenUsage: defaultTokenUsage,
  compactionState: defaultCompactionState,
});

export function useMessageHistoryContext(): MessageHistoryContextValue {
  return useContext(MessageHistoryContext);
}
