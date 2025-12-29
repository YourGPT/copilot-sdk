// Base adapter
export type {
  LLMAdapter,
  ChatCompletionRequest,
  AdapterFactory,
  CompletionResult,
} from "./base";
export {
  formatMessages,
  formatTools,
  // Multimodal/Vision support
  formatMessagesForAnthropic,
  formatMessagesForOpenAI,
  messageToAnthropicContent,
  messageToOpenAIContent,
  hasImageAttachments,
  hasMediaAttachments,
  attachmentToAnthropicImage,
  attachmentToAnthropicDocument,
  attachmentToOpenAIImage,
  type AnthropicContentBlock,
  type OpenAIContentBlock,
} from "./base";

// OpenAI
export {
  OpenAIAdapter,
  createOpenAIAdapter,
  type OpenAIAdapterConfig,
} from "./openai";

// Anthropic
export {
  AnthropicAdapter,
  createAnthropicAdapter,
  type AnthropicAdapterConfig,
} from "./anthropic";

// Groq
export { GroqAdapter, createGroqAdapter, type GroqAdapterConfig } from "./groq";

// Ollama
export {
  OllamaAdapter,
  createOllamaAdapter,
  type OllamaAdapterConfig,
} from "./ollama";

// Google Gemini
export {
  GoogleAdapter,
  createGoogleAdapter,
  type GoogleAdapterConfig,
} from "./google";

// xAI Grok
export { XAIAdapter, createXAIAdapter, type XAIAdapterConfig } from "./xai";

// Azure OpenAI
export {
  AzureAdapter,
  createAzureAdapter,
  type AzureAdapterConfig,
} from "./azure";
