/**
 * Providers
 *
 * Multi-provider architecture for Copilot SDK.
 * Each provider wraps existing adapters with capabilities metadata.
 *
 * @example
 * ```typescript
 * import { createOpenAI, createAnthropic } from '@yourgpt/llm-sdk';
 *
 * // Create a provider
 * const openai = createOpenAI({ apiKey: '...' });
 *
 * // Get a model adapter (returns existing LLMAdapter)
 * const adapter = openai.languageModel('gpt-4o');
 *
 * // Check capabilities (for UI feature flags)
 * const caps = openai.getCapabilities('gpt-4o');
 * if (caps.supportsVision) {
 *   // Enable image upload
 * }
 * ```
 */

// ============================================
// Types
// ============================================

export type {
  // Core types
  AIProvider,
  ProviderCapabilities,
  EmbeddingModel,
  ModelInfo,
  // Base config
  BaseProviderConfig,
  // Provider-specific configs
  OpenAIProviderConfig,
  AnthropicProviderConfig,
  GoogleProviderConfig,
  XAIProviderConfig,
  AzureProviderConfig,
  GroqProviderConfig,
  OllamaProviderConfig,
  // Google-specific
  GoogleSafetySetting,
  GoogleGroundingConfig,
} from "./types";

export { DEFAULT_CAPABILITIES } from "./types";

// ============================================
// Registry
// ============================================

export {
  registerProvider,
  getProvider,
  hasProvider,
  listProviders,
  unregisterProvider,
  clearProviders,
  getAvailableProviders,
  getModelCapabilities,
} from "./registry";

// ============================================
// Provider Factories (from subdirectories)
// ============================================

// OpenAI
export { createOpenAI, createOpenAIProvider } from "./openai/index";

// Anthropic
export { createAnthropic, createAnthropicProvider } from "./anthropic/index";

// Groq
export { createGroq, createGroqProvider } from "./groq/index";

// Ollama
export { createOllama, createOllamaProvider } from "./ollama/index";

// Google
export { createGoogle, createGoogleProvider } from "./google/index";

// xAI
export { createXAI, createXAIProvider } from "./xai/index";

// Azure
export { createAzure, createAzureProvider } from "./azure/index";

// ============================================
// Provider Formatters (for agentic loop)
// ============================================

export { openaiFormatter } from "./openai";
export { anthropicFormatter } from "./anthropic";
export { geminiFormatter } from "./gemini";

// Formatter registry helpers
export {
  getFormatter,
  isProviderSupported,
  getSupportedProviders,
} from "./formatter-registry";

// Formatter types (from types.ts)
export type {
  ProviderFormatter,
  // OpenAI tool types
  OpenAITool,
  OpenAIToolCall,
  OpenAIToolResult,
  // Anthropic tool types
  AnthropicTool,
  AnthropicToolUse,
  AnthropicToolResult,
  // Gemini tool types
  GeminiFunctionDeclaration,
  GeminiFunctionCall,
  GeminiFunctionResponse,
} from "./types";

// ============================================
// Auto-register built-in providers
// ============================================

import { registerProvider } from "./registry";
import { createOpenAI } from "./openai/index";
import { createAnthropic } from "./anthropic/index";
import { createGroq } from "./groq/index";
import { createOllama } from "./ollama/index";
import { createGoogle } from "./google/index";
import { createXAI } from "./xai/index";
import { createAzure } from "./azure/index";

// Register with default configs (API keys from env)
registerProvider("openai", (config) => createOpenAI(config as any));
registerProvider("anthropic", (config) => createAnthropic(config as any));
registerProvider("groq", (config) => createGroq(config as any));
registerProvider("ollama", (config) => createOllama(config as any));
registerProvider("google", (config) => createGoogle(config as any));
registerProvider("xai", (config) => createXAI(config as any));
registerProvider("azure", (config) => createAzure(config as any));
