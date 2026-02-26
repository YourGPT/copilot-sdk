/**
 * OpenAI Search Tool
 *
 * Tree-shakeable import for OpenAI's built-in web search.
 * Uses OpenAI's Responses API with the web_search tool.
 *
 * @example
 * ```typescript
 * import { openaiSearch } from '@yourgpt/copilot-sdk/tools/openai';
 *
 * const webSearch = openaiSearch({
 *   apiKey: process.env.OPENAI_API_KEY,
 * });
 *
 * const runtime = createRuntime({
 *   tools: [webSearch],
 * });
 * ```
 *
 * @see https://platform.openai.com/docs/guides/tools-web-search
 * @module @yourgpt/copilot-sdk/tools/openai
 */

import type { ToolDefinition } from "../../core/types/tools";
import { failure } from "../../core/types/tools";
import {
  searchOpenAI,
  openaiProvider,
} from "../../core/tools/webSearch/providers/openai";
import {
  formatSearchResultsForAI,
  summarizeSearchResults,
} from "../../core/tools/webSearch";
import type { WebSearchResponse } from "../../core/tools/webSearch/types";

// Re-export provider for direct access
export { openaiProvider };

/**
 * OpenAI search configuration
 */
export interface OpenAISearchConfig {
  /** OpenAI API key - uses your existing OpenAI key */
  apiKey: string;
  /** Maximum number of results (default: 5) */
  maxResults?: number;
  /** Only include results from these domains */
  includeDomains?: string[];
  /** Request timeout in milliseconds */
  timeout?: number;
}

/**
 * Search parameters passed to the tool
 */
interface OpenAISearchParams {
  /** The search query */
  query: string;
  /** Maximum number of results (overrides config) */
  maxResults?: number;
}

/**
 * Create an OpenAI web search tool
 *
 * Uses OpenAI's built-in web_search tool via the Responses API.
 * No third-party API key required - uses your existing OpenAI API key.
 *
 * @param config - OpenAI configuration including API key
 * @returns A configured tool definition ready to use
 *
 * @example
 * ```typescript
 * import { openaiSearch } from '@yourgpt/copilot-sdk/tools/openai';
 *
 * // Basic usage
 * const webSearch = openaiSearch({
 *   apiKey: process.env.OPENAI_API_KEY,
 * });
 *
 * // With domain filtering
 * const webSearch = openaiSearch({
 *   apiKey: process.env.OPENAI_API_KEY,
 *   includeDomains: ['docs.python.org', 'stackoverflow.com'],
 *   maxResults: 5,
 * });
 *
 * const runtime = createRuntime({
 *   provider: openai,
 *   model: 'gpt-4o',
 *   tools: [webSearch],
 * });
 * ```
 */
export function openaiSearch(
  config: OpenAISearchConfig,
): ToolDefinition<OpenAISearchParams> {
  return {
    name: "web_search",
    description: `Search the web using OpenAI's native search for current information. Use this when the user asks about:
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
        const response: WebSearchResponse = await searchOpenAI(
          {
            query: params.query,
            maxResults: params.maxResults ?? config.maxResults ?? 5,
          },
          {
            provider: "openai",
            apiKey: config.apiKey,
            includeDomains: config.includeDomains,
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
        console.error("[OpenAI Search] Error:", errorMessage);
        return failure(errorMessage);
      }
    },
  };
}
