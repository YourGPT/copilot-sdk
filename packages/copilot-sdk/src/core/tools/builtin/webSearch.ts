/**
 * Built-in Web Search Tool
 *
 * A pre-configured tool for searching the web with multiple provider support.
 * Runs on the server to protect API keys.
 *
 * Supports tree-shaking - import providers directly for smaller bundles.
 *
 * @example
 * ```typescript
 * // Option 1: String provider (lazy loaded at runtime)
 * import { createWebSearchTool } from '@yourgpt/copilot-sdk';
 * const webSearch = createWebSearchTool({
 *   provider: 'tavily',
 *   apiKey: process.env.TAVILY_API_KEY,
 * });
 *
 * // Option 2: Direct provider import (best for tree-shaking)
 * import { createWebSearchTool, tavilyProvider } from '@yourgpt/copilot-sdk';
 * const webSearch = createWebSearchTool({
 *   provider: tavilyProvider,
 *   apiKey: process.env.TAVILY_API_KEY,
 * });
 *
 * // Add to your runtime
 * const runtime = createRuntime({
 *   tools: [webSearch],
 * });
 * ```
 */

import { tool, success, failure } from "../../types/tools";
import type { ToolDefinition } from "../../types/tools";
import {
  executeWebSearch,
  formatSearchResultsForAI,
  summarizeSearchResults,
  type WebSearchConfigExtended,
} from "../webSearch";
import type {
  WebSearchConfig,
  WebSearchParams,
  WebSearchResponse,
  WebSearchProviderInterface,
} from "../webSearch/types";

/**
 * Base web search tool definition
 *
 * This is the core tool definition. Use `createWebSearchTool()` to create
 * a configured instance with your provider settings.
 */
export const webSearchTool = tool<WebSearchParams>({
  description: `Search the web for current information. Use this when the user asks about:
- Recent events, news, or current affairs
- Real-time data (prices, weather, stocks, sports scores)
- Information that might have changed after your training cutoff
- Facts that need verification with current sources
- Research topics that require up-to-date information`,

  location: "server", // Runs on server to protect API keys

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

  needsApproval: false, // No user data exposed, just searching

  // Control what AI sees from results
  aiResponseMode: "full",
  aiContext: (result, args) => {
    if (!result.success) return `Search failed: ${result.error}`;
    const data = result.data as WebSearchResponse;
    return formatSearchResultsForAI(data);
  },
});

/**
 * Create a configured web search tool
 *
 * Supports both string provider names (lazy loaded) and direct provider imports (tree-shakeable).
 *
 * @param config - Web search configuration including provider and API key
 * @returns A configured tool definition ready to use
 *
 * @example
 * ```typescript
 * // ===== BEST FOR TREE-SHAKING: Direct provider import =====
 * import { createWebSearchTool, openaiProvider } from '@yourgpt/copilot-sdk/core';
 *
 * const webSearch = createWebSearchTool({
 *   provider: openaiProvider, // Only this provider in bundle
 *   apiKey: process.env.OPENAI_API_KEY,
 * });
 *
 * // ===== STRING PROVIDERS (Lazy loaded at runtime) =====
 *
 * // OpenAI (uses your OpenAI API key)
 * const webSearch = createWebSearchTool({
 *   provider: 'openai',
 *   apiKey: process.env.OPENAI_API_KEY,
 * });
 *
 * // Google (uses your Google/Gemini API key)
 * const webSearch = createWebSearchTool({
 *   provider: 'google',
 *   apiKey: process.env.GOOGLE_API_KEY,
 * });
 *
 * // Tavily (AI-optimized search with answer generation)
 * const webSearch = createWebSearchTool({
 *   provider: 'tavily',
 *   apiKey: process.env.TAVILY_API_KEY,
 *   includeAnswer: true,
 *   maxResults: 5,
 * });
 *
 * // Serper (Google results)
 * const webSearch = createWebSearchTool({
 *   provider: 'serper',
 *   apiKey: process.env.SERPER_API_KEY,
 * });
 *
 * // Brave Search (privacy-focused)
 * const webSearch = createWebSearchTool({
 *   provider: 'brave',
 *   apiKey: process.env.BRAVE_API_KEY,
 * });
 *
 * // Self-hosted SearXNG (no API key needed)
 * const webSearch = createWebSearchTool({
 *   provider: 'searxng',
 *   baseUrl: 'https://your-searxng-instance.com',
 * });
 *
 * // Exa (AI-optimized semantic search)
 * const webSearch = createWebSearchTool({
 *   provider: 'exa',
 *   apiKey: process.env.EXA_API_KEY,
 *   searchDepth: 'advanced',
 * });
 * ```
 */
export function createWebSearchTool(
  config: WebSearchConfigExtended,
): ToolDefinition<WebSearchParams> {
  return {
    name: "web_search",
    ...webSearchTool,
    handler: async (params: WebSearchParams) => {
      try {
        const response = await executeWebSearch(
          {
            query: params.query,
            maxResults: params.maxResults ?? config.maxResults ?? 5,
            searchDepth: params.searchDepth ?? config.searchDepth ?? "basic",
          },
          config,
        );

        // Build the AI context string
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

/**
 * Utility types for web search tool configuration
 */
export type {
  WebSearchConfig,
  WebSearchParams,
  WebSearchResponse,
  WebSearchProviderInterface,
};
export type { WebSearchConfigExtended };
