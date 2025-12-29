/**
 * Provider Types
 *
 * Defines interfaces for:
 * 1. Provider Formatters (for tool transformations in agent loop)
 * 2. Multi-provider architecture (AIProvider, capabilities, configs)
 */

import type {
  ToolDefinition,
  UnifiedToolCall,
  UnifiedToolResult,
} from "@yourgpt/copilot-sdk-core";
import type { LLMAdapter } from "../adapters/base";

// ============================================
// Provider Formatter Types (for agent loop)
// ============================================

/**
 * Provider formatter interface
 *
 * Each provider implements this interface to handle:
 * - Tool definition transformation
 * - Tool call parsing from responses
 * - Tool result formatting
 * - Stop reason detection
 */
export interface ProviderFormatter {
  /**
   * Transform unified tool definitions to provider format
   */
  transformTools(tools: ToolDefinition[]): unknown[];

  /**
   * Parse tool calls from provider response
   */
  parseToolCalls(response: unknown): UnifiedToolCall[];

  /**
   * Format tool results for provider
   */
  formatToolResults(results: UnifiedToolResult[]): unknown[];

  /**
   * Check if response indicates tool use is requested
   */
  isToolUseStop(response: unknown): boolean;

  /**
   * Check if response indicates end of turn
   */
  isEndTurnStop(response: unknown): boolean;

  /**
   * Get stop reason string from response
   */
  getStopReason(response: unknown): string;

  /**
   * Extract text content from response
   */
  extractTextContent(response: unknown): string;

  /**
   * Build assistant message with tool calls for conversation history
   */
  buildAssistantToolMessage(
    toolCalls: UnifiedToolCall[],
    textContent?: string,
  ): unknown;

  /**
   * Build user message with tool results for conversation history
   */
  buildToolResultMessage(results: UnifiedToolResult[]): unknown;
}

// ============================================
// Anthropic Tool Types
// ============================================

/**
 * Anthropic tool definition format
 */
export interface AnthropicTool {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

/**
 * Anthropic tool_use block from response
 */
export interface AnthropicToolUse {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
}

/**
 * Anthropic tool_result block
 */
export interface AnthropicToolResult {
  type: "tool_result";
  tool_use_id: string;
  content: string;
}

// ============================================
// OpenAI Tool Types
// ============================================

/**
 * OpenAI tool definition format
 */
export interface OpenAITool {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      properties: Record<string, unknown>;
      required?: string[];
    };
  };
}

/**
 * OpenAI tool call from response
 */
export interface OpenAIToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string; // JSON string
  };
}

/**
 * OpenAI tool result message
 */
export interface OpenAIToolResult {
  role: "tool";
  tool_call_id: string;
  content: string;
}

// ============================================
// Gemini Tool Types
// ============================================

/**
 * Google Gemini function declaration
 */
export interface GeminiFunctionDeclaration {
  name: string;
  description: string;
  parameters?: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

/**
 * Gemini function call from response
 */
export interface GeminiFunctionCall {
  name: string;
  args: Record<string, unknown>;
}

/**
 * Gemini function response
 */
export interface GeminiFunctionResponse {
  name: string;
  response: Record<string, unknown>;
}

// ============================================
// Provider Capabilities (for UI feature flags)
// ============================================

/**
 * Capabilities of a model for UI feature flags
 * UI components can use this to enable/disable features
 */
export interface ProviderCapabilities {
  /** Supports image inputs */
  supportsVision: boolean;
  /** Supports tool/function calling */
  supportsTools: boolean;
  /** Supports extended thinking (Claude, DeepSeek) */
  supportsThinking: boolean;
  /** Supports streaming responses */
  supportsStreaming: boolean;
  /** Supports PDF document inputs */
  supportsPDF: boolean;
  /** Supports audio inputs */
  supportsAudio: boolean;
  /** Supports video inputs */
  supportsVideo: boolean;
  /** Maximum context tokens */
  maxTokens: number;
  /** Supported image MIME types */
  supportedImageTypes: string[];
  /** Supported audio MIME types */
  supportedAudioTypes?: string[];
  /** Supported video MIME types */
  supportedVideoTypes?: string[];
  /** Supports JSON mode / structured output */
  supportsJsonMode?: boolean;
  /** Supports system messages */
  supportsSystemMessages?: boolean;
}

// ============================================
// AI Provider Interface
// ============================================

/**
 * AI Provider interface
 *
 * Wraps existing LLMAdapter with additional metadata:
 * - Supported models list
 * - Per-model capabilities
 * - Provider name
 *
 * @example
 * ```typescript
 * const openai = createOpenAI({ apiKey: '...' });
 *
 * // Get adapter for a specific model
 * const adapter = openai.languageModel('gpt-4o');
 *
 * // Check capabilities
 * const caps = openai.getCapabilities('gpt-4o');
 * if (caps.supportsVision) {
 *   // Show image upload button
 * }
 * ```
 */
export interface AIProvider {
  /** Provider name (e.g., 'openai', 'anthropic') */
  readonly name: string;

  /** List of supported model IDs */
  readonly supportedModels: string[];

  /**
   * Get a language model adapter for the given model ID
   * Returns the existing LLMAdapter interface - no breaking changes
   */
  languageModel(modelId: string): LLMAdapter;

  /**
   * Get capabilities for a specific model
   * UI components use this to enable/disable features
   */
  getCapabilities(modelId: string): ProviderCapabilities;

  /**
   * Optional: Get an embedding model (future expansion)
   */
  embeddingModel?(modelId: string): EmbeddingModel;
}

/**
 * Embedding model interface (for future expansion)
 */
export interface EmbeddingModel {
  readonly provider: string;
  readonly modelId: string;
  embed(texts: string[]): Promise<number[][]>;
}

// ============================================
// Provider-Specific Configurations
// ============================================

/**
 * Base provider configuration
 */
export interface BaseProviderConfig {
  /** API key (falls back to environment variable) */
  apiKey?: string;
  /** Custom base URL */
  baseUrl?: string;
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Custom headers to include */
  headers?: Record<string, string>;
}

/**
 * OpenAI provider configuration
 */
export interface OpenAIProviderConfig extends BaseProviderConfig {
  /** OpenAI organization ID */
  organization?: string;
  /** OpenAI project ID */
  project?: string;
  /** Vision detail level for images */
  imageDetail?: "auto" | "low" | "high";
}

/**
 * Anthropic provider configuration
 */
export interface AnthropicProviderConfig extends BaseProviderConfig {
  /** Extended thinking budget in tokens (minimum 1024) */
  thinkingBudget?: number;
  /** Enable prompt caching */
  cacheControl?: boolean;
}

/**
 * Google provider configuration
 */
export interface GoogleProviderConfig extends BaseProviderConfig {
  /** Safety settings */
  safetySettings?: GoogleSafetySetting[];
  /** Grounding configuration (for web search) */
  groundingConfig?: GoogleGroundingConfig;
}

/**
 * Google safety setting
 */
export interface GoogleSafetySetting {
  category:
    | "HARM_CATEGORY_HARASSMENT"
    | "HARM_CATEGORY_HATE_SPEECH"
    | "HARM_CATEGORY_SEXUALLY_EXPLICIT"
    | "HARM_CATEGORY_DANGEROUS_CONTENT";
  threshold:
    | "BLOCK_NONE"
    | "BLOCK_LOW_AND_ABOVE"
    | "BLOCK_MEDIUM_AND_ABOVE"
    | "BLOCK_HIGH_AND_ABOVE";
}

/**
 * Google grounding configuration
 */
export interface GoogleGroundingConfig {
  /** Enable Google Search grounding */
  googleSearchRetrieval?: boolean;
}

/**
 * xAI provider configuration
 */
export interface XAIProviderConfig extends BaseProviderConfig {
  // xAI uses OpenAI-compatible API, no extra config needed
}

/**
 * Azure OpenAI provider configuration
 */
export interface AzureProviderConfig extends BaseProviderConfig {
  /** Azure resource name */
  resourceName: string;
  /** Deployment name */
  deploymentName: string;
  /** API version (default: 2024-02-15-preview) */
  apiVersion?: string;
}

/**
 * Groq provider configuration
 */
export interface GroqProviderConfig extends BaseProviderConfig {
  // Groq uses OpenAI-compatible API, no extra config needed
}

/**
 * Ollama provider configuration
 */
export interface OllamaProviderConfig extends BaseProviderConfig {
  // baseUrl defaults to http://localhost:11434
}

// ============================================
// Model Information
// ============================================

/**
 * Model information for a provider
 */
export interface ModelInfo {
  /** Model ID */
  id: string;
  /** Display name */
  name: string;
  /** Description */
  description?: string;
  /** Capabilities */
  capabilities: ProviderCapabilities;
  /** Context window size */
  contextWindow: number;
  /** Pricing info (optional) */
  pricing?: {
    inputPerMillion?: number;
    outputPerMillion?: number;
  };
}

// ============================================
// Default Capabilities
// ============================================

/**
 * Default capabilities for unknown models
 */
export const DEFAULT_CAPABILITIES: ProviderCapabilities = {
  supportsVision: false,
  supportsTools: true,
  supportsThinking: false,
  supportsStreaming: true,
  supportsPDF: false,
  supportsAudio: false,
  supportsVideo: false,
  maxTokens: 8192,
  supportedImageTypes: [],
  supportsJsonMode: false,
  supportsSystemMessages: true,
};
