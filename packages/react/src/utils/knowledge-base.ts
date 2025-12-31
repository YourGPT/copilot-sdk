/**
 * Knowledge Base Search Utility
 *
 * Integrates with managed cloud knowledge base API to search indexed documents.
 */

import type {
  InternalKnowledgeBaseConfig,
  InternalKnowledgeBaseResult,
  InternalKnowledgeBaseSearchResponse,
} from "@yourgpt/copilot-sdk-core";

const KNOWLEDGE_BASE_API =
  "https://api.yourgpt.ai/chatbot/v1/searchIndexDocument";

// Re-export types for convenience
export type KnowledgeBaseResult = InternalKnowledgeBaseResult;
export type KnowledgeBaseConfig = InternalKnowledgeBaseConfig;

// Extended response with page info (client-side specific)
export interface KnowledgeBaseSearchResponse extends InternalKnowledgeBaseSearchResponse {
  page?: number;
}

/**
 * Search the knowledge base
 *
 * @param query - Search query string
 * @param config - Knowledge base configuration
 * @returns Search results
 */
export async function searchKnowledgeBase(
  query: string,
  config: KnowledgeBaseConfig,
): Promise<KnowledgeBaseSearchResponse> {
  try {
    const response = await fetch(KNOWLEDGE_BASE_API, {
      method: "POST",
      headers: {
        accept: "*/*",
        "content-type": "application/json",
        authorization: `Bearer ${config.token}`,
      },
      body: JSON.stringify({
        project_uid: config.projectUid,
        query: query,
        page: 1,
        limit: String(config.limit || 10),
        app_id: config.appId || "1",
      }),
    });

    if (!response.ok) {
      return {
        success: false,
        results: [],
        error: `API error: ${response.status} ${response.statusText}`,
      };
    }

    const data = await response.json();

    // Transform API response to our format
    // Adjust based on actual API response structure
    const results: KnowledgeBaseResult[] = (
      data.data ||
      data.results ||
      []
    ).map((item: Record<string, unknown>) => ({
      id: item.id || item._id || String(Math.random()),
      title: item.title || item.name || undefined,
      content: item.content || item.text || item.snippet || "",
      score: item.score || item.relevance || undefined,
      url: item.url || item.source_url || undefined,
      metadata: item.metadata || {},
    }));

    return {
      success: true,
      results,
      total: data.total || results.length,
      page: data.page || 1,
    };
  } catch (error) {
    return {
      success: false,
      results: [],
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Format knowledge base results for AI context
 */
export function formatKnowledgeResultsForAI(
  results: KnowledgeBaseResult[],
): string {
  if (results.length === 0) {
    return "No relevant documents found in the knowledge base.";
  }

  return results
    .map((result, index) => {
      const parts = [`[${index + 1}]`];
      if (result.title) parts.push(`**${result.title}**`);
      parts.push(result.content);
      if (result.url) parts.push(`Source: ${result.url}`);
      return parts.join("\n");
    })
    .join("\n\n---\n\n");
}

/**
 * System instruction for knowledge base usage
 */
export const KNOWLEDGE_BASE_SYSTEM_INSTRUCTION = `
You have access to a knowledge base tool called "search_knowledge". Use this tool to:
- Answer questions about the product, documentation, or company information
- Find specific information when the user asks about features, pricing, policies, etc.
- Retrieve relevant context before answering factual questions

When using knowledge base results:
- Cite the information source when relevant
- If no results are found, acknowledge this and provide general guidance
- Combine knowledge base information with your general knowledge when helpful
`.trim();
