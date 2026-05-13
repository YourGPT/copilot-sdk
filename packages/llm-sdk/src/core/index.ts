/**
 * Core Module
 *
 * Exports core functions and types for @yourgpt/llm-sdk
 */

// Core functions
export { generateText } from "./generate-text";
export { streamText } from "./stream-text";
export {
  tool,
  formatToolsForOpenAI,
  formatToolsForAnthropic,
  formatToolsForGoogle,
} from "./tool";

// Core types
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
  AudioPart,

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
  // Storage
  StorageAdapter,
  StorageMessage,
  StorageFile,
} from "./types";

export { DEFAULT_CAPABILITIES } from "./types";
