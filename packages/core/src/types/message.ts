import { generateMessageId } from "../utils/id";

/**
 * Message roles in a conversation
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
 * Tool/action call made by assistant
 */
export interface ToolCall {
  /** Unique identifier for this call */
  id: string;
  /** Name of the tool/action */
  name: string;
  /** Arguments passed to the tool */
  arguments: Record<string, unknown>;
}

/**
 * Result of a tool/action execution
 */
export interface ToolResult {
  /** ID of the tool call this is responding to */
  toolCallId: string;
  /** Result content */
  content: string;
  /** Whether execution was successful */
  success: boolean;
  /** Error message if failed */
  error?: string;
}

/**
 * Attachment in a message (images, files, etc.)
 */
export interface MessageAttachment {
  /** Type of attachment */
  type: "image" | "file" | "audio" | "video";
  /** Base64 data or URL */
  data: string;
  /** MIME type */
  mimeType: string;
  /** Optional filename */
  filename?: string;
}

/**
 * A message in the conversation
 */
export interface Message {
  /** Unique identifier */
  id: string;
  /** Role of the message sender */
  role: MessageRole;
  /** Text content */
  content: string;
  /** Thinking/reasoning content (for models like Claude, DeepSeek with extended thinking) */
  thinking?: string;
  /** Tool calls made by assistant */
  toolCalls?: ToolCall[];
  /** Tool result if this is a tool message */
  toolResult?: ToolResult;
  /** Sources from knowledge base */
  sources?: Source[];
  /** Attachments (images, files) */
  attachments?: MessageAttachment[];
  /** Additional metadata */
  metadata?: Record<string, unknown>;
  /** When the message was created */
  createdAt: Date;
}

/**
 * Create a new message with defaults
 */
export function createMessage(
  partial: Partial<Message> & Pick<Message, "role" | "content">,
): Message {
  return {
    id: partial.id ?? generateMessageId(),
    role: partial.role,
    content: partial.content,
    thinking: partial.thinking,
    toolCalls: partial.toolCalls,
    toolResult: partial.toolResult,
    sources: partial.sources,
    attachments: partial.attachments,
    metadata: partial.metadata,
    createdAt: partial.createdAt ?? new Date(),
  };
}
