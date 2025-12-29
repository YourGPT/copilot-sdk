/**
 * Provider Registry
 *
 * Central registry for AI providers.
 * Allows dynamic registration and lookup of providers.
 */

import type { AIProvider, ProviderCapabilities } from "./types";

// ============================================
// Registry
// ============================================

/**
 * Registry of provider factory functions
 * Key: provider name (e.g., 'openai')
 * Value: factory function that creates the provider
 */
const providerFactories = new Map<
  string,
  (config?: Record<string, unknown>) => AIProvider
>();

/**
 * Register a provider factory
 *
 * @param name Provider name (e.g., 'openai')
 * @param factory Factory function that creates the provider
 *
 * @example
 * ```typescript
 * registerProvider('openai', (config) => createOpenAI(config));
 * ```
 */
export function registerProvider(
  name: string,
  factory: (config?: Record<string, unknown>) => AIProvider,
): void {
  providerFactories.set(name, factory);
}

/**
 * Get a provider by name
 *
 * @param name Provider name
 * @param config Optional configuration
 * @returns Provider instance or undefined if not found
 *
 * @example
 * ```typescript
 * const openai = getProvider('openai', { apiKey: '...' });
 * ```
 */
export function getProvider(
  name: string,
  config?: Record<string, unknown>,
): AIProvider | undefined {
  const factory = providerFactories.get(name);
  if (!factory) {
    return undefined;
  }
  return factory(config);
}

/**
 * Check if a provider is registered
 */
export function hasProvider(name: string): boolean {
  return providerFactories.has(name);
}

/**
 * List all registered provider names
 */
export function listProviders(): string[] {
  return Array.from(providerFactories.keys());
}

/**
 * Unregister a provider (useful for testing)
 */
export function unregisterProvider(name: string): boolean {
  return providerFactories.delete(name);
}

/**
 * Clear all registered providers (useful for testing)
 */
export function clearProviders(): void {
  providerFactories.clear();
}

// ============================================
// Provider Info
// ============================================

/**
 * Get all available providers with their models
 * Useful for building UI model selectors
 */
export function getAvailableProviders(): Array<{
  name: string;
  models: string[];
}> {
  const result: Array<{ name: string; models: string[] }> = [];

  for (const [name, factory] of providerFactories) {
    try {
      const provider = factory();
      result.push({
        name,
        models: provider.supportedModels,
      });
    } catch {
      // Skip providers that fail to initialize (e.g., missing API key)
      result.push({
        name,
        models: [],
      });
    }
  }

  return result;
}

/**
 * Get capabilities for a specific provider and model
 */
export function getModelCapabilities(
  providerName: string,
  modelId: string,
): ProviderCapabilities | undefined {
  const provider = getProvider(providerName);
  if (!provider) {
    return undefined;
  }
  return provider.getCapabilities(modelId);
}
