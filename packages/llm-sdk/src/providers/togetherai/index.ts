/**
 * Together AI Provider
 *
 * Together AI is a high-performance inference platform for open-source models
 * (Llama, DeepSeek, Qwen, Mistral, Gemma, and more).
 *
 * Uses an OpenAI-compatible API — set TOGETHER_API_KEY in your environment.
 *
 * @see https://docs.together.ai/reference
 *
 * @example
 * ```ts
 * // Modern pattern — returns LanguageModel directly
 * import { togetherai } from '@yourgpt/llm-sdk/togetherai';
 * import { generateText } from '@yourgpt/llm-sdk';
 *
 * const result = await generateText({
 *   model: togetherai('meta-llama/Llama-3.3-70B-Instruct-Turbo'),
 *   prompt: 'Hello!',
 * });
 *
 * // Legacy pattern — returns AIProvider for createRuntime
 * import { createTogetherAI } from '@yourgpt/llm-sdk/togetherai';
 * import { createRuntime } from '@yourgpt/llm-sdk';
 *
 * const provider = createTogetherAI({ apiKey: '...' });
 * const runtime = createRuntime({ provider, model: 'meta-llama/Llama-3.3-70B-Instruct-Turbo' });
 * ```
 */

// Modern pattern - togetherai() function returning LanguageModel
export { togetherai } from "./provider";
export type { TogetherAIProviderOptions } from "./provider";

import { createOpenAIAdapter } from "../../adapters/openai";
import {
  createCallableProvider,
  type AIProvider,
  type ProviderCapabilities,
} from "../types";

// ============================================
// Provider Config
// ============================================

export interface TogetherAIProviderConfig {
  /** API key (defaults to TOGETHER_API_KEY env var) */
  apiKey?: string;
  /** Base URL for API */
  baseUrl?: string;
}

// ============================================
// Default capabilities
// ============================================

const DEFAULT_CAPABILITIES = {
  vision: true,
  tools: true,
  jsonMode: true,
  maxTokens: 131072,
};

// ============================================
// Provider Factory (Legacy pattern — for createRuntime)
// ============================================

/**
 * Create a Together AI provider (callable, for use with createRuntime)
 *
 * @example
 * ```typescript
 * import { createTogetherAI } from '@yourgpt/llm-sdk/togetherai';
 * import { createRuntime } from '@yourgpt/llm-sdk';
 *
 * const together = createTogetherAI({ apiKey: '...' });
 * const runtime = createRuntime({
 *   provider: together,
 *   model: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
 * });
 *
 * // Handle incoming chat requests
 * return runtime.handleRequest(request);
 * ```
 */
export function createTogetherAI(
  config: TogetherAIProviderConfig = {},
): AIProvider {
  const apiKey = config.apiKey ?? process.env.TOGETHER_API_KEY ?? "";
  const baseUrl = config.baseUrl ?? "https://api.together.xyz/v1";

  const providerFn = (modelId: string) => {
    return createOpenAIAdapter({
      apiKey,
      model: modelId,
      baseUrl,
    });
  };

  const getCapabilities = (_modelId: string): ProviderCapabilities => {
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
    name: "togetherai",
    supportedModels: [],
    getCapabilities,
  });
}

// Alias
export const createTogetherAIProvider = createTogetherAI;
