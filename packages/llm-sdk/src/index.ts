/**
 * @yourgpt/llm-sdk
 *
 * LLM SDK for YourGPT - Multi-provider LLM integration
 *
 * Tree-shakeable imports:
 * ```ts
 * // Core functions from root (no adapters bundled)
 * import { createRuntime, generateText, streamText, tool } from '@yourgpt/llm-sdk';
 *
 * // Provider from subpath (only that provider bundled)
 * import { createAnthropic } from '@yourgpt/llm-sdk/anthropic';
 * import { createOpenAI } from '@yourgpt/llm-sdk/openai';
 *
 * const runtime = createRuntime({
 *   provider: createAnthropic(),
 *   model: 'claude-3-5-sonnet-20241022',
 * });
 * ```
 */

// ============================================
// Core Functions (Modern API)
// ============================================

export { generateText } from "./core/generate-text";
export { streamText } from "./core/stream-text";
export {
  tool,
  formatToolsForOpenAI,
  formatToolsForAnthropic,
  formatToolsForGoogle,
} from "./core/tool";

// Core Types
export type {
  // Language Model
  LanguageModel,
  ModelCapabilities,
  DoGenerateParams,
  DoGenerateResult,

  // Messages
  CoreMessage,
  SystemMessage,
  UserMessage,
  AssistantMessage,
  ToolMessage,
  UserContentPart,
  TextPart,
  ImagePart,
  FilePart,

  // Tools
  Tool,
  ToolContext,
  ToolCall,
  ToolResult,

  // Generation
  GenerateTextParams,
  GenerateTextResult,
  GenerateStep,
  StreamTextParams,
  StreamTextResult,
  StreamPart,

  // Streaming
  StreamChunk,
  TextDeltaChunk,
  ToolCallChunk,
  ToolResultChunk,
  FinishChunk,
  ErrorChunk,

  // Common
  TokenUsage,
  FinishReason,
  ResponseOptions,
} from "./core/types";

export { DEFAULT_CAPABILITIES } from "./core/types";

// ============================================
// Server Runtime
// ============================================

// Server
export {
  Runtime,
  createRuntime,
  type RuntimeConfig,
  type ChatRequest,
  type ActionRequest,
  type RequestContext,
} from "./server";

// StreamResult (Industry Standard Pattern)
export {
  StreamResult,
  createStreamResult,
  type StreamResultOptions,
  type CollectedResult,
} from "./server";

// GenerateResult (Non-streaming)
export {
  GenerateResult,
  type GenerateResultData,
  type CopilotChatResponse,
} from "./server";

// Framework integrations
export {
  createHonoApp,
  createNextHandler,
  createExpressMiddleware,
  createExpressHandler,
  createNodeHandler,
} from "./server";

// Streaming utilities
export {
  createSSEHeaders,
  createTextStreamHeaders,
  formatSSEData,
  createEventStream,
  createSSEResponse,
  createTextStreamResponse,
  pipeSSEToResponse,
  pipeTextToResponse,
} from "./server";

// Agent loop
export {
  runAgentLoop,
  DEFAULT_MAX_ITERATIONS,
  type AgentLoopOptions,
} from "./server";

// ============================================
// Types Only (for advanced use cases)
// ============================================

// Adapter types (no implementations - use subpath imports)
export type {
  LLMAdapter,
  ChatCompletionRequest,
  AdapterFactory,
} from "./adapters/base";

// Provider types (no implementations - use subpath imports)
export type {
  AIProvider,
  ProviderCapabilities,
  BaseProviderConfig,
  OpenAIProviderConfig,
  AnthropicProviderConfig,
  GoogleProviderConfig,
  XAIProviderConfig,
  AzureProviderConfig,
  OllamaProviderConfig,
  OllamaModelOptions,
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
} from "./providers/types";

// Re-export core types
export type {
  Message,
  ActionDefinition,
  StreamEvent,
  LLMConfig,
  ToolDefinition,
  ToolLocation,
  ToolResponse,
  UnifiedToolCall,
  UnifiedToolResult,
  ToolExecution,
  AgentLoopConfig,
  DoneEventMessage,
  ToolCallInfo,
  TokenUsageRaw,
} from "./core/stream-events";

// Re-export utility functions
export {
  generateMessageId,
  generateToolCallId,
  generateThreadId,
} from "./core/utils";
