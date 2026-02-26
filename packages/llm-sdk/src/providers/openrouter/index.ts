/**
 * OpenRouter Provider
 *
 * OpenRouter is a unified API gateway that provides access to 500+ AI models
 * from 60+ providers (OpenAI, Anthropic, Google, Meta, Mistral, etc.)
 * through a single endpoint.
 *
 * Features:
 * - Single API key for all models
 * - Automatic fallbacks and routing
 * - Cost optimization
 * - Provider preferences
 * - OpenAI-compatible API
 *
 * @see https://openrouter.ai/docs
 */

// NEW: Modern pattern - openrouter() function
export {
  openrouter,
  createOpenRouter as createOpenRouterModel,
  fetchOpenRouterModels,
  searchOpenRouterModels,
} from "./provider";
export type { OpenRouterProviderOptions, OpenRouterModel } from "./provider";

import { createOpenAIAdapter } from "../../adapters/openai";
import {
  createCallableProvider,
  type AIProvider,
  type ProviderCapabilities,
} from "../types";

// ============================================
// Model Capabilities
// ============================================

/**
 * OpenRouter supports 500+ models dynamically.
 * Use fetchOpenRouterModels() to get live model list with accurate capabilities.
 * This default is used as fallback for all models.
 */
const DEFAULT_CAPABILITIES = {
  vision: true,
  tools: true,
  jsonMode: true,
  maxTokens: 128000,
};

// ============================================
// Provider Config
// ============================================

export interface OpenRouterProviderConfig {
  /** API key (defaults to OPENROUTER_API_KEY env var) */
  apiKey?: string;
  /** Base URL for API */
  baseUrl?: string;
  /** Your site URL for OpenRouter rankings */
  siteUrl?: string;
  /** Your app name for OpenRouter rankings */
  appName?: string;
}

// ============================================
// Provider Implementation
// ============================================

/**
 * Create an OpenRouter provider (callable, Vercel AI SDK style)
 *
 * @example
 * ```typescript
 * const or = createOpenRouter({ apiKey: '...' });
 *
 * // Callable - Vercel AI SDK style
 * const model = or('anthropic/claude-3.5-sonnet');
 *
 * // Also supports method call (backward compatible)
 * const model2 = or.languageModel('openai/gpt-4o');
 *
 * // Check capabilities
 * const caps = or.getCapabilities('anthropic/claude-3.5-sonnet');
 * ```
 */
export function createOpenRouter(
  config: OpenRouterProviderConfig = {},
): AIProvider {
  const apiKey = config.apiKey ?? process.env.OPENROUTER_API_KEY ?? "";
  const baseUrl = config.baseUrl ?? "https://openrouter.ai/api/v1";

  // Create the callable function - uses OpenAI adapter since OpenRouter is OpenAI-compatible
  const providerFn = (modelId: string) => {
    return createOpenAIAdapter({
      apiKey,
      model: modelId,
      baseUrl,
    });
  };

  // Get capabilities helper - uses default capabilities for all models
  // Use fetchOpenRouterModels() to get accurate model-specific capabilities
  const getCapabilities = (modelId: string): ProviderCapabilities => {
    return {
      supportsVision: DEFAULT_CAPABILITIES.vision,
      supportsTools: DEFAULT_CAPABILITIES.tools,
      supportsThinking: false,
      supportsStreaming: true,
      supportsPDF: false,
      supportsAudio: false,
      supportsVideo: false,
      maxTokens: DEFAULT_CAPABILITIES.maxTokens,
      supportedImageTypes: DEFAULT_CAPABILITIES.vision
        ? ["image/png", "image/jpeg", "image/gif", "image/webp"]
        : [],
      supportsJsonMode: DEFAULT_CAPABILITIES.jsonMode,
      supportsSystemMessages: true,
    };
  };

  return createCallableProvider(providerFn, {
    name: "openrouter",
    supportedModels: [], // Use fetchOpenRouterModels() to get live model list
    getCapabilities,
  });
}

// Alias for consistency
export const createOpenRouterProvider = createOpenRouter;
