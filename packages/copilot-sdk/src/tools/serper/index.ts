/**
 * Serper Search Tool
 *
 * Tree-shakeable import for Serper web search provider.
 * Only imports Serper code - no other providers bundled.
 *
 * @example
 * ```typescript
 * import { serperSearch } from '@yourgpt/copilot-sdk/tools/serper';
 *
 * const webSearch = serperSearch({
 *   apiKey: process.env.SERPER_API_KEY,
 * });
 *
 * const runtime = createRuntime({
 *   tools: [webSearch],
 * });
 * ```
 *
 * @see https://serper.dev/
 * @module @yourgpt/copilot-sdk/tools/serper
 */

import type { ToolDefinition } from "../../core/types/tools";
import { failure } from "../../core/types/tools";
import {
  searchSerper,
  serperProvider,
} from "../../core/tools/webSearch/providers/serper";
import {
  formatSearchResultsForAI,
  summarizeSearchResults,
} from "../../core/tools/webSearch";
import type { WebSearchResponse } from "../../core/tools/webSearch/types";

// Re-export provider for direct access
export { serperProvider };

/**
 * Serper search configuration
 */
export interface SerperSearchConfig {
  /** Serper API key - get one at https://serper.dev/ */
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
interface SerperSearchParams {
  /** The search query */
  query: string;
  /** Maximum number of results (overrides config) */
  maxResults?: number;
}

/**
 * Create a Serper web search tool
 *
 * Serper is a Google Search API that provides SERP data.
 * Fast and cost-effective for real-time Google results.
 *
 * @param config - Serper configuration including API key
 * @returns A configured tool definition ready to use
 *
 * @example
 * ```typescript
 * import { serperSearch } from '@yourgpt/copilot-sdk/tools/serper';
 *
 * // Basic usage
 * const webSearch = serperSearch({
 *   apiKey: process.env.SERPER_API_KEY,
 * });
 *
 * // With locale settings
 * const webSearch = serperSearch({
 *   apiKey: process.env.SERPER_API_KEY,
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
export function serperSearch(
  config: SerperSearchConfig,
): ToolDefinition<SerperSearchParams> {
  return {
    name: "web_search",
    description: `Search the web using Serper (Google results) for current information. Use this when the user asks about:
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
        const response: WebSearchResponse = await searchSerper(
          {
            query: params.query,
            maxResults: params.maxResults ?? config.maxResults ?? 5,
          },
          {
            provider: "serper",
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
