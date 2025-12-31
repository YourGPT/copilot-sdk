"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { useCopilotContext } from "../context/CopilotContext";

/**
 * Suggestion item
 */
export interface Suggestion {
  /** Suggestion text */
  text: string;
  /** Optional icon */
  icon?: string;
}

/**
 * useSuggestions options
 */
export interface UseSuggestionsOptions {
  /** Number of suggestions to show */
  count?: number;
  /** Context for generating suggestions */
  context?: string;
  /** Static suggestions (if not using AI-generated) */
  suggestions?: Suggestion[] | string[];
  /** Auto-refresh on conversation change */
  autoRefresh?: boolean;
}

/**
 * useSuggestions return type
 */
export interface UseSuggestionsReturn {
  /** Current suggestions */
  suggestions: Suggestion[];
  /** Whether suggestions are loading */
  isLoading: boolean;
  /** Refresh suggestions */
  refresh: () => Promise<void>;
  /** Select a suggestion (sends as message) */
  select: (suggestion: Suggestion | string) => void;
}

/**
 * Hook for chat suggestions
 *
 * @example
 * ```tsx
 * const { suggestions, select } = useSuggestions({
 *   count: 3,
 *   context: 'Help users with product questions',
 * });
 *
 * return (
 *   <div>
 *     {suggestions.map((s, i) => (
 *       <button key={i} onClick={() => select(s)}>{s.text}</button>
 *     ))}
 *   </div>
 * );
 * ```
 */
export function useSuggestions(
  options: UseSuggestionsOptions = {},
): UseSuggestionsReturn {
  const {
    count = 3,
    context,
    suggestions: staticSuggestions,
    autoRefresh = true,
  } = options;

  const { chat, actions, config } = useCopilotContext();
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Normalize static suggestions (memoized to prevent infinite loops)
  const normalizedStatic = useMemo(
    () =>
      staticSuggestions?.map((s) => (typeof s === "string" ? { text: s } : s)),
    [staticSuggestions],
  );

  // Refresh suggestions from API
  const refresh = useCallback(async () => {
    // If static suggestions provided, use those
    if (normalizedStatic) {
      setSuggestions(normalizedStatic.slice(0, count));
      return;
    }

    // Skip if no cloud config
    if (!config.cloud) {
      return;
    }

    setIsLoading(true);

    try {
      const endpoint = config.cloud.endpoint || "https://api.yourgpt.ai/v1";
      const response = await fetch(`${endpoint}/suggestions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.cloud.apiKey}`,
        },
        body: JSON.stringify({
          botId: config.cloud.botId,
          count,
          context,
          messages: chat.messages.slice(-5), // Last 5 messages for context
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setSuggestions(
          data.suggestions.map((s: string | Suggestion) =>
            typeof s === "string" ? { text: s } : s,
          ),
        );
      }
    } catch (error) {
      console.error("Failed to fetch suggestions:", error);
    } finally {
      setIsLoading(false);
    }
  }, [config.cloud, count, context, chat.messages, normalizedStatic]);

  // Select a suggestion
  const select = useCallback(
    (suggestion: Suggestion | string) => {
      const text =
        typeof suggestion === "string" ? suggestion : suggestion.text;
      actions.sendMessage(text);
    },
    [actions],
  );

  // Auto-refresh on conversation start or change
  useEffect(() => {
    if (autoRefresh && chat.messages.length === 0) {
      refresh();
    }
  }, [autoRefresh, chat.messages.length, refresh]);

  return {
    suggestions: normalizedStatic?.slice(0, count) || suggestions,
    isLoading,
    refresh,
    select,
  };
}
