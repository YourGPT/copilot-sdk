/**
 * xAI Provider
 *
 * Wraps the XAIAdapter with provider interface.
 * xAI's Grok models are cutting-edge AI models with vision and tool support.
 *
 * Features:
 * - Vision (images)
 * - Tools/Function calling
 * - Real-time information (trained on X/Twitter data)
 */

import { createXAIAdapter } from "../../adapters/xai";
import type {
  AIProvider,
  ProviderCapabilities,
  XAIProviderConfig,
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
  // Grok 2 series (latest)
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
  "grok-2-mini-latest": {
    vision: false,
    tools: true,
    maxTokens: 131072,
    outputTokens: 4096,
  },

  // Grok Vision
  "grok-2-vision": {
    vision: true,
    tools: true,
    maxTokens: 32768,
    outputTokens: 4096,
  },
  "grok-2-vision-latest": {
    vision: true,
    tools: true,
    maxTokens: 32768,
    outputTokens: 4096,
  },

  // Grok Beta (legacy)
  "grok-beta": {
    vision: false,
    tools: true,
    maxTokens: 131072,
    outputTokens: 4096,
  },
  "grok-vision-beta": {
    vision: true,
    tools: true,
    maxTokens: 8192,
    outputTokens: 4096,
  },
};

// ============================================
// Provider Implementation
// ============================================

/**
 * Create an xAI provider
 *
 * @example
 * ```typescript
 * const xai = createXAI({
 *   apiKey: '...',
 * });
 * const adapter = xai.languageModel('grok-2');
 * const caps = xai.getCapabilities('grok-2');
 * ```
 */
export function createXAI(config: XAIProviderConfig = {}): AIProvider {
  const apiKey = config.apiKey ?? process.env.XAI_API_KEY ?? "";

  return {
    name: "xai",
    supportedModels: Object.keys(XAI_MODELS),

    languageModel(modelId: string) {
      return createXAIAdapter({
        apiKey,
        model: modelId,
        baseUrl: config.baseUrl,
      });
    },

    getCapabilities(modelId: string): ProviderCapabilities {
      const model = XAI_MODELS[modelId] ?? XAI_MODELS["grok-2"];

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
        supportsJsonMode: false, // xAI doesn't support JSON mode yet
        supportsSystemMessages: true,
      };
    },
  };
}

// Alias for consistency
export const createXAIProvider = createXAI;
