/**
 * Fireworks Provider
 *
 * Fireworks.ai is a high-performance inference platform for open-source models
 * (Llama, DeepSeek, Qwen, Mixtral, Gemma, and more).
 *
 * Uses an OpenAI-compatible API — set FIREWORKS_API_KEY in your environment.
 *
 * @see https://fireworks.ai/docs
 *
 * @example
 * ```ts
 * // Modern pattern — returns LanguageModel directly
 * import { fireworks } from '@yourgpt/llm-sdk/fireworks';
 * import { generateText } from '@yourgpt/llm-sdk';
 *
 * const result = await generateText({
 *   model: fireworks('accounts/fireworks/models/llama-v3p1-70b-instruct'),
 *   prompt: 'Hello!',
 * });
 *
 * // Runtime pattern — returns AIProvider for createRuntime / fallback chain
 * import { createFireworks } from '@yourgpt/llm-sdk/fireworks';
 * import { createRuntime } from '@yourgpt/llm-sdk';
 *
 * const provider = createFireworks({ apiKey: '...' });
 * const runtime = createRuntime({ provider, model: 'accounts/fireworks/models/deepseek-v3p1' });
 * ```
 */

// Modern pattern - fireworks() function returning LanguageModel.
// (createFireworksModel is the low-level alias; the runtime factory below is createFireworks.)
export { fireworks, createFireworks as createFireworksModel } from "./provider";
export type { FireworksProviderOptions } from "./provider";

import { createOpenAIAdapter } from "../../adapters/openai";
import {
  createCallableProvider,
  type AIProvider,
  type ProviderCapabilities,
} from "../types";

// ============================================
// Provider Config
// ============================================

export interface FireworksProviderConfig {
  /** API key (defaults to FIREWORKS_API_KEY env var) */
  apiKey?: string;
  /** Base URL for API */
  baseUrl?: string;
}

// ============================================
// Default capabilities
// ============================================

const DEFAULT_CAPABILITIES = {
  vision: false,
  tools: true,
  jsonMode: true,
  maxTokens: 131072,
};

// ============================================
// Provider Factory (for createRuntime / fallback chain)
// ============================================

/**
 * Create a Fireworks provider (callable, for use with createRuntime).
 *
 * Fireworks exposes an OpenAI-compatible API, so this reuses the OpenAI adapter
 * pointed at the Fireworks base URL — the same approach used by Together AI and
 * OpenRouter. The adapter speaks the runtime's API (generate/stream, rawMessages,
 * message:delta/end events) and sets `stream_options.include_usage`, so streaming
 * usage is reported correctly for credit accounting.
 *
 * @example
 * ```typescript
 * import { createFireworks } from '@yourgpt/llm-sdk/fireworks';
 * import { createRuntime } from '@yourgpt/llm-sdk';
 *
 * const fireworks = createFireworks({ apiKey: '...' });
 * const runtime = createRuntime({
 *   provider: fireworks,
 *   model: 'accounts/fireworks/models/deepseek-v3p1',
 * });
 *
 * // Handle incoming chat requests
 * return runtime.handleRequest(request);
 * ```
 */
export function createFireworks(
  config: FireworksProviderConfig = {},
): AIProvider {
  const apiKey = config.apiKey ?? process.env.FIREWORKS_API_KEY ?? "";
  const baseUrl = config.baseUrl ?? "https://api.fireworks.ai/inference/v1";

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
    name: "fireworks",
    supportedModels: [],
    getCapabilities,
  });
}

// Alias
export const createFireworksProvider = createFireworks;
