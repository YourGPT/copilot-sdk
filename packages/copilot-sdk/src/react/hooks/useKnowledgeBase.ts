"use client";

/**
 * Knowledge Base Hook
 *
 * Registers a hidden knowledge base search tool that the AI can use
 * to search your project's trained knowledge base.
 *
 * @see https://docs.yourgpt.ai/chatbot/developer-guide/api-reference/chatbot/searchIndexDocument
 */

import { useEffect, useRef, useCallback } from "react";
import { useCopilot } from "../provider/CopilotProvider";
import {
  searchKnowledgeBase,
  formatKnowledgeResultsForAI,
} from "../utils/knowledge-base";
import type {
  KnowledgeBaseConfig,
  KnowledgeBaseResult,
  KnowledgeBaseSearchResponse,
} from "../../core";

/**
 * Default tool name for knowledge base search
 */
const DEFAULT_TOOL_NAME = "search_knowledge";

/**
 * Default tool description
 */
const DEFAULT_TOOL_DESCRIPTION =
  "Search the knowledge base for relevant information about the product, documentation, or company. Use this to answer questions about features, pricing, policies, guides, or any factual information.";

/**
 * Hook to integrate knowledge base search as a hidden internal tool
 *
 * Registers a `search_knowledge` tool that the AI can use to search
 * the knowledge base. The tool is hidden from the UI but still executes.
 *
 * @param config - Knowledge base configuration
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   useKnowledgeBase({
 *     apiKey: "your-yourgpt-api-key",
 *     limit: 10,
 *   });
 *
 *   return <CopilotChat />;
 * }
 * ```
 */
export function useKnowledgeBase(config: KnowledgeBaseConfig): void {
  const { registerTool, unregisterTool } = useCopilot();
  const configRef = useRef(config);

  // Update config ref on changes
  configRef.current = config;

  // Search handler
  const handleSearch = useCallback(
    async (
      params: Record<string, unknown>,
    ): Promise<{
      success: boolean;
      message?: string;
      data?: unknown;
      error?: string;
    }> => {
      const query = params.query as string;
      if (!query) {
        return {
          success: false,
          error: "Query is required",
        };
      }

      const currentConfig = configRef.current;
      const response: KnowledgeBaseSearchResponse = await searchKnowledgeBase(
        query,
        currentConfig,
      );

      if (!response.success) {
        return {
          success: false,
          error: response.error || "Knowledge base search failed",
        };
      }

      const formattedResults = formatKnowledgeResultsForAI(response.results);

      return {
        success: true,
        message: formattedResults,
        data: {
          resultCount: response.results.length,
          total: response.total,
        },
      };
    },
    [],
  );

  // Register the tool
  useEffect(() => {
    if (config.enabled === false) {
      return;
    }

    const toolName = config.toolName || DEFAULT_TOOL_NAME;

    registerTool({
      name: toolName,
      description: config.toolDescription || DEFAULT_TOOL_DESCRIPTION,
      location: "client",
      // Hidden internal tool - executes but doesn't show in UI
      hidden: true,
      inputSchema: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description:
              "The search query to find relevant information in the knowledge base",
          },
        },
        required: ["query"],
      },
      handler: handleSearch,
    });

    return () => {
      unregisterTool(toolName);
    };
  }, [
    config.enabled,
    config.apiKey,
    config.toolName,
    config.toolDescription,
    registerTool,
    unregisterTool,
    handleSearch,
  ]);
}

/**
 * Standalone function to search knowledge base (without hook)
 *
 * Useful for manual searches outside of the tool system.
 */
export { searchKnowledgeBase, formatKnowledgeResultsForAI };
export type {
  KnowledgeBaseConfig,
  KnowledgeBaseResult,
  KnowledgeBaseSearchResponse,
};
