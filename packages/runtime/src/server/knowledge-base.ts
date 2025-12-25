/**
 * Knowledge Base Search Utility (Server-Side)
 *
 * Integrates with YourGPT's knowledge base API to search indexed documents.
 * This runs on the server, keeping API tokens secure.
 */

import type {
  YourGPTKnowledgeBaseConfig,
  YourGPTKnowledgeBaseResult,
  YourGPTKnowledgeBaseSearchResponse,
} from "@yourgpt/core";

const KNOWLEDGE_BASE_API =
  "https://api.yourgpt.ai/chatbot/v1/searchIndexDocument";

// Re-export types from core with shorter aliases for convenience
export type YourGPTKBConfig = YourGPTKnowledgeBaseConfig;
export type KBSearchResult = YourGPTKnowledgeBaseResult;
export type KBSearchResponse = YourGPTKnowledgeBaseSearchResponse;

/**
 * Search the YourGPT knowledge base
 *
 * @param query - Search query string
 * @param config - YourGPT KB configuration
 * @returns Search results
 */
export async function searchKnowledgeBase(
  query: string,
  config: YourGPTKBConfig,
): Promise<KBSearchResponse> {
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
        limit: String(config.limit || 5),
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

    const data = (await response.json()) as {
      data?: Array<Record<string, unknown>>;
      results?: Array<Record<string, unknown>>;
      total?: number;
    };

    // Transform API response to our format
    const results: KBSearchResult[] = (data.data || data.results || []).map(
      (item: Record<string, unknown>) => ({
        id:
          (item.id as string) || (item._id as string) || String(Math.random()),
        title: (item.title as string) || (item.name as string) || undefined,
        content:
          (item.content as string) ||
          (item.text as string) ||
          (item.snippet as string) ||
          "",
        score:
          (item.score as number) || (item.relevance as number) || undefined,
        url: (item.url as string) || (item.source_url as string) || undefined,
        metadata: (item.metadata as Record<string, unknown>) || {},
      }),
    );

    return {
      success: true,
      results,
      total: data.total || results.length,
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
export function formatKnowledgeResultsForAI(results: KBSearchResult[]): string {
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
