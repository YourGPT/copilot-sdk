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
// Model Definitions
// ============================================

interface ModelCapabilities {
  vision: boolean;
  tools: boolean;
  jsonMode: boolean;
  maxTokens: number;
}

/**
 * Popular OpenRouter models with known capabilities.
 * OpenRouter supports 500+ models - use any valid model ID.
 */
const OPENROUTER_MODELS: Record<string, ModelCapabilities> = {
  // OpenAI GPT-5.x (Current - 2026)
  "openai/gpt-5.2-pro": {
    vision: true,
    tools: true,
    jsonMode: true,
    maxTokens: 400000,
  },
  "openai/gpt-5.2": {
    vision: true,
    tools: true,
    jsonMode: true,
    maxTokens: 400000,
  },
  "openai/gpt-5.2-chat": {
    vision: true,
    tools: true,
    jsonMode: true,
    maxTokens: 400000,
  },
  "openai/gpt-5.1-codex": {
    vision: true,
    tools: true,
    jsonMode: true,
    maxTokens: 300000,
  },
  "openai/gpt-5.1": {
    vision: true,
    tools: true,
    jsonMode: true,
    maxTokens: 300000,
  },

  // Anthropic Claude 4.x (Current - 2026)
  "anthropic/claude-opus-4.6": {
    vision: true,
    tools: true,
    jsonMode: true,
    maxTokens: 1000000,
  },
  "anthropic/claude-opus-4.5": {
    vision: true,
    tools: true,
    jsonMode: true,
    maxTokens: 1000000,
  },
  "anthropic/claude-sonnet-4": {
    vision: true,
    tools: true,
    jsonMode: true,
    maxTokens: 200000,
  },
  "anthropic/claude-3.5-sonnet": {
    vision: true,
    tools: true,
    jsonMode: true,
    maxTokens: 200000,
  },
  "anthropic/claude-3-5-haiku": {
    vision: true,
    tools: true,
    jsonMode: true,
    maxTokens: 200000,
  },
  "anthropic/claude-3-opus": {
    vision: true,
    tools: true,
    jsonMode: true,
    maxTokens: 200000,
  },
  "anthropic/claude-3-haiku": {
    vision: true,
    tools: true,
    jsonMode: true,
    maxTokens: 200000,
  },

  // Google Gemini 3.x & 2.x (Current - 2026)
  "google/gemini-3-pro-preview": {
    vision: true,
    tools: true,
    jsonMode: true,
    maxTokens: 1048576,
  },
  "google/gemini-3-flash-preview": {
    vision: true,
    tools: true,
    jsonMode: true,
    maxTokens: 1048576,
  },
  "google/gemini-2.5-pro": {
    vision: true,
    tools: true,
    jsonMode: true,
    maxTokens: 1048576,
  },
  "google/gemini-2.5-flash": {
    vision: true,
    tools: true,
    jsonMode: true,
    maxTokens: 1048576,
  },
  "google/gemini-pro-1.5": {
    vision: true,
    tools: true,
    jsonMode: true,
    maxTokens: 1000000,
  },
  "google/gemini-flash-1.5": {
    vision: true,
    tools: true,
    jsonMode: true,
    maxTokens: 1000000,
  },

  // xAI Grok 4.x (Current - 2026)
  "x-ai/grok-4.1-fast": {
    vision: true,
    tools: true,
    jsonMode: true,
    maxTokens: 131072,
  },
  "x-ai/grok-4-fast-reasoning": {
    vision: true,
    tools: true,
    jsonMode: true,
    maxTokens: 131072,
  },
  "x-ai/grok-3-mini-beta": {
    vision: true,
    tools: true,
    jsonMode: true,
    maxTokens: 131072,
  },
  "x-ai/grok-3-fast": {
    vision: true,
    tools: true,
    jsonMode: true,
    maxTokens: 131072,
  },

  // Meta Llama 3.x
  "meta-llama/llama-3.3-70b-instruct": {
    vision: false,
    tools: true,
    jsonMode: true,
    maxTokens: 131072,
  },
  "meta-llama/llama-3.1-405b-instruct": {
    vision: false,
    tools: true,
    jsonMode: true,
    maxTokens: 131072,
  },
  "meta-llama/llama-3.1-70b-instruct": {
    vision: false,
    tools: true,
    jsonMode: true,
    maxTokens: 131072,
  },

  // DeepSeek (Current - 2026)
  "deepseek/deepseek-chat-v3": {
    vision: false,
    tools: true,
    jsonMode: true,
    maxTokens: 64000,
  },
  "deepseek/deepseek-r1": {
    vision: false,
    tools: true,
    jsonMode: true,
    maxTokens: 64000,
  },
  "deepseek/deepseek-r1:free": {
    vision: false,
    tools: true,
    jsonMode: true,
    maxTokens: 64000,
  },

  // Mistral (Current - 2026)
  "mistralai/mistral-large-2411": {
    vision: false,
    tools: true,
    jsonMode: true,
    maxTokens: 128000,
  },
  "mistralai/mixtral-8x7b-instruct": {
    vision: false,
    tools: true,
    jsonMode: true,
    maxTokens: 32768,
  },

  // OpenRouter Auto (magic model - picks best for your prompt)
  "openrouter/auto": {
    vision: true,
    tools: true,
    jsonMode: true,
    maxTokens: 128000,
  },
};

// Default for unknown models
const DEFAULT_CAPABILITIES: ModelCapabilities = {
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

  // Get capabilities helper
  const getCapabilities = (modelId: string): ProviderCapabilities => {
    const model = OPENROUTER_MODELS[modelId] ?? DEFAULT_CAPABILITIES;

    return {
      supportsVision: model.vision,
      supportsTools: model.tools,
      supportsThinking: false,
      supportsStreaming: true,
      supportsPDF: false,
      supportsAudio: false,
      supportsVideo: false,
      maxTokens: model.maxTokens,
      supportedImageTypes: model.vision
        ? ["image/png", "image/jpeg", "image/gif", "image/webp"]
        : [],
      supportsJsonMode: model.jsonMode,
      supportsSystemMessages: true,
    };
  };

  return createCallableProvider(providerFn, {
    name: "openrouter",
    supportedModels: Object.keys(OPENROUTER_MODELS),
    getCapabilities,
  });
}

// Alias for consistency
export const createOpenRouterProvider = createOpenRouter;
