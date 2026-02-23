/**
 * Exa Search Tool
 *
 * Tree-shakeable import for Exa web search provider.
 * Only imports Exa code - no other providers bundled.
 *
 * @example
 * ```typescript
 * import { exaSearch } from '@yourgpt/copilot-sdk/tools/exa';
 *
 * const webSearch = exaSearch({
 *   apiKey: process.env.EXA_API_KEY,
 * });
 *
 * const runtime = createRuntime({
 *   tools: [webSearch],
 * });
 * ```
 *
 * @see https://exa.ai/
 * @module @yourgpt/copilot-sdk/tools/exa
 */

import type { ToolDefinition } from "../../core/types/tools";
import { failure } from "../../core/types/tools";
import {
  searchExa,
  exaProvider,
} from "../../core/tools/webSearch/providers/exa";
import {
  formatSearchResultsForAI,
  summarizeSearchResults,
} from "../../core/tools/webSearch";
import type { WebSearchResponse } from "../../core/tools/webSearch/types";

// Re-export provider for direct access
export { exaProvider };

/**
 * Exa search configuration
 */
export interface ExaSearchConfig {
  /** Exa API key - get one at https://exa.ai/ */
  apiKey: string;
  /** Maximum number of results (default: 5) */
  maxResults?: number;
  /** Search depth - 'advanced' uses autoprompt for better semantic search */
  searchDepth?: "basic" | "advanced";
  /** Only include results from these domains */
  includeDomains?: string[];
  /** Exclude results from these domains */
  excludeDomains?: string[];
  /** Include raw page content */
  includeRawContent?: boolean;
  /** Request timeout in milliseconds */
  timeout?: number;
}

/**
 * Search parameters passed to the tool
 */
interface ExaSearchParams {
  /** The search query */
  query: string;
  /** Maximum number of results (overrides config) */
  maxResults?: number;
  /** Search depth (overrides config) */
  searchDepth?: "basic" | "advanced";
}

/**
 * Create an Exa web search tool
 *
 * Exa (formerly Metaphor) is an AI-native search engine that understands
 * queries semantically for better results.
 *
 * @param config - Exa configuration including API key
 * @returns A configured tool definition ready to use
 *
 * @example
 * ```typescript
 * import { exaSearch } from '@yourgpt/copilot-sdk/tools/exa';
 *
 * // Basic usage
 * const webSearch = exaSearch({
 *   apiKey: process.env.EXA_API_KEY,
 * });
 *
 * // With semantic search (autoprompt)
 * const webSearch = exaSearch({
 *   apiKey: process.env.EXA_API_KEY,
 *   searchDepth: 'advanced',
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
export function exaSearch(
  config: ExaSearchConfig,
): ToolDefinition<ExaSearchParams> {
  return {
    name: "web_search",
    description: `Search the web using Exa for current information. Use this when the user asks about:
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
        searchDepth: {
          type: "string",
          enum: ["basic", "advanced"],
          description:
            "Search depth - 'advanced' uses semantic search for better results",
        },
      },
      required: ["query"],
    },

    needsApproval: false,
    aiResponseMode: "full",

    handler: async (params) => {
      try {
        const response: WebSearchResponse = await searchExa(
          {
            query: params.query,
            maxResults: params.maxResults ?? config.maxResults ?? 5,
            searchDepth: params.searchDepth ?? config.searchDepth ?? "basic",
          },
          {
            provider: "exa",
            apiKey: config.apiKey,
            includeDomains: config.includeDomains,
            excludeDomains: config.excludeDomains,
            includeRawContent: config.includeRawContent,
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
