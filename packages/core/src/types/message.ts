import { generateMessageId } from "../utils/id";

/**
 * Message roles in a conversation (OpenAI format)
 */
export type MessageRole = "user" | "assistant" | "system" | "tool";

/**
 * A source document from knowledge base
 */
export interface Source {
  /** Unique identifier */
  id: string;
  /** Source title or filename */
  title: string;
  /** Relevant content snippet */
  content: string;
  /** URL if available */
  url?: string;
  /** Relevance score (0-1) */
  score?: number;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Tool/function call in OpenAI format
 * Used in assistant messages when AI wants to call tools
 */
export interface ToolCall {
  /** Unique identifier for this call */
  id: string;
  /** Always "function" for OpenAI compatibility */
  type: "function";
  /** Function details */
  function: {
    /** Name of the function/tool */
    name: string;
    /** Arguments as JSON string (OpenAI format) */
    arguments: string;
  };
}

/**
 * Attachment in a message (images, files, etc.)
 *
 * Attachments can be stored as:
 * - Base64 data (free tier, embedded in message)
 * - URL (premium cloud storage, lighter payload)
 */
export interface MessageAttachment {
  /** Type of attachment */
  type: "image" | "file" | "audio" | "video";
  /** Base64 data (for embedded attachments) */
  data?: string;
  /** URL for cloud-stored attachments (managed cloud storage) */
  url?: string;
  /** MIME type */
  mimeType: string;
  /** Optional filename */
  filename?: string;
}

/**
 * Token usage information
 */
export interface TokenUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens?: number;
}

/**
 * Message metadata (flexible container for provider-specific data)
 */
export interface MessageMetadata {
  /** Extended thinking/reasoning (Claude, DeepSeek) */
  thinking?: string;
  /** Knowledge base sources */
  sources?: Source[];
  /** Attachments (images, files) */
  attachments?: MessageAttachment[];
  /** Model used to generate this message */
  model?: string;
  /** Token usage */
  usage?: TokenUsage;
  /** Any additional data */
  [key: string]: unknown;
}

/**
 * A message in the conversation (OpenAI format)
 *
 * This format is compatible with OpenAI's Chat Completions API
 * and can be stored directly in a database (1 row per message).
 *
 * Message types:
 * - user: User's input message
 * - assistant: AI's response (may include tool_calls)
 * - tool: Result of a tool execution (has tool_call_id)
 * - system: System prompt (usually first message)
 *
 * @example
 * // User message
 * { role: "user", content: "What's the weather?" }
 *
 * // Assistant requesting tool
 * { role: "assistant", content: null, tool_calls: [{...}] }
 *
 * // Tool result
 * { role: "tool", content: '{"temp": 72}', tool_call_id: "call_abc" }
 *
 * // Final assistant response
 * { role: "assistant", content: "The temperature is 72°F" }
 */
export interface Message {
  /** Unique identifier */
  id: string;

  /** Thread/conversation ID (for multi-session apps) */
  thread_id?: string;

  /** Role of the message sender */
  role: MessageRole;

  /** Text content (null for tool-calling assistant messages) */
  content: string | null;

  /**
   * Tool calls made by assistant (OpenAI format)
   * Only present when role is "assistant" and AI wants to call tools
   */
  tool_calls?: ToolCall[];

  /**
   * Tool call ID this message is responding to
   * Only present when role is "tool"
   */
  tool_call_id?: string;

  /**
   * Flexible metadata container
   * Contains: thinking, sources, attachments, model, usage, etc.
   */
  metadata?: MessageMetadata;

  /** When the message was created */
  created_at: Date;
}

/**
 * Helper to parse tool call arguments
 */
export function parseToolCallArgs<T = Record<string, unknown>>(
  toolCall: ToolCall,
): T {
  try {
    return JSON.parse(toolCall.function.arguments) as T;
  } catch {
    return {} as T;
  }
}

/**
 * Helper to create a tool call
 */
export function createToolCall(
  id: string,
  name: string,
  args: Record<string, unknown>,
): ToolCall {
  return {
    id,
    type: "function",
    function: {
      name,
      arguments: JSON.stringify(args),
    },
  };
}

/**
 * Create a new message with defaults
 */
export function createMessage(
  partial: Partial<Message> &
    Pick<Message, "role"> & { content?: string | null },
): Message {
  return {
    id: partial.id ?? generateMessageId(),
    thread_id: partial.thread_id,
    role: partial.role,
    content: partial.content ?? null,
    tool_calls: partial.tool_calls,
    tool_call_id: partial.tool_call_id,
    metadata: partial.metadata,
    created_at: partial.created_at ?? new Date(),
  };
}

/**
 * Create a user message
 */
export function createUserMessage(
  content: string,
  options?: {
    id?: string;
    thread_id?: string;
    attachments?: MessageAttachment[];
  },
): Message {
  return createMessage({
    id: options?.id,
    thread_id: options?.thread_id,
    role: "user",
    content,
    metadata: options?.attachments
      ? { attachments: options.attachments }
      : undefined,
  });
}

/**
 * Create an assistant message
 */
export function createAssistantMessage(
  content: string | null,
  options?: {
    id?: string;
    thread_id?: string;
    tool_calls?: ToolCall[];
    thinking?: string;
    sources?: Source[];
    model?: string;
  },
): Message {
  const metadata: MessageMetadata = {};
  if (options?.thinking) metadata.thinking = options.thinking;
  if (options?.sources) metadata.sources = options.sources;
  if (options?.model) metadata.model = options.model;

  return createMessage({
    id: options?.id,
    thread_id: options?.thread_id,
    role: "assistant",
    content,
    tool_calls: options?.tool_calls,
    metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
  });
}

/**
 * Create a tool result message
 */
export function createToolMessage(
  toolCallId: string,
  result: {
    success: boolean;
    data?: unknown;
    error?: string;
    message?: string;
  },
  options?: { id?: string; thread_id?: string },
): Message {
  return createMessage({
    id: options?.id,
    thread_id: options?.thread_id,
    role: "tool",
    content: JSON.stringify(result),
    tool_call_id: toolCallId,
  });
}

/**
 * Check if a message has tool calls
 */
export function hasToolCalls(message: Message): boolean {
  return (
    message.role === "assistant" &&
    Array.isArray(message.tool_calls) &&
    message.tool_calls.length > 0
  );
}

/**
 * Check if a message is a tool result
 */
export function isToolResult(message: Message): boolean {
  return message.role === "tool" && !!message.tool_call_id;
}
