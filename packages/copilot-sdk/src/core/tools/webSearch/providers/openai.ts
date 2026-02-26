/**
 * OpenAI Web Search Provider
 *
 * Uses OpenAI's built-in web_search tool via the Responses API.
 * No third-party API key required - uses your OpenAI API key.
 *
 * @see https://platform.openai.com/docs/guides/tools-web-search
 */

import type {
  WebSearchConfig,
  WebSearchParams,
  WebSearchResponse,
  WebSearchProviderInterface,
} from "../types";

/**
 * Validate OpenAI native search configuration
 */
export function validateOpenAIConfig(config: WebSearchConfig): void {
  if (!config.apiKey) {
    throw new Error(
      "OpenAI API key is required for native web search. " +
        "Pass apiKey or set OPENAI_API_KEY environment variable.",
    );
  }
}

/**
 * Search using OpenAI's native web_search tool (Responses API)
 */
export async function searchOpenAI(
  params: WebSearchParams,
  config: WebSearchConfig,
): Promise<WebSearchResponse> {
  validateOpenAIConfig(config);

  const startTime = Date.now();
  const apiKey = config.apiKey || process.env.OPENAI_API_KEY;

  // Build tools array with web_search
  const tools: Array<Record<string, unknown>> = [
    {
      type: "web_search",
      // Domain filtering if provided
      ...(config.includeDomains?.length && {
        filters: {
          domains: config.includeDomains,
        },
      }),
    },
  ];

  // Call OpenAI Responses API
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o", // Use GPT-4o for web search
      tools,
      input: params.query,
    }),
    signal: config.timeout ? AbortSignal.timeout(config.timeout) : undefined,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");
    console.error(
      "[OpenAI Native Search] API error:",
      response.status,
      errorText,
    );
    throw new Error(
      `OpenAI Responses API error (${response.status}): ${errorText}`,
    );
  }

  const data = await response.json();
  const searchTime = Date.now() - startTime;

  // Extract answer text and annotations from the message output
  let outputText = "";
  const sources: Array<{ url: string; title: string }> = [];

  if (data.output && Array.isArray(data.output)) {
    for (const item of data.output) {
      // Find the message with content
      if (item.type === "message" && item.content) {
        for (const contentPart of item.content) {
          // Extract text
          if (contentPart.type === "output_text" && contentPart.text) {
            outputText = contentPart.text;
          }

          // Extract sources from annotations (url_citation)
          if (
            contentPart.annotations &&
            Array.isArray(contentPart.annotations)
          ) {
            for (const annotation of contentPart.annotations) {
              if (annotation.type === "url_citation" && annotation.url) {
                // Avoid duplicates
                if (!sources.find((s) => s.url === annotation.url)) {
                  sources.push({
                    url: annotation.url,
                    title: annotation.title || extractDomain(annotation.url),
                  });
                }
              }
            }
          }
        }
      }
    }
  }

  return {
    query: params.query,
    answer: outputText,
    results: sources
      .slice(0, params.maxResults ?? config.maxResults ?? 5)
      .map((source, i) => ({
        title: source.title,
        url: source.url,
        content: "", // OpenAI returns answer with inline citations, not separate snippets
        score: 1 - i * 0.1,
        domain: extractDomain(source.url),
      })),
    provider: "openai",
    totalResults: sources.length,
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
 * OpenAI native search provider implementation
 */
export const openaiProvider: WebSearchProviderInterface = {
  search: searchOpenAI,
  validateConfig: validateOpenAIConfig,
};
