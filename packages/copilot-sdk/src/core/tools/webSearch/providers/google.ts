/**
 * Google Web Search Provider (Grounding with Google Search)
 *
 * Uses Google's built-in grounding feature via the Gemini API.
 * No third-party API key required - uses your Google/Gemini API key.
 *
 * @see https://ai.google.dev/gemini-api/docs/google-search
 */

import type {
  WebSearchConfig,
  WebSearchParams,
  WebSearchResponse,
  WebSearchProviderInterface,
} from "../types";

const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models";

/**
 * Validate Google native search configuration
 */
export function validateGoogleConfig(config: WebSearchConfig): void {
  if (!config.apiKey) {
    throw new Error(
      "Google API key is required for native web search. " +
        "Pass apiKey or set GOOGLE_API_KEY/GEMINI_API_KEY environment variable.",
    );
  }
}

/**
 * Search using Google's native grounding with Google Search
 */
export async function searchGoogle(
  params: WebSearchParams,
  config: WebSearchConfig,
): Promise<WebSearchResponse> {
  validateGoogleConfig(config);

  const startTime = Date.now();
  const apiKey =
    config.apiKey || process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
  const model = "gemini-2.0-flash"; // Use latest model with grounding support

  const url = `${GEMINI_API_URL}/${model}:generateContent?key=${apiKey}`;

  // Build request with Google Search grounding
  const requestBody = {
    contents: [
      {
        parts: [
          {
            text: params.query,
          },
        ],
      },
    ],
    tools: [
      {
        google_search: {}, // Enable Google Search grounding
      },
    ],
    // Generation config
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 1024,
    },
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
    signal: config.timeout ? AbortSignal.timeout(config.timeout) : undefined,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");
    throw new Error(
      `Google Gemini API error (${response.status}): ${errorText}`,
    );
  }

  const data = await response.json();
  const searchTime = Date.now() - startTime;

  // Extract the generated text
  const candidates = data.candidates || [];
  const content = candidates[0]?.content;
  const textParts =
    content?.parts?.filter((p: { text?: string }) => p.text) || [];
  const generatedText = textParts
    .map((p: { text: string }) => p.text)
    .join("\n");

  // Extract grounding metadata (sources)
  const groundingMetadata = candidates[0]?.groundingMetadata;
  const groundingChunks = groundingMetadata?.groundingChunks || [];
  const searchEntryPoint = groundingMetadata?.searchEntryPoint;

  // Build results from grounding chunks
  const results = groundingChunks
    .filter((chunk: { web?: { uri: string; title?: string } }) => chunk.web)
    .slice(0, params.maxResults ?? config.maxResults ?? 5)
    .map((chunk: { web: { uri: string; title?: string } }, i: number) => ({
      title: chunk.web.title || extractDomain(chunk.web.uri),
      url: chunk.web.uri,
      content: "", // Google doesn't provide snippets in grounding response
      score: 1 - i * 0.1,
      domain: extractDomain(chunk.web.uri),
    }));

  return {
    query: params.query,
    answer: generatedText,
    results,
    provider: "google",
    totalResults: groundingChunks.length,
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
 * Google native search provider implementation
 */
export const googleProvider: WebSearchProviderInterface = {
  search: searchGoogle,
  validateConfig: validateGoogleConfig,
};
