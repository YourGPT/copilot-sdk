/**
 * Groq Provider
 *
 * Wraps the existing GroqAdapter with provider interface.
 * Groq provides fast inference for open-source models.
 */

import { createGroqAdapter } from "../../adapters/groq";
import type {
  AIProvider,
  ProviderCapabilities,
  GroqProviderConfig,
} from "../types";

// ============================================
// Model Definitions
// ============================================

interface ModelCapabilities {
  vision: boolean;
  tools: boolean;
  maxTokens: number;
}

const GROQ_MODELS: Record<string, ModelCapabilities> = {
  // Llama 3.3 series
  "llama-3.3-70b-versatile": {
    vision: false,
    tools: true,
    maxTokens: 32768,
  },
  "llama-3.3-70b-specdec": {
    vision: false,
    tools: true,
    maxTokens: 8192,
  },

  // Llama 3.2 Vision series
  "llama-3.2-90b-vision-preview": {
    vision: true,
    tools: true,
    maxTokens: 8192,
  },
  "llama-3.2-11b-vision-preview": {
    vision: true,
    tools: true,
    maxTokens: 8192,
  },

  // Llama 3.1 series
  "llama-3.1-70b-versatile": {
    vision: false,
    tools: true,
    maxTokens: 32768,
  },
  "llama-3.1-8b-instant": {
    vision: false,
    tools: true,
    maxTokens: 8192,
  },

  // Mixtral series
  "mixtral-8x7b-32768": {
    vision: false,
    tools: true,
    maxTokens: 32768,
  },

  // Gemma series
  "gemma2-9b-it": {
    vision: false,
    tools: false,
    maxTokens: 8192,
  },

  // DeepSeek
  "deepseek-r1-distill-llama-70b": {
    vision: false,
    tools: true,
    maxTokens: 8192,
  },
};

// ============================================
// Provider Implementation
// ============================================

/**
 * Create a Groq provider
 *
 * @example
 * ```typescript
 * const groq = createGroq({ apiKey: '...' });
 * const adapter = groq.languageModel('llama-3.3-70b-versatile');
 * ```
 */
export function createGroq(config: GroqProviderConfig = {}): AIProvider {
  const apiKey = config.apiKey ?? process.env.GROQ_API_KEY ?? "";

  return {
    name: "groq",
    supportedModels: Object.keys(GROQ_MODELS),

    languageModel(modelId: string) {
      return createGroqAdapter({
        apiKey,
        model: modelId,
      });
    },

    getCapabilities(modelId: string): ProviderCapabilities {
      const model =
        GROQ_MODELS[modelId] ?? GROQ_MODELS["llama-3.3-70b-versatile"];

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
        supportsJsonMode: true,
        supportsSystemMessages: true,
      };
    },
  };
}

// Alias for consistency
export const createGroqProvider = createGroq;
