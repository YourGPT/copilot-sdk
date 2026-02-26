/**
 * Brave Search Tool
 *
 * Tree-shakeable import for Brave web search provider.
 * Only imports Brave code - no other providers bundled.
 *
 * @example
 * ```typescript
 * import { braveSearch } from '@yourgpt/copilot-sdk/tools/brave';
 *
 * const webSearch = braveSearch({
 *   apiKey: process.env.BRAVE_API_KEY,
 * });
 *
 * const runtime = createRuntime({
 *   tools: [webSearch],
 * });
 * ```
 *
 * @see https://brave.com/search/api/
 * @module @yourgpt/copilot-sdk/tools/brave
 */

import type { ToolDefinition } from "../../core/types/tools";
import { failure } from "../../core/types/tools";
import {
  searchBrave,
  braveProvider,
} from "../../core/tools/webSearch/providers/brave";
import {
  formatSearchResultsForAI,
  summarizeSearchResults,
} from "../../core/tools/webSearch";
import type { WebSearchResponse } from "../../core/tools/webSearch/types";

// Re-export provider for direct access
export { braveProvider };

/**
 * Brave search configuration
 */
export interface BraveSearchConfig {
  /** Brave Search API key - get one at https://brave.com/search/api/ */
  apiKey: string;
  /** Maximum number of results (default: 5) */
  maxResults?: number;
  /** Country code for localized results (e.g., 'us', 'gb', 'de') */
  country?: string;
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
interface BraveSearchParams {
  /** The search query */
  query: string;
  /** Maximum number of results (overrides config) */
  maxResults?: number;
}

/**
 * Create a Brave web search tool
 *
 * Brave Search is a privacy-focused search engine with its own index.
 * Provides independent search results without tracking.
 *
 * @param config - Brave configuration including API key
 * @returns A configured tool definition ready to use
 *
 * @example
 * ```typescript
 * import { braveSearch } from '@yourgpt/copilot-sdk/tools/brave';
 *
 * // Basic usage
 * const webSearch = braveSearch({
 *   apiKey: process.env.BRAVE_API_KEY,
 * });
 *
 * // With locale settings
 * const webSearch = braveSearch({
 *   apiKey: process.env.BRAVE_API_KEY,
 *   country: 'us',
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
export function braveSearch(
  config: BraveSearchConfig,
): ToolDefinition<BraveSearchParams> {
  return {
    name: "web_search",
    description: `Search the web using Brave Search for current information. Use this when the user asks about:
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
        const response: WebSearchResponse = await searchBrave(
          {
            query: params.query,
            maxResults: params.maxResults ?? config.maxResults ?? 5,
          },
          {
            provider: "brave",
            apiKey: config.apiKey,
            country: config.country,
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
