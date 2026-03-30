import type { FallbackFailure } from "./types";

/**
 * Thrown when every model in the fallback chain has failed.
 *
 * The `failures` array provides a per-model breakdown of what failed
 * and why, so you can log or surface the full picture.
 *
 * @example
 * ```typescript
 * import { FallbackExhaustedError } from '@yourgpt/llm-sdk/fallback';
 *
 * try {
 *   const result = await runtime.chat(request);
 * } catch (err) {
 *   if (err instanceof FallbackExhaustedError) {
 *     for (const f of err.failures) {
 *       console.error(`${f.provider}/${f.model} (attempt ${f.attempt}): ${f.error.message}`);
 *     }
 *   }
 * }
 * ```
 */
export class FallbackExhaustedError extends Error {
  /** Per-model breakdown of every failed attempt */
  readonly failures: FallbackFailure[];

  constructor(failures: FallbackFailure[]) {
    const summary = failures
      .map((f) => `${f.provider}/${f.model}: ${f.error.message}`)
      .join("; ");

    super(
      `All ${failures.length} model(s) in the fallback chain failed. ${summary}`,
    );

    this.name = "FallbackExhaustedError";
    this.failures = failures;

    // Preserve prototype chain in transpiled environments
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
