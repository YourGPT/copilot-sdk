import { useState, useEffect, useCallback } from "react";
import type { OpenRouterModel } from "@yourgpt/llm-sdk/openrouter";

interface UseOpenRouterModelsOptions {
  apiKey?: string;
  enabled?: boolean;
}

interface UseOpenRouterModelsResult {
  models: OpenRouterModel[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  search: (query: string) => OpenRouterModel[];
}

/**
 * Hook to fetch and search OpenRouter models
 */
export function useOpenRouterModels(
  options: UseOpenRouterModelsOptions = {},
): UseOpenRouterModelsResult {
  const { apiKey, enabled = true } = options;
  const [models, setModels] = useState<OpenRouterModel[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchModels = useCallback(async () => {
    if (!enabled) return;

    setIsLoading(true);
    setError(null);

    try {
      const headers: Record<string, string> = {};
      if (apiKey) {
        headers["x-openrouter-key"] = apiKey;
      }

      const response = await fetch(`/playground/api/openrouter/models`, {
        headers,
      });
      const data = await response.json();

      if (data.success) {
        setModels(data.models);
      } else {
        setError(data.error || "Failed to fetch models");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }, [apiKey, enabled]);

  // Search models locally
  const search = useCallback(
    (query: string): OpenRouterModel[] => {
      if (!query) return models;

      const lowerQuery = query.toLowerCase();
      return models.filter(
        (model) =>
          model.id.toLowerCase().includes(lowerQuery) ||
          model.name.toLowerCase().includes(lowerQuery),
      );
    },
    [models],
  );

  // Fetch on mount or when apiKey changes
  useEffect(() => {
    fetchModels();
  }, [fetchModels]);

  return {
    models,
    isLoading,
    error,
    refetch: fetchModels,
    search,
  };
}
