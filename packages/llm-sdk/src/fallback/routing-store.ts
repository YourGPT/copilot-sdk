import type { RoutingStore } from "./types";

/**
 * Built-in in-memory routing store.
 *
 * Works out of the box for single-process applications.
 * State resets on restart and is NOT shared across instances.
 *
 * For production multi-instance or serverless deployments,
 * implement your own RoutingStore backed by Redis, Upstash,
 * Cloudflare KV, DynamoDB, or any other persistent store.
 *
 * @example
 * ```typescript
 * // Default — created automatically by createFallbackChain
 * const chain = createFallbackChain({ models: [...] });
 *
 * // Explicit — pass your own store
 * const chain = createFallbackChain({
 *   models: [...],
 *   strategy: 'round-robin',
 *   store: new MemoryRoutingStore(),
 * });
 * ```
 */
export class MemoryRoutingStore implements RoutingStore {
  private readonly _map = new Map<string, number>();

  async get(key: string): Promise<number | undefined> {
    return this._map.get(key);
  }

  async set(key: string, value: number): Promise<void> {
    this._map.set(key, value);
  }
}
