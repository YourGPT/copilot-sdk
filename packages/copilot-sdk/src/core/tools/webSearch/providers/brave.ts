/**
 * Brave Search Provider
 *
 * Brave Search is a privacy-focused search engine with its own index.
 * Provides independent search results without tracking.
 *
 * @see https://brave.com/search/api/
 */

import type {
  WebSearchConfig,
  WebSearchParams,
  WebSearchResponse,
  BraveApiResponse,
  WebSearchProviderInterface,
} from "../types";

const BRAVE_API_URL = "https://api.search.brave.com/res/v1/web/search";

/**
 * Validate Brave configuration
 */
export function validateBraveConfig(config: WebSearchConfig): void {
  if (!config.apiKey) {
    throw new Error(
      "Brave Search API key is required. Get one at https://brave.com/search/api/",
    );
  }
}

/**
 * Search using Brave Search API
 */
export async function searchBrave(
  params: WebSearchParams,
  config: WebSearchConfig,
): Promise<WebSearchResponse> {
  validateBraveConfig(config);

  const startTime = Date.now();

  const searchParams = new URLSearchParams({
    q: params.query,
    count: String(params.maxResults ?? config.maxResults ?? 5),
  });

  // Add locale settings
  if (config.country) {
    searchParams.set("country", config.country);
  }
  if (config.language) {
    searchParams.set("search_lang", config.language);
  }

  const url = `${BRAVE_API_URL}?${searchParams.toString()}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
      "Accept-Encoding": "gzip",
      "X-Subscription-Token": config.apiKey!,
    },
    signal: config.timeout ? AbortSignal.timeout(config.timeout) : undefined,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");
    throw new Error(
      `Brave Search API error (${response.status}): ${errorText}`,
    );
  }

  const data: BraveApiResponse = await response.json();
  const searchTime = Date.now() - startTime;

  // Filter by domains if specified
  let results = data.web?.results || [];
  if (config.includeDomains?.length) {
    results = results.filter((r) =>
      config.includeDomains!.some((domain) => r.url.includes(domain)),
    );
  }
  if (config.excludeDomains?.length) {
    results = results.filter(
      (r) => !config.excludeDomains!.some((domain) => r.url.includes(domain)),
    );
  }

  // Extract answer from infobox if available
  const answer = data.infobox?.description;

  return {
    query: params.query,
    answer,
    results: results.map((result) => ({
      title: result.title,
      url: result.url,
      content: result.description,
      publishedDate: result.page_age,
      image: result.thumbnail?.src,
      domain: extractDomain(result.url),
    })),
    provider: "brave",
    totalResults: results.length,
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
 * Brave provider implementation
 */
export const braveProvider: WebSearchProviderInterface = {
  search: searchBrave,
  validateConfig: validateBraveConfig,
};
