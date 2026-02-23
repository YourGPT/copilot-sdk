/**
 * SearXNG Search Tool
 *
 * Tree-shakeable import for SearXNG web search provider.
 * Only imports SearXNG code - no other providers bundled.
 *
 * @example
 * ```typescript
 * import { searxngSearch } from '@yourgpt/copilot-sdk/tools/searxng';
 *
 * const webSearch = searxngSearch({
 *   baseUrl: 'https://your-searxng-instance.com',
 * });
 *
 * const runtime = createRuntime({
 *   tools: [webSearch],
 * });
 * ```
 *
 * @see https://docs.searxng.org/
 * @module @yourgpt/copilot-sdk/tools/searxng
 */

import type { ToolDefinition } from "../../core/types/tools";
import { failure } from "../../core/types/tools";
import {
  searchSearxng,
  searxngProvider,
} from "../../core/tools/webSearch/providers/searxng";
import {
  formatSearchResultsForAI,
  summarizeSearchResults,
} from "../../core/tools/webSearch";
import type { WebSearchResponse } from "../../core/tools/webSearch/types";

// Re-export provider for direct access
export { searxngProvider };

/**
 * SearXNG search configuration
 */
export interface SearxngSearchConfig {
  /** Base URL of your SearXNG instance (e.g., 'https://searx.example.com') */
  baseUrl: string;
  /** Optional API key if your instance requires authentication */
  apiKey?: string;
  /** Maximum number of results (default: 5) */
  maxResults?: number;
  /** Language code for results (e.g., 'en', 'es', 'fr') */
  language?: string;
  /** Only include results from these domains */
  includeDomains?: string[];
  /** Exclude results from these domains */
  excludeDomains?: string[];
  /** Request timeout in milliseconds */
  timeout?: number;
}

/**
 * Search parameters passed to the tool
 */
interface SearxngSearchParams {
  /** The search query */
  query: string;
  /** Maximum number of results (overrides config) */
  maxResults?: number;
}

/**
 * Create a SearXNG web search tool
 *
 * SearXNG is a privacy-respecting, self-hostable metasearch engine.
 * It aggregates results from multiple search engines without tracking.
 *
 * @param config - SearXNG configuration including instance URL
 * @returns A configured tool definition ready to use
 *
 * @example
 * ```typescript
 * import { searxngSearch } from '@yourgpt/copilot-sdk/tools/searxng';
 *
 * // Basic usage with self-hosted instance
 * const webSearch = searxngSearch({
 *   baseUrl: 'https://your-searxng-instance.com',
 * });
 *
 * // With authentication
 * const webSearch = searxngSearch({
 *   baseUrl: 'https://your-searxng-instance.com',
 *   apiKey: process.env.SEARXNG_API_KEY,
 *   language: 'en',
 *   maxResults: 10,
 * });
 *
 * const runtime = createRuntime({
 *   provider: openai,
 *   model: 'gpt-4o',
 *   tools: [webSearch],
 * });
 * ```
 */
export function searxngSearch(
  config: SearxngSearchConfig,
): ToolDefinition<SearxngSearchParams> {
  return {
    name: "web_search",
    description: `Search the web using SearXNG for current information. Use this when the user asks about:
- Recent events, news, or current affairs
- Real-time data (prices, weather, stocks, sports scores)
- Information that might have changed after your training cutoff
- Facts that need verification with current sources
- Research topics that require up-to-date information`,

    location: "server",

    title: (args) => `Searching for "${args.query}"`,
    executingTitle: (args) => `Searching the web for "${args.query}"...`,
    completedTitle: (args) => `Found results for "${args.query}"`,

    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The search query to find relevant information",
        },
        maxResults: {
          type: "number",
          description:
            "Maximum number of results to return (default: 5, max: 10)",
          minimum: 1,
          maximum: 10,
        },
      },
      required: ["query"],
    },

    needsApproval: false,
    aiResponseMode: "full",

    handler: async (params) => {
      try {
        const response: WebSearchResponse = await searchSearxng(
          {
            query: params.query,
            maxResults: params.maxResults ?? config.maxResults ?? 5,
          },
          {
            provider: "searxng",
            baseUrl: config.baseUrl,
            apiKey: config.apiKey,
            language: config.language,
            includeDomains: config.includeDomains,
            excludeDomains: config.excludeDomains,
            timeout: config.timeout,
          },
        );

        const aiContext = formatSearchResultsForAI(response);

        return {
          success: true,
          message: summarizeSearchResults(response),
          data: response,
          _aiContext: aiContext,
        };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Web search failed";
        return failure(errorMessage);
      }
    },
  };
}
