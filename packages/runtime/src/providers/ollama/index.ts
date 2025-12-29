/**
 * Ollama Provider
 *
 * Wraps the existing OllamaAdapter with provider interface.
 * Ollama runs models locally on your machine.
 */

import { createOllamaAdapter } from "../../adapters/ollama";
import type {
  AIProvider,
  ProviderCapabilities,
  OllamaProviderConfig,
} from "../types";

// ============================================
// Model Definitions
// ============================================

interface ModelCapabilities {
  vision: boolean;
  tools: boolean;
  maxTokens: number;
}

// Common Ollama models - users can run any model
const OLLAMA_MODELS: Record<string, ModelCapabilities> = {
  // Llama series
  llama3: {
    vision: false,
    tools: true,
    maxTokens: 8192,
  },
  "llama3:70b": {
    vision: false,
    tools: true,
    maxTokens: 8192,
  },
  "llama3.2": {
    vision: false,
    tools: true,
    maxTokens: 8192,
  },
  "llama3.2-vision": {
    vision: true,
    tools: true,
    maxTokens: 8192,
  },

  // Mistral series
  mistral: {
    vision: false,
    tools: true,
    maxTokens: 8192,
  },
  "mistral-nemo": {
    vision: false,
    tools: true,
    maxTokens: 128000,
  },
  mixtral: {
    vision: false,
    tools: true,
    maxTokens: 32768,
  },

  // CodeLlama
  codellama: {
    vision: false,
    tools: false,
    maxTokens: 16384,
  },

  // Phi series
  phi3: {
    vision: false,
    tools: true,
    maxTokens: 4096,
  },
  "phi3:medium": {
    vision: false,
    tools: true,
    maxTokens: 4096,
  },

  // Gemma series
  gemma2: {
    vision: false,
    tools: false,
    maxTokens: 8192,
  },
  "gemma2:27b": {
    vision: false,
    tools: false,
    maxTokens: 8192,
  },

  // Qwen series
  qwen2: {
    vision: false,
    tools: true,
    maxTokens: 32768,
  },
  "qwen2.5-coder": {
    vision: false,
    tools: true,
    maxTokens: 32768,
  },

  // LLaVA (vision)
  llava: {
    vision: true,
    tools: false,
    maxTokens: 4096,
  },

  // DeepSeek
  deepseek: {
    vision: false,
    tools: true,
    maxTokens: 16384,
  },
  "deepseek-coder": {
    vision: false,
    tools: false,
    maxTokens: 16384,
  },
};

// Default capabilities for unknown models
const DEFAULT_MODEL_CAPS: ModelCapabilities = {
  vision: false,
  tools: false,
  maxTokens: 4096,
};

// ============================================
// Provider Implementation
// ============================================

/**
 * Create an Ollama provider
 *
 * @example
 * ```typescript
 * const ollama = createOllama({ baseUrl: 'http://localhost:11434' });
 * const adapter = ollama.languageModel('llama3');
 * ```
 */
export function createOllama(config: OllamaProviderConfig = {}): AIProvider {
  const baseUrl = config.baseUrl ?? "http://localhost:11434";

  return {
    name: "ollama",
    supportedModels: Object.keys(OLLAMA_MODELS),

    languageModel(modelId: string) {
      return createOllamaAdapter({
        model: modelId,
        baseUrl,
      });
    },

    getCapabilities(modelId: string): ProviderCapabilities {
      // Try exact match first, then try base model name
      const baseModelName = modelId.split(":")[0];
      const model =
        OLLAMA_MODELS[modelId] ??
        OLLAMA_MODELS[baseModelName] ??
        DEFAULT_MODEL_CAPS;

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
          ? ["image/png", "image/jpeg", "image/gif"]
          : [],
        supportsJsonMode: false,
        supportsSystemMessages: true,
      };
    },
  };
}

// Alias for consistency
export const createOllamaProvider = createOllama;
