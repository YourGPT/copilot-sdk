/**
 * Core Types for @yourgpt/llm-sdk
 *
 * Modern, instance-based types following Vercel AI SDK patterns.
 */

import type { z } from "zod";

// ============================================
// Language Model Types
// ============================================

/**
 * A language model instance that can generate text.
 * This is what provider functions like `openai('gpt-4o')` return.
 */
export interface LanguageModel {
  /** Provider identifier (e.g., 'openai', 'anthropic') */
  readonly provider: string;

  /** Model identifier (e.g., 'gpt-4o', 'claude-3-5-sonnet') */
  readonly modelId: string;

  /** Model capabilities for feature detection */
  readonly capabilities: ModelCapabilities;

  /**
   * Generate a complete response (non-streaming)
   * Used internally by generateText()
   */
  doGenerate(params: DoGenerateParams): Promise<DoGenerateResult>;

  /**
   * Stream a response
   * Used internally by streamText()
   */
  doStream(params: DoGenerateParams): AsyncGenerator<StreamChunk>;
}

/**
 * Model capabilities for UI feature flags
 */
export interface ModelCapabilities {
  /** Supports image inputs */
  supportsVision: boolean;
  /** Supports tool/function calling */
  supportsTools: boolean;
  /** Supports streaming responses */
  supportsStreaming: boolean;
  /** Supports JSON mode / structured output */
  supportsJsonMode: boolean;
  /** Supports extended thinking (Claude) */
  supportsThinking: boolean;
  /** Supports PDF document inputs */
  supportsPDF: boolean;
  /** Maximum context tokens */
  maxTokens: number;
  /** Supported image MIME types */
  supportedImageTypes: string[];
}

/**
 * Default capabilities for unknown models
 */
export const DEFAULT_CAPABILITIES: ModelCapabilities = {
  supportsVision: false,
  supportsTools: true,
  supportsStreaming: true,
  supportsJsonMode: false,
  supportsThinking: false,
  supportsPDF: false,
  maxTokens: 8192,
  supportedImageTypes: [],
};

// ============================================
// Message Types
// ============================================

/**
 * Core message types for LLM conversations
 */
export type CoreMessage =
  | SystemMessage
  | UserMessage
  | AssistantMessage
  | ToolMessage;

export interface SystemMessage {
  role: "system";
  content: string;
}

export interface UserMessage {
  role: "user";
  content: string | UserContentPart[];
}

export interface AssistantMessage {
  role: "assistant";
  content: string | null;
  toolCalls?: ToolCall[];
}

export interface ToolMessage {
  role: "tool";
  toolCallId: string;
  content: string;
}

/**
 * Content parts for multimodal user messages
 */
export type UserContentPart = TextPart | ImagePart | FilePart;

export interface TextPart {
  type: "text";
  text: string;
}

export interface ImagePart {
  type: "image";
  /** Base64 data or URL */
  image: string | Uint8Array;
  /** MIME type (e.g., 'image/png') */
  mimeType?: string;
}

export interface FilePart {
  type: "file";
  /** Base64 data or URL */
  data: string;
  /** MIME type (e.g., 'application/pdf') */
  mimeType: string;
}

// ============================================
// Tool Types
// ============================================

/**
 * Tool definition with Zod schema support
 */
export interface Tool<TParams = unknown, TResult = unknown> {
  /** Tool description for the LLM */
  description: string;
  /** Zod schema for parameters */
  parameters: z.ZodType<TParams>;
  /** Execute function */
  execute: (params: TParams, context: ToolContext) => Promise<TResult>;
  /**
   * Hide this tool's execution from the chat UI.
   * When true, tool calls and results won't be displayed to the user,
   * but the tool will still execute normally.
   * @default false
   */
  hidden?: boolean;
}

/**
 * Context passed to tool execute function
 */
export interface ToolContext {
  /** Abort signal for cancellation */
  abortSignal?: AbortSignal;
  /** Unique tool call ID */
  toolCallId: string;
  /** Optional: messages in conversation */
  messages?: CoreMessage[];
}

/**
 * Tool call from LLM response
 */
export interface ToolCall {
  /** Unique ID for this tool call */
  id: string;
  /** Tool name */
  name: string;
  /** Parsed arguments */
  args: Record<string, unknown>;
}

/**
 * Tool execution result
 */
export interface ToolResult {
  /** Tool call ID this result corresponds to */
  toolCallId: string;
  /** Result data (will be JSON stringified for LLM) */
  result: unknown;
}

// ============================================
// Generation Types
// ============================================

/**
 * Parameters for model.doGenerate() and model.doStream()
 */
export interface DoGenerateParams {
  /** Messages to send to LLM */
  messages: CoreMessage[];
  /** Tools available to the LLM (already formatted for provider) */
  tools?: unknown[];
  /** Temperature (0-2) */
  temperature?: number;
  /** Maximum tokens to generate */
  maxTokens?: number;
  /** Abort signal */
  signal?: AbortSignal;
}

/**
 * Result from model.doGenerate()
 */
export interface DoGenerateResult {
  /** Generated text content */
  text: string;
  /** Tool calls requested by the LLM */
  toolCalls: ToolCall[];
  /** Why generation stopped */
  finishReason: FinishReason;
  /** Token usage */
  usage: TokenUsage;
  /** Raw provider response (for debugging) */
  rawResponse?: unknown;
}

/**
 * Finish reason for generation
 */
export type FinishReason =
  | "stop"
  | "length"
  | "tool-calls"
  | "content-filter"
  | "error"
  | "unknown";

/**
 * Token usage statistics
 */
export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

// ============================================
// Streaming Types
// ============================================

/**
 * Stream chunk from model.doStream()
 */
export type StreamChunk =
  | TextDeltaChunk
  | ToolCallChunk
  | ToolResultChunk
  | FinishChunk
  | ErrorChunk;

export interface TextDeltaChunk {
  type: "text-delta";
  text: string;
}

export interface ToolCallChunk {
  type: "tool-call";
  toolCall: ToolCall;
}

export interface ToolResultChunk {
  type: "tool-result";
  toolCallId: string;
  result: unknown;
}

export interface FinishChunk {
  type: "finish";
  finishReason: FinishReason;
  usage?: TokenUsage;
}

export interface ErrorChunk {
  type: "error";
  error: Error;
}

// ============================================
// Generate Text Types
// ============================================

/**
 * Parameters for generateText()
 */
export interface GenerateTextParams {
  /** Language model to use */
  model: LanguageModel;
  /** Simple prompt (converted to user message) */
  prompt?: string;
  /** System prompt */
  system?: string;
  /** Full message history */
  messages?: CoreMessage[];
  /** Tools available to the LLM */
  tools?: Record<string, Tool>;
  /** Maximum agentic steps (tool call loops) */
  maxSteps?: number;
  /** Temperature (0-2) */
  temperature?: number;
  /** Maximum tokens to generate */
  maxTokens?: number;
  /** Abort signal */
  signal?: AbortSignal;
}

/**
 * Result from generateText()
 */
export interface GenerateTextResult {
  /** Final text output */
  text: string;
  /** Token usage */
  usage: TokenUsage;
  /** Why generation stopped */
  finishReason: FinishReason;
  /** All steps taken (for agentic workflows) */
  steps: GenerateStep[];
  /** All tool calls made across all steps */
  toolCalls: ToolCall[];
  /** All tool results across all steps */
  toolResults: ToolResult[];
  /** Final message list including tool interactions */
  response: {
    messages: CoreMessage[];
  };
}

/**
 * A single step in the generation process
 */
export interface GenerateStep {
  /** Text generated in this step */
  text: string;
  /** Tool calls made in this step */
  toolCalls: ToolCall[];
  /** Tool results from this step */
  toolResults: ToolResult[];
  /** Finish reason for this step */
  finishReason: FinishReason;
  /** Token usage for this step */
  usage: TokenUsage;
}

// ============================================
// Stream Text Types
// ============================================

/**
 * Parameters for streamText() - same as generateText
 */
export type StreamTextParams = GenerateTextParams;

/**
 * Result from streamText()
 */
export interface StreamTextResult {
  /** Async iterable of text chunks only */
  textStream: AsyncIterable<string>;

  /** Async iterable of all stream parts */
  fullStream: AsyncIterable<StreamPart>;

  /** Promise that resolves to full text when complete */
  readonly text: Promise<string>;

  /** Promise that resolves to usage when complete */
  readonly usage: Promise<TokenUsage>;

  /** Promise that resolves to finish reason when complete */
  readonly finishReason: Promise<FinishReason>;

  /** Convert to plain text streaming Response */
  toTextStreamResponse(options?: ResponseOptions): Response;

  /** Convert to data stream Response (SSE with tool calls) */
  toDataStreamResponse(options?: ResponseOptions): Response;
}

/**
 * Stream part for fullStream
 */
export type StreamPart =
  | { type: "text-delta"; text: string }
  | { type: "tool-call-start"; toolCallId: string; toolName: string }
  | { type: "tool-call-delta"; toolCallId: string; argsText: string }
  | { type: "tool-call-complete"; toolCall: ToolCall }
  | { type: "tool-result"; toolCallId: string; result: unknown }
  | { type: "step-start"; step: number }
  | { type: "step-finish"; step: number; finishReason: FinishReason }
  | { type: "finish"; finishReason: FinishReason; usage: TokenUsage }
  | { type: "error"; error: Error };

/**
 * Options for Response helpers
 */
export interface ResponseOptions {
  /** Additional headers */
  headers?: Record<string, string>;
  /** Response status (default: 200) */
  status?: number;
}

// ============================================
// Storage Adapter
// ============================================

/**
 * Message format for storage adapters.
 * Intentionally simpler than LLM-specific formats — adapters convert as needed.
 */
export interface StorageMessage {
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  toolCalls?: unknown[];
  toolCallId?: string;
  /** Content type for the message — determines how it's stored in the backend */
  contentType?: "text" | "image" | "file";
  /** URL for image/file attachments */
  url?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Generic storage adapter interface for session + message persistence.
 *
 * `createYourGPT()` is the default implementation for YourGPT platform.
 * Third-party developers can implement this interface for custom backends.
 *
 * @example
 * ```ts
 * import { createRuntime } from '@yourgpt/llm-sdk'
 * import { createYourGPT } from '@yourgpt/llm-sdk/yourgpt'
 *
 * const runtime = createRuntime({
 *   provider: anthropic,
 *   model: 'claude-haiku-4-5',
 *   storage: createYourGPT({ apiKey, widgetUid }),
 * })
 * // runtime.chat() and runtime.stream() now auto-persist messages
 * ```
 */
export interface StorageAdapter {
  /** Create a new session. Returns session ID to use as threadId. */
  createSession(data?: {
    title?: string;
    metadata?: Record<string, unknown>;
  }): Promise<{ id: string }>;
  /** Append messages to a session (called sequentially — input before output). */
  saveMessages(sessionId: string, messages: StorageMessage[]): Promise<void>;
  /** List sessions (optional — used for thread picker sync in future). */
  getSessions?(): Promise<{ id: string; title?: string; updatedAt?: Date }[]>;
  /** Get messages for a session (optional — used for thread restore in future). */
  getMessages?(sessionId: string): Promise<StorageMessage[]>;
  /**
   * Upload a file to storage. Returns a URL the LLM can reference.
   * When present, the server exposes a /upload endpoint and the client
   * uses it instead of embedding base64 in the message body.
   */
  uploadFile?(file: StorageFile): Promise<{ url: string }>;
}

/**
 * File data for upload via StorageAdapter.uploadFile()
 */
export interface StorageFile {
  /** Base64-encoded file data (with or without data URI prefix) */
  data: string;
  /** MIME type (e.g., "image/png", "application/pdf") */
  mimeType: string;
  /** Original filename */
  filename?: string;
}
