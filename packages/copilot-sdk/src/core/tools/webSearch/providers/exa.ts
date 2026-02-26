/**
 * Exa Search Provider
 *
 * Exa (formerly Metaphor) is an AI-native search engine
 * that understands queries semantically for better results.
 *
 * @see https://exa.ai/
 */

import type {
  WebSearchConfig,
  WebSearchParams,
  WebSearchResponse,
  ExaApiResponse,
  WebSearchProviderInterface,
} from "../types";

const EXA_API_URL = "https://api.exa.ai/search";

/**
 * Validate Exa configuration
 */
export function validateExaConfig(config: WebSearchConfig): void {
  if (!config.apiKey) {
    throw new Error("Exa API key is required. Get one at https://exa.ai/");
  }
}

/**
 * Search using Exa API
 */
export async function searchExa(
  params: WebSearchParams,
  config: WebSearchConfig,
): Promise<WebSearchResponse> {
  validateExaConfig(config);

  const startTime = Date.now();

  // Exa uses "auto" for their autoprompt feature which enhances queries
  const searchType =
    params.searchDepth === "advanced" || config.searchDepth === "advanced"
      ? "auto"
      : "keyword";

  const requestBody: Record<string, unknown> = {
    query: params.query,
    numResults: params.maxResults ?? config.maxResults ?? 5,
    type: searchType,
    useAutoprompt: searchType === "auto",
  };

  // Add content retrieval if raw content is requested
  if (config.includeRawContent) {
    requestBody.contents = {
      text: true,
      highlights: true,
    };
  }

  // Domain filtering
  if (config.includeDomains?.length) {
    requestBody.includeDomains = config.includeDomains;
  }
  if (config.excludeDomains?.length) {
    requestBody.excludeDomains = config.excludeDomains;
  }

  const response = await fetch(EXA_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": config.apiKey!,
    },
    body: JSON.stringify(requestBody),
    signal: config.timeout ? AbortSignal.timeout(config.timeout) : undefined,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");
    throw new Error(`Exa API error (${response.status}): ${errorText}`);
  }

  const data: ExaApiResponse = await response.json();
  const searchTime = Date.now() - startTime;

  return {
    query: params.query,
    // Exa uses autoprompt to improve the query, include it as context
    answer: data.autopromptString
      ? `Enhanced query: ${data.autopromptString}`
      : undefined,
    results: data.results.map((result) => ({
      title: result.title,
      url: result.url,
      content: result.highlights?.join(" ") || result.text?.slice(0, 300) || "",
      score: result.score,
      publishedDate: result.publishedDate,
      domain: extractDomain(result.url),
    })),
    provider: "exa",
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
 * Exa provider implementation
 */
export const exaProvider: WebSearchProviderInterface = {
  search: searchExa,
  validateConfig: validateExaConfig,
};
