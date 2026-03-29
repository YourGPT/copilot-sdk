import type {
  LLMAdapter,
  ChatCompletionRequest,
  CompletionResult,
} from "../adapters/base";
import type { StreamEvent } from "../core/stream-events";
import type { FallbackChainConfig, FallbackFailure, RetryInfo } from "./types";
import { FallbackExhaustedError } from "./errors";
import { MemoryRoutingStore } from "./routing-store";

// Stable key used for round-robin state in the store
const ROUND_ROBIN_KEY = "ygpt_fallback_rr_index";

/**
 * Determine whether an error should trigger a retry or fallback.
 *
 * Covers all error shapes across provider SDKs:
 *
 * OpenAI SDK (@openai/openai-node):
 *   RateLimitError          → status=429
 *   InternalServerError     → status>=500
 *   APIConnectionError      → status=undefined, message="Connection error."
 *   APIConnectionTimeoutError → status=undefined, message="Request timed out."
 *   APIUserAbortError       → status=undefined, message="Aborted"  ← NOT retryable
 *   BadRequestError etc     → status=4xx                          ← NOT retryable
 *
 * Anthropic SDK (@anthropic-ai/sdk) — identical class/message shapes to OpenAI SDK.
 *
 * Google SDK & Ollama — fall through to message-based detection.
 *
 * In streaming mode: adapters swallow thrown errors and yield { type:"error", message }.
 * The fallback chain creates `new Error(message)` from those, so only message survives.
 * Message-based detection handles that path.
 *
 * In complete() mode: real SDK class instances are thrown, so constructor.name + status checks fire.
 */
function defaultIsRetryable(error: unknown): boolean {
  if (typeof error === "object" && error !== null) {
    const ctorName = (error as object).constructor?.name ?? "";

    // ── Explicit NOT-retryable classes ────────────────────────────────────
    // User aborted the request — never retry, never fall back
    if (ctorName === "APIUserAbortError") return false;

    // ── Explicit retryable classes (no status property) ───────────────────
    // Both OpenAI and Anthropic SDKs use these exact class names.
    if (ctorName === "APIConnectionError") return true;
    if (ctorName === "APIConnectionTimeoutError") return true;

    // ── HTTP status code check (OpenAI, Anthropic, Google, etc.) ──────────
    // Both SDKs expose the numeric HTTP status on `.status`.
    // `.statusCode` covers some older / third-party adapters.
    const status =
      (error as { status?: unknown }).status ??
      (error as { statusCode?: unknown }).statusCode;

    if (typeof status === "number") {
      if (status === 429) return true; // rate limit
      if (status >= 500) return true; // 500, 502, 503, 504, 520-527 (Cloudflare), etc.
      if (status >= 400) return false; // 400-428, 430-499 — caller bug, don't retry
    }
  }

  // ── Message-based detection ───────────────────────────────────────────────
  // Used when errors have been serialised to plain Error objects:
  //   • stream mode — adapters yield { type:"error", message } instead of throwing
  //   • Google SDK / Ollama — don't use OpenAI/Anthropic SDK class names
  if (error instanceof Error) {
    const msg = error.message;

    // Hard-stop: user-initiated abort.
    // Node.js AbortController: "The operation was aborted"
    // Browser fetch AbortController: "The user aborted a request"
    // These must never trigger a retry or fallback.
    if (/the operation was aborted/i.test(msg)) return false;
    if (/the user aborted a request/i.test(msg)) return false;

    // Hard-stop: any 4xx that is NOT 429.
    // e.g. "401 Incorrect API key", "403 Forbidden", "404 Not found"
    if (/\b4[0-9]{2}\b/.test(msg) && !/\b429\b/.test(msg)) return false;

    // ── Retryable: rate limit ──────────────────────────────────────────────
    // OpenAI stream error event: "429 You exceeded your current quota…"
    // Anthropic stream error event: "429 {"error":{"type":"rate_limit_error"…}}"
    if (/\b429\b/.test(msg)) return true;
    if (/rate[\s_-]?limit/i.test(msg)) return true;
    if (/too many requests/i.test(msg)) return true;
    if (/quota exceeded/i.test(msg)) return true; // Google

    // ── Retryable: 5xx server errors ──────────────────────────────────────
    if (/\b5[0-9]{2}\b/.test(msg)) return true; // any 5xx in message
    if (/internal server error/i.test(msg)) return true;
    if (/service unavailable/i.test(msg)) return true;
    if (/bad gateway/i.test(msg)) return true;
    if (/gateway timeout/i.test(msg)) return true;
    if (/overloaded/i.test(msg)) return true; // Anthropic "overloaded_error"

    // ── Retryable: connection / timeout ───────────────────────────────────
    // OpenAI SDK APIConnectionError exact message:
    if (/^connection error\.?$/i.test(msg)) return true;
    // OpenAI SDK APIConnectionTimeoutError exact message:
    if (/^request timed out\.?$/i.test(msg)) return true;
    // General timeout patterns (Google SDK, Ollama, custom adapters)
    if (/timed?\s*out/i.test(msg)) return true;
    if (/timeout/i.test(msg)) return true;
    // fetch() failure (browser + Node.js undici)
    if (/fetch failed/i.test(msg)) return true;

    // ── Retryable: Node.js network error codes ────────────────────────────
    // These appear in the message when a raw network error bubbles up.
    if (/ECONNREFUSED/.test(msg)) return true; // connection refused
    if (/ECONNRESET/.test(msg)) return true; // connection reset by peer
    if (/ETIMEDOUT/.test(msg)) return true; // TCP timeout
    if (/ENOTFOUND/.test(msg)) return true; // DNS lookup failure
    if (/ENETUNREACH/.test(msg)) return true; // no route to host
    if (/EHOSTUNREACH/.test(msg)) return true; // host unreachable
  }

  return false;
}

/** Calculate delay for a given retry attempt */
function calcDelay(
  base: number,
  attempt: number,
  backoff: "exponential" | "fixed",
): number {
  if (backoff === "fixed") return base;
  return base * Math.pow(2, attempt - 1); // exponential: base, base*2, base*4...
}

/** Sleep helper */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Internal resolved config type ───────────────────────────────────────────

type ResolvedConfig = Required<
  Omit<FallbackChainConfig, "onFallback" | "onRetry" | "retryableErrors">
> &
  Pick<FallbackChainConfig, "onFallback" | "onRetry" | "retryableErrors">;

// ─── FallbackChain ────────────────────────────────────────────────────────────

class FallbackChain implements LLMAdapter {
  private readonly _config: ResolvedConfig;

  constructor(config: FallbackChainConfig) {
    if (config.models.length === 0) {
      throw new Error("FallbackChain requires at least one model.");
    }

    this._config = {
      models: config.models,
      strategy: config.strategy ?? "priority",
      store: config.store ?? new MemoryRoutingStore(),
      retries: config.retries ?? 0,
      retryDelay: config.retryDelay ?? 500,
      retryBackoff: config.retryBackoff ?? "exponential",
      onFallback: config.onFallback,
      onRetry: config.onRetry,
      retryableErrors: config.retryableErrors,
    };
  }

  get provider(): string {
    return "fallback-chain";
  }

  get model(): string {
    return this._config.models.map((m) => `${m.provider}/${m.model}`).join(",");
  }

  private async _startIndex(): Promise<number> {
    if (this._config.strategy !== "round-robin") return 0;
    const stored = await this._config.store.get(ROUND_ROBIN_KEY);
    return typeof stored === "number" ? stored % this._config.models.length : 0;
  }

  private async _advanceIndex(successfulIndex: number): Promise<void> {
    if (this._config.strategy !== "round-robin") return;
    const next = (successfulIndex + 1) % this._config.models.length;
    await this._config.store.set(ROUND_ROBIN_KEY, next);
  }

  private _isRetryable(error: unknown): boolean {
    return this._config.retryableErrors
      ? this._config.retryableErrors(error)
      : defaultIsRetryable(error);
  }

  /**
   * Try streaming from a single adapter, with per-model retries.
   *
   * Returns an async generator that either:
   *   - yields all chunks on success, then returns
   *   - throws the final error if all retries exhausted or error is non-retryable
   *
   * The `retriesAttempted` out-param is filled via the returned object so callers
   * can record it in FallbackFailure.
   */
  private async *_streamWithRetries(
    adapter: LLMAdapter,
    request: ChatCompletionRequest,
    out: { retriesAttempted: number },
  ): AsyncGenerator<StreamEvent> {
    const { retries, retryDelay, retryBackoff, onRetry } = this._config;
    const maxAttempts = retries + 1; // initial attempt + retries

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      let contentStarted = false;
      let failureError: Error | null = null;

      try {
        for await (const chunk of adapter.stream(request)) {
          if (chunk.type === "error") {
            if (!contentStarted) {
              const msg =
                (chunk as { type: "error"; message?: string }).message ??
                "Unknown error";
              failureError = new Error(msg);
              break;
            }
            yield chunk;
            return;
          }

          if (chunk.type === "message:start") continue;

          contentStarted = true;
          yield chunk;
        }
      } catch (error) {
        if (contentStarted) throw error;
        if (!this._isRetryable(error)) throw error;
        failureError =
          error instanceof Error ? error : new Error(String(error));
      }

      if (failureError === null) return; // success

      // Non-retryable (4xx) — checked in catch above, but also check error-event path
      if (!this._isRetryable(failureError)) throw failureError;

      out.retriesAttempted = attempt - 1; // attempts so far beyond initial

      // If we have more retries left, wait then retry the same model
      if (attempt < maxAttempts) {
        const delayMs = calcDelay(retryDelay, attempt, retryBackoff);
        const retryInfo: RetryInfo = {
          model: adapter.model,
          provider: adapter.provider,
          error: failureError,
          retryAttempt: attempt,
          maxRetries: retries,
          delayMs,
        };
        onRetry?.(retryInfo);
        await sleep(delayMs);
        continue;
      }

      // All retries for this model exhausted — throw so the outer loop can try next model
      out.retriesAttempted = retries;
      throw failureError;
    }
  }

  async *stream(request: ChatCompletionRequest): AsyncGenerator<StreamEvent> {
    const { models, onFallback } = this._config;
    const startIndex = await this._startIndex();
    const failures: FallbackFailure[] = [];

    for (let i = 0; i < models.length; i++) {
      const index = (startIndex + i) % models.length;
      const adapter = models[index];
      const out = { retriesAttempted: 0 };

      try {
        yield* this._streamWithRetries(adapter, request, out);
        // Success
        await this._advanceIndex(index);
        return;
      } catch (error) {
        // Non-retryable (4xx) — rethrow immediately, don't try next model
        if (!this._isRetryable(error)) throw error;

        const failure: FallbackFailure = {
          model: adapter.model,
          provider: adapter.provider,
          error: error instanceof Error ? error : new Error(String(error)),
          attempt: i + 1,
          retriesAttempted: out.retriesAttempted,
        };
        failures.push(failure);

        const nextOffset = i + 1;
        if (nextOffset < models.length && onFallback) {
          const nextIndex = (startIndex + nextOffset) % models.length;
          onFallback({
            attemptedModel: adapter.model,
            nextModel: models[nextIndex].model,
            error: failure.error,
            attempt: failure.attempt,
          });
        }
      }
    }

    throw new FallbackExhaustedError(failures);
  }

  async complete(request: ChatCompletionRequest): Promise<CompletionResult> {
    const { models, onFallback, retries, retryDelay, retryBackoff, onRetry } =
      this._config;
    const startIndex = await this._startIndex();
    const failures: FallbackFailure[] = [];

    for (let i = 0; i < models.length; i++) {
      const index = (startIndex + i) % models.length;
      const adapter = models[index];

      if (!adapter.complete) {
        failures.push({
          model: adapter.model,
          provider: adapter.provider,
          error: new Error(
            `Adapter ${adapter.provider}/${adapter.model} does not implement complete()`,
          ),
          attempt: i + 1,
          retriesAttempted: 0,
        });
        continue;
      }

      const maxAttempts = retries + 1;
      let lastError: Error | null = null;
      let retriesAttempted = 0;

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          const result = await adapter.complete(request);
          await this._advanceIndex(index);
          return result;
        } catch (error) {
          if (!this._isRetryable(error)) throw error;

          lastError = error instanceof Error ? error : new Error(String(error));
          retriesAttempted = attempt - 1;

          if (attempt < maxAttempts) {
            const delayMs = calcDelay(retryDelay, attempt, retryBackoff);
            onRetry?.({
              model: adapter.model,
              provider: adapter.provider,
              error: lastError,
              retryAttempt: attempt,
              maxRetries: retries,
              delayMs,
            });
            await sleep(delayMs);
          }
        }
      }

      const failure: FallbackFailure = {
        model: adapter.model,
        provider: adapter.provider,
        error: lastError!,
        attempt: i + 1,
        retriesAttempted,
      };
      failures.push(failure);

      const nextOffset = i + 1;
      if (nextOffset < models.length && onFallback) {
        const nextIndex = (startIndex + nextOffset) % models.length;
        onFallback({
          attemptedModel: adapter.model,
          nextModel: models[nextIndex].model,
          error: failure.error,
          attempt: failure.attempt,
        });
      }
    }

    throw new FallbackExhaustedError(failures);
  }
}

/**
 * Create a fallback chain that tries each model in order, with optional
 * per-model retries before moving to the next model.
 *
 * @example
 * ```typescript
 * import { createFallbackChain } from '@yourgpt/llm-sdk/fallback';
 * import { createRuntime } from '@yourgpt/llm-sdk';
 * import { createOpenAI } from '@yourgpt/llm-sdk/openai';
 * import { createAnthropic } from '@yourgpt/llm-sdk/anthropic';
 *
 * const chain = createFallbackChain({
 *   models: [
 *     createOpenAI({ apiKey: '...' }).languageModel('gpt-5.4'),
 *     createAnthropic({ apiKey: '...' }).languageModel('claude-haiku-4-5'),
 *   ],
 *   retries: 2,              // retry each model up to 2 times before moving on
 *   retryDelay: 500,         // 500ms → 1000ms (exponential)
 *   retryBackoff: 'exponential',
 *   strategy: 'round-robin',
 *   onRetry: ({ model, retryAttempt, maxRetries, delayMs, error }) => {
 *     console.warn(`[retry] ${model} attempt ${retryAttempt}/${maxRetries} — waiting ${delayMs}ms`);
 *   },
 *   onFallback: ({ attemptedModel, nextModel, attempt }) => {
 *     console.warn(`[fallback] ${attemptedModel} gave up after retries → ${nextModel}`);
 *   },
 * });
 *
 * const runtime = createRuntime({ adapter: chain });
 * ```
 */
export function createFallbackChain(config: FallbackChainConfig): LLMAdapter {
  return new FallbackChain(config);
}
