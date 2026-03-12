/**
 * Message History Types
 *
 * Core types for the dual-layer context management system.
 * DisplayMessage extends UIMessage for full backward-compat.
 */

import type { UIMessage } from "../../chat/types/message";
import type { ToolCall } from "../../core";

// ── Display Layer ─────────────────────────────────────────────────

/**
 * DisplayMessage — what the UI renders, never shrinks.
 * Extends UIMessage so it can be used anywhere UIMessage is accepted.
 */
export interface DisplayMessage extends UIMessage {
  /** Unix timestamp (ms). Mirrors createdAt for easier arithmetic. */
  timestamp: number;
}

/**
 * CompactionMarker — injected into displayMessages when compaction fires.
 * Shown in the UI as a divider: "Earlier conversation summarized".
 */
export interface CompactionMarker extends DisplayMessage {
  role: "system";
  /** Discriminator — always 'compaction-marker' */
  type: "compaction-marker";
  /** Human-readable summary of what was compacted */
  content: string;
  /** IDs of the DisplayMessages that were summarized */
  summarizedMessageIds: string[];
  /** Approximate tokens saved by this compaction */
  tokensSaved: number;
}

// ── LLM Context Layer ─────────────────────────────────────────────

/**
 * LLMMessage — the compacted form sent to the model on each request.
 * Derived from DisplayMessages; never persisted directly.
 */
export interface LLMMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

/**
 * CompactedToolResult — replaces a full tool result when it is old
 * enough to prune. Preserves key metadata without the full payload.
 */
export interface CompactedToolResult {
  type: "compacted-tool-result";
  toolName: string;
  toolCallId: string;
  args: Record<string, unknown>;
  executedAt: number;
  status: "success" | "error";
  /** Original byte size before compaction */
  originalSize: number;
  /** One-line summary e.g. "Searched for 'react hooks' — 15 results" */
  summary: string;
  /** First 200 chars of original result, if no LLM summary available */
  extract?: string;
}

// ── Session State ─────────────────────────────────────────────────

/**
 * SessionCompactionState — persisted to localStorage between reloads.
 */
export interface SessionCompactionState {
  /** The current rolling summary (null = no compaction yet) */
  rollingSummary: string | null;
  /** Timestamp of last compaction (null = never compacted) */
  lastCompactionAt: number | null;
  /** How many times compaction has run this session */
  compactionCount: number;
  /** Cumulative tokens saved across all compactions */
  totalTokensSaved: number;
  /** User-pinned facts that survive all compaction */
  workingMemory: string[];
  /** Current displayMessages count (for diagnostics) */
  displayMessageCount: number;
  /** Current llmMessages count (for diagnostics) */
  llmMessageCount: number;
}

// ── Token Usage ───────────────────────────────────────────────────

/**
 * TokenUsage — live token estimate after each AI response.
 */
export interface TokenUsage {
  /** Estimated tokens currently in LLM context */
  current: number;
  /** Max tokens configured (maxContextTokens) */
  max: number;
  /** current / max (0–1) */
  percentage: number;
  /** True when percentage > compactionThreshold */
  isApproaching: boolean;
}

// ── Events ────────────────────────────────────────────────────────

/**
 * CompactionEvent — fired via onCompaction callback after each compaction.
 */
export interface CompactionEvent {
  /** 'auto' = threshold triggered, 'manual' = compactSession() called */
  type: "auto" | "manual";
  compactionCount: number;
  messagesSummarized: number;
  tokensSaved: number;
  timestamp: number;
}

// ── Strategy ──────────────────────────────────────────────────────

export type CompactionStrategy =
  | "none"
  | "sliding-window"
  | "summary-buffer"
  | "selective-prune";

// ── Config ────────────────────────────────────────────────────────

/**
 * MessageHistoryConfig — passed as messageHistory prop to CopilotProvider
 * or directly to useMessageHistory().
 */
export interface MessageHistoryConfig {
  /**
   * Compaction strategy.
   * @default 'none' — current SDK behaviour, zero breaking changes
   */
  strategy?: CompactionStrategy;
  /**
   * Hard token ceiling for LLM context.
   * @default 128000
   */
  maxContextTokens?: number;
  /**
   * Tokens reserved for the model's reply; subtracted from budget before pruning.
   * @default 4096
   */
  reserveForResponse?: number;
  /**
   * Ratio of maxContextTokens at which auto-compaction fires.
   * @default 0.75
   */
  compactionThreshold?: number;
  /**
   * Minimum messages always kept verbatim (most recent N). Never compacted.
   * @default 10
   */
  recentBuffer?: number;
  /**
   * Hard char truncation cap per tool result before sending. 0 = no cap.
   * @default 10000
   */
  toolResultMaxChars?: number;
  /**
   * Your /api/compact endpoint. Required when strategy is 'summary-buffer'.
   */
  compactionUrl?: string;
  /**
   * Persist display history + compaction state across page reloads.
   * @default false
   */
  persistSession?: boolean;
  /**
   * localStorage/IndexedDB key prefix.
   * @default 'copilot-session'
   */
  storageKey?: string;
  /** Fired after every compaction. */
  onCompaction?: (event: CompactionEvent) => void;
  /** Fired after every message with current token estimate. */
  onTokenUsage?: (usage: TokenUsage) => void;
}

// ── Hook return ───────────────────────────────────────────────────

export interface UseMessageHistoryOptions extends MessageHistoryConfig {
  /** Disable auto-compaction for this component even if provider has it on. */
  skipCompaction?: boolean;
  /** Token estimation precision. @default 'fast' */
  tokenEstimation?: "fast" | "accurate" | "off";
  /** Custom async summarizer. Overrides /api/compact. */
  summarizer?: (messages: LLMMessage[]) => Promise<string>;
}

export interface UseMessageHistoryReturn {
  /** Full immutable UI history. Pass to CopilotChat. */
  displayMessages: DisplayMessage[];
  /** Compacted LLM context. Rebuilt on each render. */
  llmMessages: LLMMessage[];
  /** Live token estimate. Updated after each AI response. */
  tokenUsage: TokenUsage;
  /** Compaction metadata. */
  compactionState: SessionCompactionState;
  /** Manually trigger compaction. Optional instructions guide the summarizer. */
  compactSession: (instructions?: string) => Promise<void>;
  /** Pin a string that survives all future compactions. */
  addToWorkingMemory: (fact: string) => void;
  /** Remove all working memory facts. */
  clearWorkingMemory: () => void;
  /** Clear history, compaction state, and persistence. Fresh start. */
  resetSession: () => void;
}
