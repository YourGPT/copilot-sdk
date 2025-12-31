"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type { Source } from "@yourgpt/copilot-sdk-core";
import {
  KnowledgeBase,
  type KnowledgeBaseConfig,
  type SearchOptions,
} from "../client/yourgpt-api";

/**
 * useKnowledgeBase options
 */
export interface UseKnowledgeBaseOptions extends KnowledgeBaseConfig {
  /** Auto-search when query changes */
  autoSearch?: boolean;
  /** Debounce delay for auto-search (ms) */
  debounceMs?: number;
  /** Default search options */
  defaultSearchOptions?: SearchOptions;
}

/**
 * useKnowledgeBase return type
 */
export interface UseKnowledgeBaseReturn {
  /** Search the knowledge base */
  search: (query: string, options?: SearchOptions) => Promise<Source[]>;
  /** Current sources from last search */
  sources: Source[];
  /** Whether a search is in progress */
  isSearching: boolean;
  /** Last error if any */
  error: Error | null;
  /** Clear sources */
  clearSources: () => void;
  /** The knowledge base client */
  client: KnowledgeBase;
}

/**
 * Hook for interacting with Knowledge Base
 *
 * @example
 * ```tsx
 * const { search, sources, isSearching } = useKnowledgeBase({
 *   apiKey: 'yg_...',
 *   botId: 'bot_123',
 * });
 *
 * // Search manually
 * const results = await search('How to reset password?');
 *
 * // Display sources
 * {sources.map(source => (
 *   <div key={source.id}>{source.title}</div>
 * ))}
 * ```
 */
export function useKnowledgeBase(
  options: UseKnowledgeBaseOptions,
): UseKnowledgeBaseReturn {
  const {
    apiKey,
    botId,
    endpoint,
    autoSearch = false,
    debounceMs = 300,
    defaultSearchOptions,
  } = options;

  const [sources, setSources] = useState<Source[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Create client ref (persists across renders)
  const clientRef = useRef<KnowledgeBase | null>(null);

  // Initialize client
  if (!clientRef.current) {
    clientRef.current = new KnowledgeBase({
      apiKey,
      botId,
      endpoint,
    });
  }

  // Update client if config changes
  useEffect(() => {
    clientRef.current = new KnowledgeBase({
      apiKey,
      botId,
      endpoint,
    });
  }, [apiKey, botId, endpoint]);

  // Search function
  const search = useCallback(
    async (query: string, searchOptions?: SearchOptions): Promise<Source[]> => {
      if (!query.trim()) {
        return [];
      }

      setIsSearching(true);
      setError(null);

      try {
        const result = await clientRef.current!.search(query, {
          ...defaultSearchOptions,
          ...searchOptions,
        });

        setSources(result.sources);
        return result.sources;
      } catch (err) {
        const error = err instanceof Error ? err : new Error("Search failed");
        setError(error);
        return [];
      } finally {
        setIsSearching(false);
      }
    },
    [defaultSearchOptions],
  );

  // Clear sources
  const clearSources = useCallback(() => {
    setSources([]);
    setError(null);
  }, []);

  return {
    search,
    sources,
    isSearching,
    error,
    clearSources,
    client: clientRef.current!,
  };
}
