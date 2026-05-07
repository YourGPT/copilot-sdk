/**
 * xAI Provider
 *
 * xAI's Grok models are cutting-edge AI models with vision and tool support.
 *
 * Features:
 * - Vision (images)
 * - Tools/Function calling
 * - Real-time information (trained on X/Twitter data)
 * - Ultra-fast inference
 */

// NEW: Modern pattern - xai() function
export { xai, createXAI as createXAIModel } from "./provider";
export type { XAIProviderOptions } from "./provider";

import { createXAIAdapter } from "../../adapters/xai";
import {
  createCallableProvider,
  type AIProvider,
  type ProviderCapabilities,
  type XAIProviderConfig,
} from "../types";

// ============================================
// Model Definitions
// ============================================

interface ModelCapabilities {
  vision: boolean;
  tools: boolean;
  maxTokens: number;
  outputTokens: number;
}

const XAI_MODELS: Record<string, ModelCapabilities> = {
  // Grok 4.1 Fast (Latest - December 2025)
  "grok-4-1-fast-reasoning": {
    vision: false,
    tools: true,
    maxTokens: 2000000,
    outputTokens: 16384,
  },
  "grok-4-1-fast-non-reasoning": {
    vision: false,
    tools: true,
    maxTokens: 2000000,
    outputTokens: 16384,
  },

  // Grok 4 Fast (September 2025)
  "grok-4-fast-reasoning": {
    vision: false,
    tools: true,
    maxTokens: 2000000,
    outputTokens: 16384,
  },
  "grok-4-fast-non-reasoning": {
    vision: false,
    tools: true,
    maxTokens: 2000000,
    outputTokens: 16384,
  },

  // Grok 4 (July 2025)
  "grok-4": {
    vision: true,
    tools: true,
    maxTokens: 256000,
    outputTokens: 16384,
  },
  "grok-4-0709": {
    vision: true,
    tools: true,
    maxTokens: 256000,
    outputTokens: 16384,
  },

  // Grok 3 (February 2025) - Stable
  "grok-3-beta": {
    vision: true,
    tools: true,
    maxTokens: 131072,
    outputTokens: 8192,
  },
  "grok-3-fast": {
    vision: false,
    tools: true,
    maxTokens: 131072,
    outputTokens: 8192,
  },
  "grok-3-mini-beta": {
    vision: false,
    tools: true,
    maxTokens: 32768,
    outputTokens: 8192,
  },
  "grok-3-mini-fast-beta": {
    vision: false,
    tools: true,
    maxTokens: 32768,
    outputTokens: 8192,
  },

  // Grok Code Fast (August 2025)
  "grok-code-fast-1": {
    vision: false,
    tools: true,
    maxTokens: 256000,
    outputTokens: 16384,
  },

  // Grok 2 (Legacy - for backward compatibility)
  "grok-2": {
    vision: true,
    tools: true,
    maxTokens: 131072,
    outputTokens: 4096,
  },
  "grok-2-latest": {
    vision: true,
    tools: true,
    maxTokens: 131072,
    outputTokens: 4096,
  },
  "grok-2-mini": {
    vision: false,
    tools: true,
    maxTokens: 131072,
    outputTokens: 4096,
  },
};

// ============================================
// Provider Implementation
// ============================================

/**
 * Create an xAI provider (callable, Vercel AI SDK style)
 *
 * @example
 * ```typescript
 * const xai = createXAI({ apiKey: '...' });
 *
 * // Callable - Vercel AI SDK style
 * const model = xai('grok-2');
 *
 * // Also supports method call (backward compatible)
 * const model2 = xai.languageModel('grok-2');
 *
 * // Check capabilities
 * const caps = xai.getCapabilities('grok-2');
 * ```
 */
export function createXAI(config: XAIProviderConfig = {}): AIProvider {
  const apiKey = config.apiKey ?? process.env.XAI_API_KEY ?? "";

  // Create the callable function
  const providerFn = (modelId: string) => {
    return createXAIAdapter({
      apiKey,
      model: modelId,
      baseUrl: config.baseUrl,
    });
  };

  // Get capabilities helper
  const getCapabilities = (modelId: string): ProviderCapabilities => {
    const model = XAI_MODELS[modelId] ?? XAI_MODELS["grok-3-fast"];

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
      // xAI accepts OpenAI-compatible `response_format` on grok-2-1212+.
      supportsJsonMode: true,
      supportsSystemMessages: true,
    };
  };

  return createCallableProvider(providerFn, {
    name: "xai",
    supportedModels: Object.keys(XAI_MODELS),
    getCapabilities,
  });
}

// Alias for consistency
export const createXAIProvider = createXAI;
