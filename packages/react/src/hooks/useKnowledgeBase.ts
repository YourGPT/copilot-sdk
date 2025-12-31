"use client";

import { useEffect, useRef, useCallback } from "react";
import { useCopilotContext } from "../context/CopilotContext";
import {
  searchKnowledgeBase,
  formatKnowledgeResultsForAI,
  type KnowledgeBaseConfig,
  type KnowledgeBaseResult,
  type KnowledgeBaseSearchResponse,
} from "../utils/knowledge-base";

/**
 * Hook configuration for knowledge base
 */
export interface UseKnowledgeBaseConfig {
  /** Project UID for the knowledge base */
  projectUid: string;
  /** Auth token for API calls */
  token: string;
  /** App ID (default: "1") */
  appId?: string;
  /** Results limit (default: 5) */
  limit?: number;
  /** Whether to enable the tool (default: true) */
  enabled?: boolean;
}

/**
 * Hook to integrate knowledge base search as a tool
 *
 * Registers a `search_knowledge` tool that the AI can use to search
 * the knowledge base for relevant information.
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   useKnowledgeBase({
 *     projectUid: "your-project-uid",
 *     token: "your-auth-token",
 *   });
 *
 *   return <CopilotChat />;
 * }
 * ```
 */
export function useKnowledgeBase(config: UseKnowledgeBaseConfig): void {
  const { registerTool, unregisterTool } = useCopilotContext();
  const configRef = useRef(config);

  // Update config ref
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

      const kbConfig: KnowledgeBaseConfig = {
        projectUid: currentConfig.projectUid,
        token: currentConfig.token,
        appId: currentConfig.appId,
        limit: currentConfig.limit || 5,
      };

      const response: KnowledgeBaseSearchResponse = await searchKnowledgeBase(
        query,
        kbConfig,
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

    registerTool({
      name: "search_knowledge",
      description:
        "Search the knowledge base for relevant information about the product, documentation, or company. Use this to answer questions about features, pricing, policies, guides, or any factual information.",
      location: "client",
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
      unregisterTool("search_knowledge");
    };
  }, [
    config.enabled,
    config.projectUid,
    config.token,
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
