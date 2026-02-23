/**
 * Google Search Tool
 *
 * Tree-shakeable import for Google's built-in web search via Gemini API.
 * Uses Google's grounding with Google Search feature.
 *
 * @example
 * ```typescript
 * import { googleSearch } from '@yourgpt/copilot-sdk/tools/google';
 *
 * const webSearch = googleSearch({
 *   apiKey: process.env.GOOGLE_API_KEY,
 * });
 *
 * const runtime = createRuntime({
 *   tools: [webSearch],
 * });
 * ```
 *
 * @see https://ai.google.dev/gemini-api/docs/google-search
 * @module @yourgpt/copilot-sdk/tools/google
 */

import type { ToolDefinition } from "../../core/types/tools";
import { failure } from "../../core/types/tools";
import {
  searchGoogle,
  googleProvider,
} from "../../core/tools/webSearch/providers/google";
import {
  formatSearchResultsForAI,
  summarizeSearchResults,
} from "../../core/tools/webSearch";
import type { WebSearchResponse } from "../../core/tools/webSearch/types";

// Re-export provider for direct access
export { googleProvider };

/**
 * Google native search configuration
 */
export interface GoogleSearchConfig {
  /** Google/Gemini API key - uses your existing Google API key */
  apiKey: string;
  /** Maximum number of results (default: 5) */
  maxResults?: number;
  /** Request timeout in milliseconds */
  timeout?: number;
}

/**
 * Search parameters passed to the tool
 */
interface GoogleSearchParams {
  /** The search query */
  query: string;
  /** Maximum number of results (overrides config) */
  maxResults?: number;
}

/**
 * Create a Google native web search tool
 *
 * Uses Google's built-in grounding with Google Search via the Gemini API.
 * No third-party API key required - uses your existing Google/Gemini API key.
 *
 * @param config - Google configuration including API key
 * @returns A configured tool definition ready to use
 *
 * @example
 * ```typescript
 * import { googleSearch } from '@yourgpt/copilot-sdk/tools/google';
 *
 * // Basic usage
 * const webSearch = googleSearch({
 *   apiKey: process.env.GOOGLE_API_KEY,
 * });
 *
 * // Or with Gemini API key
 * const webSearch = googleSearch({
 *   apiKey: process.env.GEMINI_API_KEY,
 *   maxResults: 5,
 * });
 *
 * const runtime = createRuntime({
 *   provider: gemini,
 *   model: 'gemini-2.0-flash',
 *   tools: [webSearch],
 * });
 * ```
 */
export function googleSearch(
  config: GoogleSearchConfig,
): ToolDefinition<GoogleSearchParams> {
  return {
    name: "web_search",
    description: `Search the web using Google Search for current information. Use this when the user asks about:
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
        const response: WebSearchResponse = await searchGoogle(
          {
            query: params.query,
            maxResults: params.maxResults ?? config.maxResults ?? 5,
          },
          {
            provider: "google",
            apiKey: config.apiKey,
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
