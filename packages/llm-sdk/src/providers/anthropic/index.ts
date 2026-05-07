/**
 * Anthropic Provider
 *
 * Modern pattern: anthropic('claude-3-5-sonnet') returns a LanguageModel
 * Legacy pattern: createAnthropic({ apiKey }) returns an AIProvider
 */

// NEW: Modern pattern - anthropic() function
export { anthropic, createAnthropic as createAnthropicModel } from "./provider";
export type { AnthropicProviderOptions } from "./provider";

import { createAnthropicAdapter } from "../../adapters/anthropic";
import {
  createCallableProvider,
  type AIProvider,
  type ProviderCapabilities,
  type AnthropicProviderConfig,
} from "../types";

// ============================================
// Model Definitions
// ============================================

interface ModelCapabilities {
  vision: boolean;
  tools: boolean;
  thinking: boolean;
  maxTokens: number;
}

const ANTHROPIC_MODELS: Record<string, ModelCapabilities> = {
  // Claude 4 series (latest)
  "claude-sonnet-4-20250514": {
    vision: true,
    tools: true,
    thinking: true,
    maxTokens: 64000,
  },
  "claude-opus-4-20250514": {
    vision: true,
    tools: true,
    thinking: true,
    maxTokens: 32000,
  },

  // Claude 3.5 series
  "claude-3-5-sonnet-latest": {
    vision: true,
    tools: true,
    thinking: true,
    maxTokens: 200000,
  },
  "claude-3-5-sonnet-20241022": {
    vision: true,
    tools: true,
    thinking: true,
    maxTokens: 200000,
  },
  "claude-3-5-haiku-latest": {
    vision: true,
    tools: true,
    thinking: false,
    maxTokens: 200000,
  },
  "claude-3-5-haiku-20241022": {
    vision: true,
    tools: true,
    thinking: false,
    maxTokens: 200000,
  },

  // Claude 3 series
  "claude-3-opus-latest": {
    vision: true,
    tools: true,
    thinking: true,
    maxTokens: 200000,
  },
  "claude-3-opus-20240229": {
    vision: true,
    tools: true,
    thinking: true,
    maxTokens: 200000,
  },
  "claude-3-sonnet-20240229": {
    vision: true,
    tools: true,
    thinking: false,
    maxTokens: 200000,
  },
  "claude-3-haiku-20240307": {
    vision: true,
    tools: true,
    thinking: false,
    maxTokens: 200000,
  },
};

// ============================================
// Provider Implementation
// ============================================

/**
 * Create an Anthropic provider (callable, Vercel AI SDK style)
 *
 * @example
 * ```typescript
 * const anthropic = createAnthropic({
 *   apiKey: '...',
 *   thinkingBudget: 10000, // Enable extended thinking
 * });
 *
 * // Callable - Vercel AI SDK style
 * const model = anthropic('claude-sonnet-4-20250514');
 *
 * // Also supports method call (backward compatible)
 * const model2 = anthropic.languageModel('claude-sonnet-4-20250514');
 *
 * // Check capabilities
 * const caps = anthropic.getCapabilities('claude-sonnet-4-20250514');
 * ```
 */
export function createAnthropic(
  config: AnthropicProviderConfig = {},
): AIProvider {
  const apiKey = config.apiKey ?? process.env.ANTHROPIC_API_KEY ?? "";

  // Create the callable function
  const providerFn = (modelId: string) => {
    return createAnthropicAdapter({
      apiKey,
      model: modelId,
      baseUrl: config.baseUrl,
      thinking: config.thinkingBudget
        ? { type: "enabled", budgetTokens: config.thinkingBudget }
        : undefined,
    });
  };

  // Get capabilities helper
  const getCapabilities = (modelId: string): ProviderCapabilities => {
    const model =
      ANTHROPIC_MODELS[modelId] ?? ANTHROPIC_MODELS["claude-3-5-sonnet-latest"];

    return {
      supportsVision: model.vision,
      supportsTools: model.tools,
      supportsThinking: model.thinking,
      supportsStreaming: true,
      supportsPDF: true,
      supportsAudio: false,
      supportsVideo: false,
      maxTokens: model.maxTokens,
      supportedImageTypes: [
        "image/png",
        "image/jpeg",
        "image/gif",
        "image/webp",
      ],
      // Native `output_config.format` — GA on Claude 3.5 and newer.
      supportsJsonMode: true,
      supportsSystemMessages: true,
    };
  };

  return createCallableProvider(providerFn, {
    name: "anthropic",
    supportedModels: Object.keys(ANTHROPIC_MODELS),
    getCapabilities,
  });
}

// Alias for consistency
export const createAnthropicProvider = createAnthropic;
