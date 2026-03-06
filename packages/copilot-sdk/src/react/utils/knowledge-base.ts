/**
 * Knowledge Base Search Utility
 *
 * Integrates with YourGPT's searchIndexDocument API for semantic search
 * across your project's trained knowledge base.
 *
 * @see https://docs.yourgpt.ai/chatbot/developer-guide/api-reference/chatbot/searchIndexDocument
 */

import type {
  KnowledgeBaseConfig,
  KnowledgeBaseResult,
  KnowledgeBaseSearchResponse,
  KnowledgeBaseAPIResponse,
} from "../../core";

/**
 * YourGPT Knowledge Base API endpoint
 */
const KNOWLEDGE_BASE_API =
  "https://api.yourgpt.ai/chatbot/v1/searchIndexDocument";

/**
 * Search the knowledge base using YourGPT's searchIndexDocument API
 *
 * @param query - Search query string
 * @param config - Knowledge base configuration
 * @returns Search results
 *
 * @example
 * ```ts
 * const results = await searchKnowledgeBase("How do I reset my password?", {
 *   apiKey: "your-api-key",
 *   limit: 5,
 * });
 * ```
 */
export async function searchKnowledgeBase(
  query: string,
  config: KnowledgeBaseConfig,
): Promise<KnowledgeBaseSearchResponse> {
  try {
    const response = await fetch(KNOWLEDGE_BASE_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": config.apiKey,
      },
      body: JSON.stringify({
        query,
        limit: config.limit ?? 10,
      }),
    });

    if (!response.ok) {
      // Handle specific error codes
      if (response.status === 401) {
        return {
          success: false,
          results: [],
          total: 0,
          error: "Authentication failed. Check your API key.",
        };
      }
      if (response.status === 403) {
        return {
          success: false,
          results: [],
          total: 0,
          error:
            "Knowledge Base API not available on your plan. Upgrade to Professional or above.",
        };
      }
      if (response.status === 429) {
        return {
          success: false,
          results: [],
          total: 0,
          error: "Rate limit exceeded. Try again later.",
        };
      }

      return {
        success: false,
        results: [],
        total: 0,
        error: `API error: ${response.status} ${response.statusText}`,
      };
    }

    const data: KnowledgeBaseAPIResponse = await response.json();

    // Check for API-level errors
    if (data.type !== "RXSUCCESS") {
      return {
        success: false,
        results: [],
        total: 0,
        error: data.message || "Knowledge base search failed",
      };
    }

    // Transform API response to normalized format
    const results: KnowledgeBaseResult[] = (data.data || []).map((item) => ({
      pointId: item.point_id,
      docId: item.doc_id,
      score: item.score,
      content: item.content,
    }));

    return {
      success: true,
      results,
      total: results.length,
    };
  } catch (error) {
    return {
      success: false,
      results: [],
      total: 0,
      error: error instanceof Error ? error.message : "Network error",
    };
  }
}

/**
 * Format knowledge base results for AI context
 *
 * Converts search results into a markdown-formatted string
 * that provides context to the AI model.
 *
 * @param results - Search results to format
 * @returns Formatted string for AI context
 */
export function formatKnowledgeResultsForAI(
  results: KnowledgeBaseResult[],
): string {
  if (results.length === 0) {
    return "No relevant documents found in the knowledge base.";
  }

  return results
    .map((result, index) => {
      const score = Math.round(result.score * 100);
      return `[${index + 1}] (${score}% match)\n${result.content}`;
    })
    .join("\n\n---\n\n");
}

/**
 * System instruction for knowledge base usage
 *
 * Provides guidance to the AI on how to use the knowledge base tool.
 */
export const KNOWLEDGE_BASE_SYSTEM_INSTRUCTION = `
You have access to a knowledge base search tool. Use this tool to:
- Answer questions about the product, documentation, or company information
- Find specific information when asked about features, pricing, policies, etc.
- Retrieve relevant context before answering factual questions

When using knowledge base results:
- Cite the information when relevant
- If no results are found, acknowledge this and provide general guidance
- Combine knowledge base information with your general knowledge when helpful
`.trim();

// Re-export types for convenience
export type {
  KnowledgeBaseConfig,
  KnowledgeBaseResult,
  KnowledgeBaseSearchResponse,
};
