/**
 * Resolvable - Type utility for values that can be static or dynamic
 *
 * This pattern allows SDK consumers to pass either:
 * - Static value: `headers: { "x-api-key": "abc123" }`
 * - Getter function: `headers: () => ({ "x-api-key": getToken() })`
 *
 * Values are resolved at request time, ensuring fresh data on every API call.
 * This is the modern pattern used by tanstack-query, tRPC, and axios interceptors.
 *
 * @example
 * ```tsx
 * // Static (for values that never change)
 * <CopilotProvider headers={{ "x-api-key": "static-key" }} />
 *
 * // Dynamic (for values that change at runtime)
 * <CopilotProvider
 *   headers={() => ({
 *     Authorization: `Bearer ${getToken()}`,
 *     ...getCustomHeaders(),
 *   })}
 * />
 * ```
 */

/**
 * A value that can be either static or a getter function
 * Getter can be sync or async for flexibility
 */
export type Resolvable<T> = T | (() => T) | (() => Promise<T>);

/**
 * Check if a value is a getter function
 */
export function isGetter<T>(
  value: Resolvable<T>,
): value is (() => T) | (() => Promise<T>) {
  return typeof value === "function";
}

/**
 * Resolve a potentially dynamic value
 * Handles: static value, sync getter, or async getter
 * Optimized: skips async overhead for static values
 */
export async function resolveValue<T>(value: Resolvable<T>): Promise<T> {
  if (!isGetter(value)) {
    return value;
  }
  try {
    return await value();
  } catch (error) {
    console.error("[Copilot SDK] Error resolving dynamic config value:", error);
    throw error;
  }
}

/**
 * Resolve multiple values in parallel
 * Optimized: only uses Promise.all if there are actual getters
 */
export async function resolveValues<
  T extends Record<string, Resolvable<unknown>>,
>(
  values: T,
): Promise<{ [K in keyof T]: T[K] extends Resolvable<infer U> ? U : T[K] }> {
  const entries = Object.entries(values);
  const hasGetters = entries.some(([, v]) => isGetter(v));

  if (!hasGetters) {
    // Fast path: no getters, return as-is
    return values as {
      [K in keyof T]: T[K] extends Resolvable<infer U> ? U : T[K];
    };
  }

  // Resolve all values in parallel
  const resolved = await Promise.all(
    entries.map(async ([key, val]) => [key, await resolveValue(val)]),
  );

  return Object.fromEntries(resolved) as {
    [K in keyof T]: T[K] extends Resolvable<infer U> ? U : T[K];
  };
}

/**
 * Resolve a potentially dynamic value (sync only)
 * Use when you know the getter is synchronous
 */
export function resolveValueSync<T>(value: T | (() => T)): T {
  if (typeof value === "function") {
    return (value as () => T)();
  }
  return value;
}

/**
 * Type to extract the resolved type from a Resolvable
 */
export type ResolvedType<T> = T extends Resolvable<infer U> ? U : T;
