/**
 * SearXNG Search Provider
 *
 * SearXNG is a privacy-respecting, self-hostable metasearch engine.
 * It aggregates results from multiple search engines without tracking.
 *
 * @see https://docs.searxng.org/
 */

import type {
  WebSearchConfig,
  WebSearchParams,
  WebSearchResponse,
  SearxngApiResponse,
  WebSearchProviderInterface,
} from "../types";

// Default public instance (users should self-host for production)
const DEFAULT_SEARXNG_URL = "https://searxng.instance.local";

/**
 * Validate SearXNG configuration
 */
export function validateSearxngConfig(config: WebSearchConfig): void {
  if (!config.baseUrl) {
    throw new Error(
      "SearXNG base URL is required. Self-host SearXNG or use a public instance. " +
        "See https://docs.searxng.org/ for setup instructions.",
    );
  }
}

/**
 * Search using SearXNG API
 */
export async function searchSearxng(
  params: WebSearchParams,
  config: WebSearchConfig,
): Promise<WebSearchResponse> {
  validateSearxngConfig(config);

  const startTime = Date.now();

  const baseUrl = config.baseUrl || DEFAULT_SEARXNG_URL;
  const searchParams = new URLSearchParams({
    q: params.query,
    format: "json",
  });

  // SearXNG doesn't have a direct max_results param, but we can limit after
  if (config.language) {
    searchParams.set("language", config.language);
  }

  // Add specific engines if needed
  // searchParams.set('engines', 'google,duckduckgo,bing');

  const url = `${baseUrl.replace(/\/$/, "")}/search?${searchParams.toString()}`;

  const headers: Record<string, string> = {
    Accept: "application/json",
  };

  // Add API key if provided (some instances require it)
  if (config.apiKey) {
    headers["Authorization"] = `Bearer ${config.apiKey}`;
  }

  const response = await fetch(url, {
    method: "GET",
    headers,
    signal: config.timeout ? AbortSignal.timeout(config.timeout) : undefined,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");
    throw new Error(`SearXNG API error (${response.status}): ${errorText}`);
  }

  const data: SearxngApiResponse = await response.json();
  const searchTime = Date.now() - startTime;

  // Filter by domains if specified
  let results = data.results || [];
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

  // Limit results
  const maxResults = params.maxResults ?? config.maxResults ?? 5;
  results = results.slice(0, maxResults);

  // Extract answer from infoboxes or answers if available
  const answer = data.answers?.[0] || data.infoboxes?.[0]?.content;

  return {
    query: params.query,
    answer,
    results: results.map((result) => ({
      title: result.title,
      url: result.url,
      content: result.content,
      score: result.score,
      publishedDate: result.publishedDate,
      image: result.img_src,
      domain: extractDomain(result.url),
    })),
    provider: "searxng",
    totalResults: data.number_of_results,
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
 * SearXNG provider implementation
 */
export const searxngProvider: WebSearchProviderInterface = {
  search: searchSearxng,
  validateConfig: validateSearxngConfig,
};
