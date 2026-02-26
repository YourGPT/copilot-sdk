/**
 * Anthropic Web Search Provider
 *
 * Uses Anthropic's built-in web_search tool via the Messages API.
 * Returns reliable citations with cited_text, url, and title.
 *
 * @see https://docs.anthropic.com/en/docs/build-with-claude/tool-use/web-search-tool
 */

import type {
  WebSearchConfig,
  WebSearchParams,
  WebSearchResponse,
  WebSearchProviderInterface,
} from "../types";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";

/**
 * Validate Anthropic native search configuration
 */
export function validateAnthropicConfig(config: WebSearchConfig): void {
  if (!config.apiKey) {
    throw new Error(
      "Anthropic API key is required for native web search. " +
        "Pass apiKey or set ANTHROPIC_API_KEY environment variable.",
    );
  }
}

// Type definitions for Anthropic response
interface AnthropicWebSearchResult {
  type: "web_search_result";
  url: string;
  title: string;
  encrypted_content?: string;
  page_age?: string;
}

interface AnthropicCitation {
  type: "web_search_result_location";
  url: string;
  title: string;
  encrypted_index?: string;
  cited_text?: string;
}

interface AnthropicContentBlock {
  type: string;
  text?: string;
  tool_use_id?: string;
  content?: AnthropicWebSearchResult[];
  citations?: AnthropicCitation[];
}

interface AnthropicMessagesResponse {
  id: string;
  content: AnthropicContentBlock[];
  usage?: {
    input_tokens: number;
    output_tokens: number;
    server_tool_use?: {
      web_search_requests?: number;
    };
  };
}

/**
 * Search using Anthropic's native web_search tool
 */
export async function searchAnthropic(
  params: WebSearchParams,
  config: WebSearchConfig,
): Promise<WebSearchResponse> {
  validateAnthropicConfig(config);

  const startTime = Date.now();
  const apiKey = config.apiKey || process.env.ANTHROPIC_API_KEY;

  // Build web search tool configuration
  const webSearchTool: Record<string, unknown> = {
    type: "web_search_20250305", // Use stable version
    name: "web_search",
    max_uses: config.maxResults ?? 5,
  };

  // Add domain filtering if provided
  if (config.includeDomains?.length) {
    webSearchTool.allowed_domains = config.includeDomains;
  }
  if (config.excludeDomains?.length) {
    webSearchTool.blocked_domains = config.excludeDomains;
  }

  // Add user location if country is set
  if (config.country) {
    webSearchTool.user_location = {
      type: "approximate",
      country: config.country.toUpperCase(),
    };
  }

  // Call Anthropic Messages API
  const response = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514", // Use Sonnet 4 for balance of speed/quality
      max_tokens: 2048,
      tools: [webSearchTool],
      messages: [
        {
          role: "user",
          content: params.query,
        },
      ],
    }),
    signal: config.timeout ? AbortSignal.timeout(config.timeout) : undefined,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");
    console.error(
      "[Anthropic Native Search] API error:",
      response.status,
      errorText,
    );
    throw new Error(
      `Anthropic Messages API error (${response.status}): ${errorText}`,
    );
  }

  const data: AnthropicMessagesResponse = await response.json();
  const searchTime = Date.now() - startTime;

  // Extract answer text and citations
  let outputText = "";
  const sources: Array<{ url: string; title: string; cited_text?: string }> =
    [];
  const searchResults: Array<{
    url: string;
    title: string;
    page_age?: string;
  }> = [];

  if (data.content && Array.isArray(data.content)) {
    for (const block of data.content) {
      // Extract text blocks
      if (block.type === "text" && block.text) {
        outputText += block.text;

        // Extract citations from text blocks
        if (block.citations && Array.isArray(block.citations)) {
          for (const citation of block.citations) {
            if (citation.url && !sources.find((s) => s.url === citation.url)) {
              sources.push({
                url: citation.url,
                title: citation.title || extractDomain(citation.url),
                cited_text: citation.cited_text,
              });
            }
          }
        }
      }

      // Extract search results from web_search_tool_result
      if (block.type === "web_search_tool_result" && block.content) {
        for (const result of block.content) {
          if (result.type === "web_search_result" && result.url) {
            searchResults.push({
              url: result.url,
              title: result.title || extractDomain(result.url),
              page_age: result.page_age,
            });
          }
        }
      }
    }
  }

  // Prefer citations (have cited_text) over raw search results
  const finalSources = sources.length > 0 ? sources : searchResults;

  return {
    query: params.query,
    answer: outputText,
    results: finalSources
      .slice(0, params.maxResults ?? config.maxResults ?? 5)
      .map((source, i) => ({
        title: source.title,
        url: source.url,
        content: "cited_text" in source ? source.cited_text || "" : "",
        score: 1 - i * 0.1,
        domain: extractDomain(source.url),
      })),
    provider: "anthropic",
    totalResults: finalSources.length,
    searchTime,
  };
}

/**
 * Extract domain from URL
 */
function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace("www.", "");
  } catch {
    return url;
  }
}

/**
 * Anthropic native search provider implementation
 */
export const anthropicProvider: WebSearchProviderInterface = {
  search: searchAnthropic,
  validateConfig: validateAnthropicConfig,
};
