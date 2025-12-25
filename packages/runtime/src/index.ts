/**
 * @yourgpt/runtime
 *
 * Backend runtime server for YourGPT Copilot SDK
 */

// Server
export {
  Runtime,
  createRuntime,
  type RuntimeConfig,
  type ChatRequest,
  type ActionRequest,
  type RequestContext,
} from "./server";

// Framework integrations
export {
  createHonoApp,
  createNextHandler,
  createExpressMiddleware,
  createNodeHandler,
} from "./server";

// Streaming utilities
export {
  createSSEHeaders,
  formatSSEData,
  createEventStream,
  createSSEResponse,
} from "./server";

// Agent loop
export {
  runAgentLoop,
  DEFAULT_MAX_ITERATIONS,
  type AgentLoopOptions,
} from "./server";

// Knowledge Base (server-side)
export {
  searchKnowledgeBase,
  formatKnowledgeResultsForAI,
  KNOWLEDGE_BASE_SYSTEM_INSTRUCTION,
  type YourGPTKBConfig,
  type KBSearchResult,
  type KBSearchResponse,
} from "./server";

// Adapters
export type {
  LLMAdapter,
  ChatCompletionRequest,
  AdapterFactory,
} from "./adapters";

export {
  // OpenAI
  OpenAIAdapter,
  createOpenAIAdapter,
  type OpenAIAdapterConfig,
  // Anthropic
  AnthropicAdapter,
  createAnthropicAdapter,
  type AnthropicAdapterConfig,
  // Groq
  GroqAdapter,
  createGroqAdapter,
  type GroqAdapterConfig,
  // Ollama
  OllamaAdapter,
  createOllamaAdapter,
  type OllamaAdapterConfig,
} from "./adapters";

// Provider formatters (for agentic loop)
export {
  getFormatter,
  isProviderSupported,
  getSupportedProviders,
  anthropicFormatter,
  openaiFormatter,
  geminiFormatter,
} from "./providers";

export type {
  ProviderFormatter,
  AnthropicTool,
  AnthropicToolUse,
  AnthropicToolResult,
  OpenAITool,
  OpenAIToolCall,
  OpenAIToolResult,
  GeminiFunctionDeclaration,
  GeminiFunctionCall,
  GeminiFunctionResponse,
} from "./providers";

// Re-export core types
export type {
  Message,
  ActionDefinition,
  StreamEvent,
  LLMConfig,
  LLMProvider,
  // Tool types
  AIProvider,
  ToolDefinition,
  ToolLocation,
  ToolResponse,
  UnifiedToolCall,
  UnifiedToolResult,
  ToolExecution,
  AgentLoopConfig,
} from "@yourgpt/core";
