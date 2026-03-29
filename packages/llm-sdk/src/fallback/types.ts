/**
 * Fallback Chain & Routing Strategy Types
 */

import type { LLMAdapter } from "../adapters/base";

// ============================================
// Routing Store Interface
// ============================================

/**
 * Pluggable state store for routing strategies.
 *
 * Round-robin and other stateful strategies use this to persist
 * which model was last used. The default implementation is in-memory.
 *
 * For multi-instance or serverless deployments, plug in your own:
 * Redis, Upstash, Cloudflare KV, DynamoDB, etc.
 *
 * @example
 * ```typescript
 * // Redis-backed store (example — bring your own client)
 * const redisStore: RoutingStore = {
 *   async get(key) {
 *     const val = await redis.get(key);
 *     return val ? Number(val) : undefined;
 *   },
 *   async set(key, value) {
 *     await redis.set(key, value);
 *   },
 * };
 * ```
 */
export interface RoutingStore {
  /** Get the stored value for a key */
  get(key: string): Promise<number | undefined>;
  /** Set the stored value for a key */
  set(key: string, value: number): Promise<void>;
}

// ============================================
// Failure & Callback Types
// ============================================

/**
 * A single failed model in the fallback chain (after all retries exhausted)
 */
export interface FallbackFailure {
  /** Model ID that failed */
  model: string;
  /** Provider name */
  provider: string;
  /** The last error from this model */
  error: Error;
  /** Which model in the chain this was (1-based) */
  attempt: number;
  /** How many times this model was retried before giving up */
  retriesAttempted: number;
}

/**
 * Passed to the onFallback callback when a model is abandoned and the next one is tried
 */
export interface FallbackInfo {
  /** Model that just failed (after all its retries) */
  attemptedModel: string;
  /** Model that will be tried next */
  nextModel: string;
  /** The last error from the failed model */
  error: Error;
  /** Which model in the chain this was (1-based) */
  attempt: number;
}

/**
 * Passed to the onRetry callback on each per-model retry attempt
 */
export interface RetryInfo {
  /** Model being retried */
  model: string;
  /** Provider name */
  provider: string;
  /** The error that triggered this retry */
  error: Error;
  /** Which retry attempt this is (1-based: 1 = first retry after initial failure) */
  retryAttempt: number;
  /** Total retries configured for this chain */
  maxRetries: number;
  /** How long (ms) we will wait before retrying */
  delayMs: number;
}

// ============================================
// Strategy & Config
// ============================================

/**
 * How the chain decides which model to try first.
 *
 * - `priority` — always try models in defined order (default)
 * - `round-robin` — rotate starting model evenly across calls
 */
export type RoutingStrategy = "priority" | "round-robin";

/**
 * Backoff strategy between per-model retries.
 *
 * - `exponential` — delay doubles on each retry: 500ms → 1000ms → 2000ms (default)
 * - `fixed`       — same delay every retry: 500ms → 500ms → 500ms
 */
export type RetryBackoff = "exponential" | "fixed";

/**
 * Configuration for createFallbackChain()
 */
export interface FallbackChainConfig {
  /**
   * Ordered list of adapters to try.
   * On failure, the chain moves to the next adapter in this list.
   *
   * @example
   * ```typescript
   * import { createOpenAI } from '@yourgpt/llm-sdk/openai';
   * import { createAnthropic } from '@yourgpt/llm-sdk/anthropic';
   *
   * const openai = createOpenAI({ apiKey: '...' });
   * const anthropic = createAnthropic({ apiKey: '...' });
   *
   * const chain = createFallbackChain({
   *   models: [
   *     openai.languageModel('gpt-4o'),
   *     anthropic.languageModel('claude-3-5-sonnet-20241022'),
   *   ],
   * });
   * ```
   */
  models: LLMAdapter[];

  /**
   * Routing strategy controlling which model is tried first.
   * @default 'priority'
   */
  strategy?: RoutingStrategy;

  /**
   * State store for strategies that require persistence (e.g., round-robin).
   * Defaults to an in-memory store (MemoryRoutingStore).
   *
   * Replace with a shared store (Redis, Upstash, etc.) for multi-instance
   * or serverless deployments where round-robin state must be shared.
   */
  store?: RoutingStore;

  /**
   * Number of times to retry the same model before moving to the next one.
   *
   * LiteLLM equivalent: `num_retries`
   *
   * @default 0  (no retries — fail immediately and move to next model)
   *
   * @example
   * ```typescript
   * // Try each model up to 3 times before falling back
   * createFallbackChain({ models: [...], retries: 3 })
   * ```
   */
  retries?: number;

  /**
   * Base delay in milliseconds between per-model retries.
   *
   * With `retryBackoff: 'exponential'` (default):
   *   retry 1 → retryDelay ms
   *   retry 2 → retryDelay * 2 ms
   *   retry 3 → retryDelay * 4 ms
   *
   * With `retryBackoff: 'fixed'`:
   *   every retry → retryDelay ms
   *
   * @default 500
   */
  retryDelay?: number;

  /**
   * Backoff strategy between per-model retries.
   * @default 'exponential'
   */
  retryBackoff?: RetryBackoff;

  /**
   * Called on each per-model retry attempt (before the delay).
   * Use for logging, metrics, or alerting per retry.
   *
   * @example
   * ```typescript
   * onRetry: ({ model, retryAttempt, maxRetries, delayMs, error }) => {
   *   console.warn(`[retry] ${model} attempt ${retryAttempt}/${maxRetries} — waiting ${delayMs}ms | ${error.message}`);
   * }
   * ```
   */
  onRetry?: (info: RetryInfo) => void;

  /**
   * Called each time a model is abandoned and the next one is tried.
   * Use for logging, metrics, or alerting.
   *
   * @example
   * ```typescript
   * onFallback: ({ attemptedModel, nextModel, error, attempt }) => {
   *   console.warn(`[fallback] attempt ${attempt}: ${attemptedModel} failed → ${nextModel}`, error.message);
   * }
   * ```
   */
  onFallback?: (info: FallbackInfo) => void;

  /**
   * Custom predicate to decide whether an error should trigger a fallback.
   *
   * By default, the following trigger fallback:
   * - HTTP 5xx server errors
   * - HTTP 429 rate limit errors
   * - Network timeouts and connection failures
   *
   * The following do NOT trigger fallback by default:
   * - HTTP 4xx client errors (bad request, invalid API key, etc.)
   *
   * Override this to extend or restrict fallback behavior.
   *
   * @example
   * ```typescript
   * // Also fall back on any error
   * retryableErrors: () => true,
   * ```
   */
  retryableErrors?: (error: unknown) => boolean;
}
