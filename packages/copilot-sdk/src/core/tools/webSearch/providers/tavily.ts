/**
 * Tavily Search Provider
 *
 * Tavily is an AI-native search engine optimized for LLMs.
 * It provides high-quality results with optional AI-generated answers.
 *
 * @see https://tavily.com/
 */

import type {
  WebSearchConfig,
  WebSearchParams,
  WebSearchResponse,
  TavilyApiResponse,
  WebSearchProviderInterface,
} from "../types";

const TAVILY_API_URL = "https://api.tavily.com/search";

/**
 * Validate Tavily configuration
 */
export function validateTavilyConfig(config: WebSearchConfig): void {
  if (!config.apiKey) {
    throw new Error(
      "Tavily API key is required. Get one at https://tavily.com/",
    );
  }
}

/**
 * Search using Tavily API
 */
export async function searchTavily(
  params: WebSearchParams,
  config: WebSearchConfig,
): Promise<WebSearchResponse> {
  validateTavilyConfig(config);

  const startTime = Date.now();

  const requestBody = {
    api_key: config.apiKey,
    query: params.query,
    search_depth: params.searchDepth || config.searchDepth || "basic",
    max_results: params.maxResults ?? config.maxResults ?? 5,
    include_answer: config.includeAnswer ?? true,
    include_images: config.includeImages ?? false,
    include_raw_content: config.includeRawContent ?? false,
    include_domains: config.includeDomains,
    exclude_domains: config.excludeDomains,
  };

  const response = await fetch(TAVILY_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
    signal: config.timeout ? AbortSignal.timeout(config.timeout) : undefined,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");
    throw new Error(`Tavily API error (${response.status}): ${errorText}`);
  }

  const data: TavilyApiResponse = await response.json();
  const searchTime = Date.now() - startTime;

  return {
    query: params.query,
    answer: data.answer,
    results: data.results.map((result) => ({
      title: result.title,
      url: result.url,
      content: result.content,
      score: result.score,
      publishedDate: result.published_date,
      domain: extractDomain(result.url),
    })),
    images: data.images?.map((img) => ({
      url: img.url,
      description: img.description,
    })),
    provider: "tavily",
    totalResults: data.results.length,
    searchTime,
  };
}

/**
 * Extract domain from URL
 */
function extractDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

/**
 * Tavily provider implementation
 */
export const tavilyProvider: WebSearchProviderInterface = {
  search: searchTavily,
  validateConfig: validateTavilyConfig,
};
