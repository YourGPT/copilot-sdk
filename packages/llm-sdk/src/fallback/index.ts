/**
 * @yourgpt/llm-sdk/fallback
 *
 * Fallback Chain & Routing Strategies
 *
 * Automatically retries failed LLM requests with backup models.
 * Supports priority (default) and round-robin routing strategies.
 *
 * @example
 * ```typescript
 * import { createFallbackChain, MemoryRoutingStore } from '@yourgpt/llm-sdk/fallback';
 * import { createRuntime } from '@yourgpt/llm-sdk';
 * import { createOpenAI } from '@yourgpt/llm-sdk/openai';
 * import { createAnthropic } from '@yourgpt/llm-sdk/anthropic';
 *
 * const chain = createFallbackChain({
 *   models: [
 *     createOpenAI({ apiKey: '...' }).languageModel('gpt-4o'),
 *     createAnthropic({ apiKey: '...' }).languageModel('claude-3-5-sonnet-20241022'),
 *   ],
 *   strategy: 'round-robin',
 *   onFallback: ({ attemptedModel, nextModel, error, attempt }) => {
 *     console.warn(`Attempt ${attempt}: ${attemptedModel} failed, trying ${nextModel}`);
 *   },
 * });
 *
 * const runtime = createRuntime({ adapter: chain });
 * ```
 */

export { createFallbackChain } from "./chain";
export { FallbackExhaustedError } from "./errors";
export { MemoryRoutingStore } from "./routing-store";

export type {
  RoutingStore,
  RoutingStrategy,
  RetryBackoff,
  FallbackChainConfig,
  FallbackFailure,
  FallbackInfo,
  RetryInfo,
} from "./types";
