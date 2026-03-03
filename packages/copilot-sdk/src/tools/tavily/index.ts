/**
 * Tavily Search Tool
 *
 * Tree-shakeable import for Tavily web search provider.
 * Only imports Tavily code - no other providers bundled.
 *
 * @example
 * ```typescript
 * import { tavilySearch } from '@yourgpt/copilot-sdk/tools/tavily';
 *
 * const webSearch = tavilySearch({
 *   apiKey: process.env.TAVILY_API_KEY,
 * });
 *
 * const runtime = createRuntime({
 *   tools: [webSearch],
 * });
 * ```
 *
 * @see https://tavily.com/
 * @module @yourgpt/copilot-sdk/tools/tavily
 */

import type { ToolDefinition } from "../../core/types/tools";
import { failure } from "../../core/types/tools";
import {
  searchTavily,
  tavilyProvider,
} from "../../core/tools/webSearch/providers/tavily";
import {
  formatSearchResultsForAI,
  summarizeSearchResults,
} from "../../core/tools/webSearch";
import type { WebSearchResponse } from "../../core/tools/webSearch/types";

// Re-export provider for direct access
export { tavilyProvider };

/**
 * Tavily search configuration
 */
export interface TavilySearchConfig {
  /** Tavily API key - get one at https://tavily.com/ */
  apiKey: string;
  /** Include AI-generated answer summary (default: true) */
  includeAnswer?: boolean;
  /** Maximum number of results (default: 5) */
  maxResults?: number;
  /** Search depth - 'advanced' provides more thorough results */
  searchDepth?: "basic" | "advanced";
  /** Only include results from these domains */
  includeDomains?: string[];
  /** Exclude results from these domains */
  excludeDomains?: string[];
  /** Include image results */
  includeImages?: boolean;
  /** Request timeout in milliseconds */
  timeout?: number;
}

/**
 * Search parameters passed to the tool
 */
interface TavilySearchParams {
  /** The search query */
  query: string;
  /** Maximum number of results (overrides config) */
  maxResults?: number;
  /** Search depth (overrides config) */
  searchDepth?: "basic" | "advanced";
}

/**
 * Create a Tavily web search tool
 *
 * Tavily is an AI-native search engine optimized for LLMs.
 * It provides high-quality results with optional AI-generated answers.
 *
 * @param config - Tavily configuration including API key
 * @returns A configured tool definition ready to use
 *
 * @example
 * ```typescript
 * import { tavilySearch } from '@yourgpt/copilot-sdk/tools/tavily';
 *
 * // Basic usage
 * const webSearch = tavilySearch({
 *   apiKey: process.env.TAVILY_API_KEY,
 * });
 *
 * // With options
 * const webSearch = tavilySearch({
 *   apiKey: process.env.TAVILY_API_KEY,
 *   includeAnswer: true,
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
export function tavilySearch(
  config: TavilySearchConfig,
): ToolDefinition<TavilySearchParams> {
  return {
    name: "web_search",
    description: `Search the web using Tavily for current information. Use this when the user asks about:
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
            "Search depth - 'advanced' provides more thorough results but may be slower",
        },
      },
      required: ["query"],
    },

    needsApproval: false,
    aiResponseMode: "full",

    handler: async (params) => {
      try {
        const response: WebSearchResponse = await searchTavily(
          {
            query: params.query,
            maxResults: params.maxResults ?? config.maxResults ?? 5,
            searchDepth: params.searchDepth ?? config.searchDepth ?? "basic",
          },
          {
            provider: "tavily",
            apiKey: config.apiKey,
            includeAnswer: config.includeAnswer,
            includeDomains: config.includeDomains,
            excludeDomains: config.excludeDomains,
            includeImages: config.includeImages,
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
