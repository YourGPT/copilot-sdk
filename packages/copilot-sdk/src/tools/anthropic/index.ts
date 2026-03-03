/**
 * Anthropic Web Search Tool
 *
 * Tree-shakeable subpath export for Anthropic's built-in web search.
 *
 * @example
 * ```typescript
 * import { anthropicSearch } from '@yourgpt/copilot-sdk/tools/anthropic';
 *
 * const webSearch = anthropicSearch({
 *   apiKey: process.env.ANTHROPIC_API_KEY,
 * });
 *
 * const runtime = createRuntime({
 *   tools: [webSearch],
 * });
 * ```
 */

import type { ToolDefinition } from "../../core/types/tools";
import {
  searchAnthropic,
  anthropicProvider,
} from "../../core/tools/webSearch/providers/anthropic";
import type { WebSearchResponse } from "../../core/tools/webSearch/types";
import { formatSearchResultsForAI } from "../../core/tools/webSearch";

export { anthropicProvider };

export interface AnthropicSearchConfig {
  /** Anthropic API key (or set ANTHROPIC_API_KEY env var) */
  apiKey?: string;
  /** Maximum number of search results (default: 5) */
  maxResults?: number;
  /** Only include results from these domains */
  allowedDomains?: string[];
  /** Exclude results from these domains */
  blockedDomains?: string[];
  /** Country code for localized results */
  country?: string;
  /** Request timeout in milliseconds */
  timeout?: number;
}

export interface AnthropicSearchParams {
  query: string;
  maxResults?: number;
}

type WebSearchTool = ToolDefinition<AnthropicSearchParams>;

/**
 * Anthropic Search Tool
 *
 * Uses Anthropic's built-in web_search tool via the Messages API.
 * Returns reliable citations with cited_text, url, and title.
 *
 * @example
 * ```typescript
 * import { anthropicSearch } from '@yourgpt/copilot-sdk/tools/anthropic';
 *
 * const webSearch = anthropicSearch({
 *   apiKey: process.env.ANTHROPIC_API_KEY,
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
export function anthropicSearch(
  config: AnthropicSearchConfig = {},
): WebSearchTool {
  return {
    name: "web_search",
    description:
      "Search the web using Anthropic's native search for current information. " +
      "Returns results with citations including cited text, URLs, and titles.",
    location: "server",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The search query to find information about",
        },
        maxResults: {
          type: "number",
          description: "Maximum number of results to return (default: 5)",
          minimum: 1,
          maximum: 10,
        },
      },
      required: ["query"],
    },
    handler: async (params) => {
      const response: WebSearchResponse = await searchAnthropic(params, {
        provider: "anthropic",
        apiKey: config.apiKey,
        maxResults: config.maxResults,
        includeDomains: config.allowedDomains,
        excludeDomains: config.blockedDomains,
        country: config.country,
        timeout: config.timeout,
      });

      return {
        success: true,
        data: response,
        _aiContext: formatSearchResultsForAI(response),
      };
    },
  } as WebSearchTool;
}
