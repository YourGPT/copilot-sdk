// Base adapter
export type { LLMAdapter, ChatCompletionRequest, AdapterFactory } from "./base";
export {
  formatMessages,
  formatTools,
  // Multimodal/Vision support
  formatMessagesForAnthropic,
  formatMessagesForOpenAI,
  messageToAnthropicContent,
  messageToOpenAIContent,
  hasImageAttachments,
  attachmentToAnthropicImage,
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
