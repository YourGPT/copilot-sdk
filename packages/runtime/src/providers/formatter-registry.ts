/**
 * Provider Formatter Registry
 *
 * Maps provider names to their formatters for the agent loop.
 * Formatters handle tool transformations between unified format and provider-specific formats.
 */

import type { ProviderFormatter } from "./types";
import { openaiFormatter } from "./openai";
import { anthropicFormatter } from "./anthropic";
import { geminiFormatter } from "./gemini";

// ============================================
// Formatter Registry
// ============================================

/**
 * Map of provider names to their formatters
 */
const formatters: Record<string, ProviderFormatter> = {
  openai: openaiFormatter,
  anthropic: anthropicFormatter,
  google: geminiFormatter,
  gemini: geminiFormatter, // Alias
  // OpenAI-compatible providers use openaiFormatter
  groq: openaiFormatter,
  ollama: openaiFormatter,
  xai: openaiFormatter,
  azure: openaiFormatter,
};

/**
 * Get a formatter for a specific provider
 *
 * @param provider - Provider name (e.g., 'openai', 'anthropic', 'google')
 * @returns The provider's formatter
 * @throws Error if provider is not supported
 *
 * @example
 * ```typescript
 * const formatter = getFormatter('openai');
 * const tools = formatter.transformTools(unifiedTools);
 * ```
 */
export function getFormatter(provider: string): ProviderFormatter {
  const formatter = formatters[provider.toLowerCase()];
  if (!formatter) {
    throw new Error(
      `Unsupported provider: ${provider}. Supported providers: ${Object.keys(formatters).join(", ")}`,
    );
  }
  return formatter;
}

/**
 * Check if a provider is supported
 *
 * @param provider - Provider name to check
 * @returns True if provider has a formatter
 *
 * @example
 * ```typescript
 * if (isProviderSupported('openai')) {
 *   // Use the provider
 * }
 * ```
 */
export function isProviderSupported(provider: string): boolean {
  return provider.toLowerCase() in formatters;
}

/**
 * Get list of supported providers
 *
 * @returns Array of supported provider names
 *
 * @example
 * ```typescript
 * const providers = getSupportedProviders();
 * // ['openai', 'anthropic', 'google', ...]
 * ```
 */
export function getSupportedProviders(): string[] {
  return Object.keys(formatters);
}

/**
 * Register a custom formatter for a provider
 *
 * @param provider - Provider name
 * @param formatter - Formatter implementation
 *
 * @example
 * ```typescript
 * registerFormatter('custom-provider', myCustomFormatter);
 * ```
 */
export function registerFormatter(
  provider: string,
  formatter: ProviderFormatter,
): void {
  formatters[provider.toLowerCase()] = formatter;
}
