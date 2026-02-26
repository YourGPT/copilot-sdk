/**
 * Stream event types for llm-sdk
 * These types are used internally by the SDK for streaming responses
 */

/**
 * Stream event types
 */
export type StreamEventType =
  | "message:start"
  | "message:delta"
  | "message:end"
  | "thinking:start"
  | "thinking:delta"
  | "thinking:end"
  | "action:start"
  | "action:args"
  | "action:end"
  | "tool_calls"
  | "tool:result"
  | "citation"
  | "loop:iteration"
  | "loop:complete"
  | "error"
  | "done";

/**
 * Base event interface
 */
interface BaseEvent {
  type: StreamEventType;
}

/**
 * Message started streaming
 */
export interface MessageStartEvent extends BaseEvent {
  type: "message:start";
  id: string;
}

/**
 * Message content delta (incremental update)
 */
export interface MessageDeltaEvent extends BaseEvent {
  type: "message:delta";
  content: string;
}

/**
 * Message finished streaming
 */
export interface MessageEndEvent extends BaseEvent {
  type: "message:end";
}

/**
 * Thinking/reasoning started (for models like Claude, DeepSeek)
 */
export interface ThinkingStartEvent extends BaseEvent {
  type: "thinking:start";
}

/**
 * Thinking content delta
 */
export interface ThinkingDeltaEvent extends BaseEvent {
  type: "thinking:delta";
  content: string;
}

/**
 * Thinking finished
 */
export interface ThinkingEndEvent extends BaseEvent {
  type: "thinking:end";
}

/**
 * Action/tool execution started
 */
export interface ActionStartEvent extends BaseEvent {
  type: "action:start";
  id: string;
  name: string;
}

/**
 * Action arguments (streaming)
 */
export interface ActionArgsEvent extends BaseEvent {
  type: "action:args";
  id: string;
  args: string;
}

/**
 * Action execution completed
 */
export interface ActionEndEvent extends BaseEvent {
  type: "action:end";
  id: string;
  name?: string;
  result?: unknown;
  error?: string;
}

/**
 * Error event
 */
export interface ErrorEvent extends BaseEvent {
  type: "error";
  message: string;
  code?: string;
}

/**
 * Tool call information
 */
export interface ToolCallInfo {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

/**
 * Assistant message with tool calls
 */
export interface AssistantToolMessage {
  role: "assistant";
  content: string | null;
  tool_calls: Array<{
    id: string;
    type: "function";
    function: {
      name: string;
      arguments: string;
    };
  }>;
}

/**
 * Tool calls event - client should execute and send results
 */
export interface ToolCallsEvent extends BaseEvent {
  type: "tool_calls";
  toolCalls: ToolCallInfo[];
  assistantMessage: AssistantToolMessage;
}

/**
 * Tool result event
 */
export interface ToolResultEvent extends BaseEvent {
  type: "tool:result";
  id: string;
  name: string;
  result: ToolResponse;
}

/**
 * Loop iteration event
 */
export interface LoopIterationEvent extends BaseEvent {
  type: "loop:iteration";
  iteration: number;
  maxIterations: number;
}

/**
 * Loop complete event
 */
export interface LoopCompleteEvent extends BaseEvent {
  type: "loop:complete";
  iterations: number;
  aborted?: boolean;
  maxIterationsReached?: boolean;
}

/**
 * Citation from web search (unified format for all providers)
 */
export interface Citation {
  /** Unique citation index (1-based) */
  index: number;
  /** Source URL */
  url: string;
  /** Page title */
  title: string;
  /** Cited text snippet (optional) */
  citedText?: string;
  /** Source domain (extracted from URL) */
  domain?: string;
  /** Favicon URL (generated from domain) */
  favicon?: string;
}

/**
 * Citation event - web search returned citations
 */
export interface CitationEvent extends BaseEvent {
  type: "citation";
  citations: Citation[];
}

/**
 * Message format for done event (API format with snake_case)
 */
export interface DoneEventMessage {
  role: "assistant" | "tool";
  content: string | null;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: {
      name: string;
      arguments: string;
    };
  }>;
  tool_call_id?: string;
}

/**
 * Token usage (snake_case for API compatibility)
 */
export interface TokenUsageRaw {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens?: number;
}

/**
 * Stream completed
 */
export interface DoneEvent extends BaseEvent {
  type: "done";
  requiresAction?: boolean;
  messages?: DoneEventMessage[];
  /** Token usage (server-side only, stripped before sending to client) */
  usage?: TokenUsageRaw;
}

/**
 * Union of all stream events
 */
export type StreamEvent =
  | MessageStartEvent
  | MessageDeltaEvent
  | MessageEndEvent
  | ThinkingStartEvent
  | ThinkingDeltaEvent
  | ThinkingEndEvent
  | ActionStartEvent
  | ActionArgsEvent
  | ActionEndEvent
  | ToolCallsEvent
  | ToolResultEvent
  | CitationEvent
  | LoopIterationEvent
  | LoopCompleteEvent
  | ErrorEvent
  | DoneEvent;

/**
 * LLM configuration
 */
export interface LLMConfig {
  temperature?: number;
  maxTokens?: number;
}

/**
 * Tool call format (OpenAI style)
 */
export interface ToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

/**
 * Message role
 */
export type MessageRole = "system" | "user" | "assistant" | "tool";

/**
 * Message attachment
 */
export interface MessageAttachment {
  type: "image" | "file" | "audio" | "video";
  data?: string;
  url?: string;
  mimeType: string;
  filename?: string;
}

/**
 * Message metadata
 */
export interface MessageMetadata {
  thinking?: string;
  attachments?: MessageAttachment[];
  toolName?: string;
  [key: string]: unknown;
}

/**
 * Message type (simplified for llm-sdk)
 */
export interface Message {
  id: string;
  thread_id?: string;
  role: MessageRole;
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  metadata?: MessageMetadata;
  created_at?: Date;
}

/**
 * Action parameter definition
 */
export interface ActionParameter {
  type: string;
  description?: string;
  required?: boolean;
  enum?: string[];
  items?: ActionParameter;
  properties?: Record<string, ActionParameter>;
}

/**
 * Action definition for tool calling
 */
export interface ActionDefinition<TParams = Record<string, unknown>> {
  name: string;
  description: string;
  parameters?: Record<string, ActionParameter>;
  handler: (params: TParams) => unknown | Promise<unknown>;
}

/**
 * Tool location (server or client)
 */
export type ToolLocation = "server" | "client";

/**
 * Tool execution status
 */
export type ToolExecutionStatus =
  | "pending"
  | "executing"
  | "completed"
  | "error";

/**
 * Tool response
 */
export interface ToolResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  /** Internal: AI response mode override */
  _aiResponseMode?: AIResponseMode;
  /** Internal: AI content for multimodal response (images, etc.) */
  _aiContent?: AIContent[];
  /** Internal: AI context string override */
  _aiContext?: string;
}

/**
 * Tool context passed to handlers
 */
export interface ToolContext {
  userId?: string;
  threadId?: string;
  [key: string]: unknown;
}

/**
 * AI response mode for tool results
 */
export type AIResponseMode = "none" | "brief" | "full";

/**
 * AI content structure
 */
export interface AIContent {
  type?: "text" | "image";
  text?: string;
  mediaType?: string;
  data?: string;
  summary?: string;
  details?: string;
}

/**
 * JSON Schema for tool input
 */
export interface ToolInputSchema {
  type: "object";
  properties?: Record<string, unknown>;
  required?: string[];
}

/**
 * Tool AI context for result formatting
 */
export interface ToolAIContext {
  enabled?: boolean;
  mode?: AIResponseMode;
  content?: AIContent | ((result: unknown) => AIContent);
}

/**
 * Tool definition
 */
export interface ToolDefinition<TParams = Record<string, unknown>> {
  name: string;
  description: string;
  location: ToolLocation;
  title?: string | ((args: TParams) => string);
  inputSchema?: ToolInputSchema;
  handler?: (
    params: TParams,
    context?: ToolContext,
  ) => unknown | Promise<unknown>;
  render?: (props: unknown) => unknown;
  available?: boolean;
  needsApproval?: boolean;
  approvalMessage?: string | ((params: TParams) => string);
  /** AI response mode for this tool (none, brief, full) */
  aiResponseMode?: AIResponseMode;
  /** AI context string or function to generate context */
  aiContext?:
    | string
    | ((result: ToolResponse, args: Record<string, unknown>) => string);
}

/**
 * Agent loop configuration
 */
export interface AgentLoopConfig {
  maxIterations?: number;
  debug?: boolean;
  enabled?: boolean;
}

/**
 * Web search configuration for native provider search
 *
 * Enables native web search for supported providers:
 * - Anthropic: Uses Claude's built-in web search tool
 * - OpenAI: Uses GPT's web search preview
 * - Google: Uses Gemini's Google Search grounding
 *
 * @example
 * ```typescript
 * const runtime = createRuntime({
 *   provider: createAnthropic({ apiKey: '...' }),
 *   model: 'claude-sonnet-4-20250514',
 *   webSearch: true, // Enable with defaults
 * });
 *
 * // Or with configuration
 * const runtime = createRuntime({
 *   provider: createOpenAI({ apiKey: '...' }),
 *   model: 'gpt-4o',
 *   webSearch: {
 *     maxUses: 5,
 *     allowedDomains: ['docs.anthropic.com', 'openai.com'],
 *   },
 * });
 * ```
 */
export interface WebSearchConfig {
  /** Maximum number of search uses per request (default: unlimited) */
  maxUses?: number;
  /** Only search these domains (provider-specific support) */
  allowedDomains?: string[];
  /** Exclude these domains from search (provider-specific support) */
  blockedDomains?: string[];
  /** User location for localized results (Anthropic only) */
  userLocation?: {
    type: "approximate";
    city?: string;
    region?: string;
    country?: string;
    timezone?: string;
  };
}

/**
 * Unified tool call format
 */
export interface UnifiedToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

/**
 * Unified tool result format
 */
export interface UnifiedToolResult {
  toolCallId: string;
  content: string;
  success: boolean;
  error?: string;
}

/**
 * Tool execution state
 */
export interface ToolExecution {
  id: string;
  name: string;
  args: Record<string, unknown>;
  status: ToolExecutionStatus;
  result?: ToolResponse;
}

/**
 * Knowledge base provider
 */
export type KnowledgeBaseProvider =
  | "pinecone"
  | "qdrant"
  | "weaviate"
  | "custom";

/**
 * Knowledge base configuration
 */
export interface KnowledgeBaseConfig {
  id: string;
  name?: string;
  provider: KnowledgeBaseProvider;
  apiKey?: string;
  index?: string;
}

/**
 * Create a message helper
 */
export function createMessage(
  partial: Partial<Message> &
    Pick<Message, "role"> & { content?: string | null },
): Message {
  return {
    id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    thread_id: partial.thread_id,
    role: partial.role,
    content: partial.content ?? null,
    tool_calls: partial.tool_calls,
    tool_call_id: partial.tool_call_id,
    metadata: partial.metadata,
    created_at: partial.created_at ?? new Date(),
  };
}
