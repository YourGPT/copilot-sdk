/**
 * Web Search Module
 *
 * Multi-provider web search with unified API.
 * Supports tree-shaking - only the provider you use gets bundled.
 *
 * @example
 * ```typescript
 * // Option 1: Lazy loading (provider loaded on first use)
 * import { executeWebSearch } from './webSearch';
 * const results = await executeWebSearch(
 *   { query: 'latest AI news' },
 *   { provider: 'tavily', apiKey: 'your-api-key' }
 * );
 *
 * // Option 2: Direct import (best for tree-shaking)
 * import { tavilyProvider, executeWebSearch } from './webSearch';
 * const results = await executeWebSearch(
 *   { query: 'latest AI news' },
 *   { provider: tavilyProvider, apiKey: 'your-api-key' }
 * );
 * ```
 */

import type {
  WebSearchConfig,
  WebSearchParams,
  WebSearchResponse,
  WebSearchProvider,
  WebSearchProviderInterface,
} from "./types";

// ============================================
// Lazy Provider Loading (for tree-shaking)
// ============================================

/**
 * Provider loaders - dynamically import providers only when needed.
 * This ensures unused providers are NOT included in the bundle.
 */
const providerLoaders: Record<
  WebSearchProvider,
  () => Promise<
    { default: WebSearchProviderInterface } | WebSearchProviderInterface
  >
> = {
  openai: () => import("./providers/openai").then((m) => m.openaiProvider),
  google: () => import("./providers/google").then((m) => m.googleProvider),
  anthropic: () =>
    import("./providers/anthropic").then((m) => m.anthropicProvider),
  tavily: () => import("./providers/tavily").then((m) => m.tavilyProvider),
  serper: () => import("./providers/serper").then((m) => m.serperProvider),
  brave: () => import("./providers/brave").then((m) => m.braveProvider),
  searxng: () => import("./providers/searxng").then((m) => m.searxngProvider),
  exa: () => import("./providers/exa").then((m) => m.exaProvider),
};

// Cache for loaded providers
const loadedProviders: Map<WebSearchProvider, WebSearchProviderInterface> =
  new Map();

/**
 * Get a provider by name (lazy loading)
 *
 * @param name - Provider name string
 * @returns Provider interface (loaded dynamically)
 */
export async function getProvider(
  name: WebSearchProvider,
): Promise<WebSearchProviderInterface> {
  // Check cache first
  const cached = loadedProviders.get(name);
  if (cached) {
    return cached;
  }

  // Load provider dynamically
  const loader = providerLoaders[name];
  if (!loader) {
    throw new Error(
      `Unknown search provider: ${name}. ` +
        `Available providers: ${Object.keys(providerLoaders).join(", ")}`,
    );
  }

  const provider = await loader();
  const resolvedProvider = "default" in provider ? provider.default : provider;

  // Cache for future use
  loadedProviders.set(name, resolvedProvider as WebSearchProviderInterface);

  return resolvedProvider as WebSearchProviderInterface;
}

/**
 * Get all available provider names
 */
export function getAvailableProviders(): WebSearchProvider[] {
  return Object.keys(providerLoaders) as WebSearchProvider[];
}

// ============================================
// Extended Config with Direct Provider Support
// ============================================

/**
 * Extended config that allows passing provider directly for tree-shaking
 */
export interface WebSearchConfigExtended extends Omit<
  WebSearchConfig,
  "provider"
> {
  /**
   * Provider can be either:
   * - A string name (lazy loaded): "tavily", "openai", "anthropic", "google", etc.
   * - A provider instance (best for tree-shaking): import { tavilyProvider } from '...'
   */
  provider: WebSearchProvider | WebSearchProviderInterface;
}

/**
 * Check if a value is a provider interface (not a string)
 */
function isProviderInterface(
  provider: WebSearchProvider | WebSearchProviderInterface,
): provider is WebSearchProviderInterface {
  return typeof provider === "object" && "search" in provider;
}

// ============================================
// Execute Search
// ============================================

/**
 * Execute a web search using the configured provider
 *
 * @param params - Search parameters (query, maxResults, searchDepth)
 * @param config - Provider configuration (provider, apiKey, options)
 * @returns Search results with optional AI-generated answer
 *
 * @example
 * ```typescript
 * // Option 1: String provider name (lazy loaded)
 * const results = await executeWebSearch(
 *   { query: 'What is the latest news about SpaceX?' },
 *   {
 *     provider: 'tavily',
 *     apiKey: process.env.TAVILY_API_KEY,
 *   }
 * );
 *
 * // Option 2: Direct provider import (best for tree-shaking)
 * import { tavilyProvider } from '@yourgpt/copilot-sdk/core';
 * const results = await executeWebSearch(
 *   { query: 'What is the latest news about SpaceX?' },
 *   {
 *     provider: tavilyProvider,
 *     apiKey: process.env.TAVILY_API_KEY,
 *   }
 * );
 * ```
 */
export async function executeWebSearch(
  params: WebSearchParams,
  config: WebSearchConfigExtended,
): Promise<WebSearchResponse> {
  // Resolve provider (either from string or direct reference)
  const provider = isProviderInterface(config.provider)
    ? config.provider
    : await getProvider(config.provider);

  // Build config with string provider name for validation
  const providerName: WebSearchProvider = isProviderInterface(config.provider)
    ? ("custom" as WebSearchProvider) // Direct provider
    : config.provider;

  const resolvedConfig: WebSearchConfig = {
    ...config,
    provider: providerName,
  };

  // Validate configuration if provider supports it
  if (provider.validateConfig) {
    provider.validateConfig(resolvedConfig);
  }

  // Execute search
  return provider.search(params, resolvedConfig);
}

// ============================================
// Utility Functions
// ============================================

/**
 * Format search results for display in AI context
 *
 * @param response - Web search response
 * @param options - Formatting options
 * @returns Formatted string for AI consumption
 */
export function formatSearchResultsForAI(
  response: WebSearchResponse,
  options?: {
    includeUrls?: boolean;
    includeScores?: boolean;
    maxContentLength?: number;
  },
): string {
  const {
    includeUrls = true,
    includeScores = false,
    maxContentLength = 200,
  } = options || {};

  const lines: string[] = [];

  // Add answer if available
  if (response.answer) {
    lines.push(`Answer: ${response.answer}`);
    lines.push("");
  }

  // Add results
  lines.push(`Search results for "${response.query}":`);
  lines.push("");

  response.results.forEach((result, index) => {
    const num = index + 1;
    let content = result.content;

    // Truncate content if needed
    if (maxContentLength && content.length > maxContentLength) {
      content = content.slice(0, maxContentLength) + "...";
    }

    lines.push(`${num}. ${result.title}`);
    if (includeUrls) {
      lines.push(`   URL: ${result.url}`);
    }
    lines.push(`   ${content}`);
    if (includeScores && result.score !== undefined) {
      lines.push(`   Relevance: ${(result.score * 100).toFixed(1)}%`);
    }
    lines.push("");
  });

  return lines.join("\n");
}

/**
 * Create a minimal search result summary
 *
 * @param response - Web search response
 * @returns Brief summary string
 */
export function summarizeSearchResults(response: WebSearchResponse): string {
  const count = response.results.length;
  const sources = response.results
    .slice(0, 3)
    .map((r) => r.domain || new URL(r.url).hostname)
    .join(", ");

  let summary = `Found ${count} result${count !== 1 ? "s" : ""}`;
  if (sources) {
    summary += ` from ${sources}`;
  }
  if (response.searchTime) {
    summary += ` (${response.searchTime}ms)`;
  }

  return summary;
}

// ============================================
// Re-exports
// ============================================

// Export types
export * from "./types";

// Export individual providers for direct import (tree-shakeable)
// Users should import these directly for best bundle size:
//   import { tavilyProvider } from '@yourgpt/copilot-sdk/core';
export { openaiProvider } from "./providers/openai";
export { googleProvider } from "./providers/google";
export { anthropicProvider } from "./providers/anthropic";
export { tavilyProvider } from "./providers/tavily";
export { serperProvider } from "./providers/serper";
export { braveProvider } from "./providers/brave";
export { searxngProvider } from "./providers/searxng";
export { exaProvider } from "./providers/exa";
