/**
 * xAI Grok Adapter
 *
 * xAI uses an OpenAI-compatible API — this is a thin factory
 * that creates an OpenAIAdapter with the xAI endpoint baked in.
 * No separate class needed.
 */

import { createOpenAIAdapter } from "./openai";
import type { OpenAIAdapterConfig } from "./openai";

const XAI_BASE_URL = "https://api.x.ai/v1";

export interface XAIAdapterConfig {
  apiKey: string;
  model?: string;
  baseUrl?: string;
  temperature?: number;
  maxTokens?: number;
}

export function createXAIAdapter(config: XAIAdapterConfig) {
  return createOpenAIAdapter({
    apiKey: config.apiKey,
    model: config.model || "grok-3",
    baseUrl: config.baseUrl || XAI_BASE_URL,
    temperature: config.temperature,
    maxTokens: config.maxTokens,
  } satisfies OpenAIAdapterConfig);
}
