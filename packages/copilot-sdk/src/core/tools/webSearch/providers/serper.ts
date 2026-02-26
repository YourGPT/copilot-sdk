/**
 * Serper Search Provider
 *
 * Serper is a Google Search API that provides SERP data.
 * Fast and cost-effective for real-time Google results.
 *
 * @see https://serper.dev/
 */

import type {
  WebSearchConfig,
  WebSearchParams,
  WebSearchResponse,
  SerperApiResponse,
  WebSearchProviderInterface,
} from "../types";

const SERPER_API_URL = "https://google.serper.dev/search";

/**
 * Validate Serper configuration
 */
export function validateSerperConfig(config: WebSearchConfig): void {
  if (!config.apiKey) {
    throw new Error(
      "Serper API key is required. Get one at https://serper.dev/",
    );
  }
}

/**
 * Search using Serper API
 */
export async function searchSerper(
  params: WebSearchParams,
  config: WebSearchConfig,
): Promise<WebSearchResponse> {
  validateSerperConfig(config);

  const startTime = Date.now();

  const requestBody: Record<string, unknown> = {
    q: params.query,
    num: params.maxResults ?? config.maxResults ?? 5,
  };

  // Add locale settings
  if (config.country) {
    requestBody.gl = config.country;
  }
  if (config.language) {
    requestBody.hl = config.language;
  }

  const response = await fetch(SERPER_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": config.apiKey!,
    },
    body: JSON.stringify(requestBody),
    signal: config.timeout ? AbortSignal.timeout(config.timeout) : undefined,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");
    throw new Error(`Serper API error (${response.status}): ${errorText}`);
  }

  const data: SerperApiResponse = await response.json();
  const searchTime = Date.now() - startTime;

  // Filter by domains if specified
  let results = data.organic || [];
  if (config.includeDomains?.length) {
    results = results.filter((r) =>
      config.includeDomains!.some((domain) => r.link.includes(domain)),
    );
  }
  if (config.excludeDomains?.length) {
    results = results.filter(
      (r) => !config.excludeDomains!.some((domain) => r.link.includes(domain)),
    );
  }

  // Extract answer from answer box if available
  const answer = data.answerBox?.answer || data.answerBox?.snippet;

  return {
    query: params.query,
    answer,
    results: results.map((result) => ({
      title: result.title,
      url: result.link,
      content: result.snippet,
      publishedDate: result.date,
      image: result.imageUrl,
      domain: extractDomain(result.link),
    })),
    images: data.images?.map((img) => ({
      url: img.imageUrl,
      description: img.title,
      sourceUrl: img.link,
    })),
    provider: "serper",
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
 * Serper provider implementation
 */
export const serperProvider: WebSearchProviderInterface = {
  search: searchSerper,
  validateConfig: validateSerperConfig,
};
