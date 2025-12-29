import type {
  Message,
  MessageAttachment,
  ActionDefinition,
  StreamEvent,
  LLMConfig,
} from "@yourgpt/copilot-sdk-core";

/**
 * Chat completion request
 */
export interface ChatCompletionRequest {
  /** Conversation messages */
  messages: Message[];
  /**
   * Raw provider-formatted messages (for agent loop with tool calls)
   * When provided, these are used instead of converting from Message[]
   * This allows passing messages with tool_calls and tool role
   */
  rawMessages?: Array<Record<string, unknown>>;
  /** Available actions/tools */
  actions?: ActionDefinition[];
  /** System prompt */
  systemPrompt?: string;
  /** LLM configuration overrides */
  config?: Partial<LLMConfig>;
  /** Abort signal for cancellation */
  signal?: AbortSignal;
}

/**
 * Non-streaming completion result
 */
export interface CompletionResult {
  /** Text content */
  content: string;
  /** Tool calls */
  toolCalls: Array<{ id: string; name: string; args: Record<string, unknown> }>;
  /** Thinking content (if extended thinking enabled) */
  thinking?: string;
  /** Raw provider response for debugging */
  rawResponse: Record<string, unknown>;
}

/**
 * Base LLM adapter interface
 */
export interface LLMAdapter {
  /** Provider name */
  readonly provider: string;

  /** Model name */
  readonly model: string;

  /**
   * Stream a chat completion
   */
  stream(request: ChatCompletionRequest): AsyncGenerator<StreamEvent>;

  /**
   * Non-streaming chat completion (for debugging/comparison)
   */
  complete?(request: ChatCompletionRequest): Promise<CompletionResult>;
}

/**
 * Adapter factory function type
 */
export type AdapterFactory = (config: LLMConfig) => LLMAdapter;

/**
 * Convert messages to provider format (simple text only)
 */
export function formatMessages(
  messages: Message[],
  systemPrompt?: string,
): Array<{ role: string; content: string }> {
  const formatted: Array<{ role: string; content: string }> = [];

  // Add system prompt if provided
  if (systemPrompt) {
    formatted.push({ role: "system", content: systemPrompt });
  }

  // Add conversation messages
  for (const msg of messages) {
    formatted.push({
      role: msg.role,
      content: msg.content ?? "",
    });
  }

  return formatted;
}

/**
 * Convert ActionParameter to JSON Schema format recursively
 */
function parameterToJsonSchema(param: {
  type: string;
  description?: string;
  enum?: string[];
  items?: unknown;
  properties?: Record<string, unknown>;
}): Record<string, unknown> {
  const schema: Record<string, unknown> = {
    type: param.type,
  };

  if (param.description) {
    schema.description = param.description;
  }

  if (param.enum) {
    schema.enum = param.enum;
  }

  // Handle array items
  if (param.type === "array" && param.items) {
    schema.items = parameterToJsonSchema(
      param.items as {
        type: string;
        description?: string;
        enum?: string[];
        items?: unknown;
        properties?: Record<string, unknown>;
      },
    );
  }

  // Handle nested object properties
  if (param.type === "object" && param.properties) {
    schema.properties = Object.fromEntries(
      Object.entries(param.properties).map(([key, prop]) => [
        key,
        parameterToJsonSchema(
          prop as {
            type: string;
            description?: string;
            enum?: string[];
            items?: unknown;
            properties?: Record<string, unknown>;
          },
        ),
      ]),
    );
  }

  return schema;
}

/**
 * Convert actions to OpenAI tool format
 */
export function formatTools(actions: ActionDefinition[]): Array<{
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: object;
  };
}> {
  return actions.map((action) => ({
    type: "function" as const,
    function: {
      name: action.name,
      description: action.description,
      parameters: {
        type: "object",
        properties: action.parameters
          ? Object.fromEntries(
              Object.entries(action.parameters).map(([key, param]) => [
                key,
                parameterToJsonSchema(param),
              ]),
            )
          : {},
        required: action.parameters
          ? Object.entries(action.parameters)
              .filter(([, param]) => param.required)
              .map(([key]) => key)
          : [],
      },
    },
  }));
}

// ============================================
// Vision/Multimodal Support
// ============================================

/**
 * Content block types for multimodal messages
 */
export type AnthropicContentBlock =
  | { type: "text"; text: string }
  | {
      type: "image";
      source:
        | {
            type: "base64";
            media_type: string;
            data: string;
          }
        | {
            type: "url";
            url: string;
          };
    }
  | {
      type: "document";
      source:
        | {
            type: "base64";
            media_type: string;
            data: string;
          }
        | {
            type: "url";
            url: string;
          };
    };

export type OpenAIContentBlock =
  | { type: "text"; text: string }
  | {
      type: "image_url";
      image_url: {
        url: string;
        detail?: "low" | "high" | "auto";
      };
    };

/**
 * Check if a message has image attachments
 * Supports both new format (metadata.attachments) and legacy (attachments)
 */
export function hasImageAttachments(message: Message): boolean {
  const attachments = message.metadata?.attachments;
  return attachments?.some((a) => a.type === "image") ?? false;
}

/**
 * Check if a message has media attachments (images or PDFs)
 */
export function hasMediaAttachments(message: Message): boolean {
  const attachments = message.metadata?.attachments;
  return (
    attachments?.some(
      (a) =>
        a.type === "image" ||
        (a.type === "file" && a.mimeType === "application/pdf"),
    ) ?? false
  );
}

/**
 * Convert MessageAttachment to Anthropic image content block
 *
 * Anthropic format:
 * {
 *   type: "image",
 *   source: {
 *     type: "base64",
 *     media_type: "image/png",
 *     data: "base64data..."
 *   }
 * }
 */
export function attachmentToAnthropicImage(
  attachment: MessageAttachment,
): AnthropicContentBlock | null {
  if (attachment.type !== "image") return null;

  // Use URL if available (cloud storage)
  if (attachment.url) {
    return {
      type: "image",
      source: {
        type: "url",
        url: attachment.url,
      },
    };
  }

  // Fall back to base64 data
  if (!attachment.data) return null;

  // Extract base64 data (remove data URI prefix if present)
  let base64Data = attachment.data;
  if (base64Data.startsWith("data:")) {
    const commaIndex = base64Data.indexOf(",");
    if (commaIndex !== -1) {
      base64Data = base64Data.slice(commaIndex + 1);
    }
  }

  return {
    type: "image",
    source: {
      type: "base64",
      media_type: attachment.mimeType || "image/png",
      data: base64Data,
    },
  };
}

/**
 * Convert MessageAttachment to OpenAI image_url content block
 *
 * OpenAI format:
 * {
 *   type: "image_url",
 *   image_url: {
 *     url: "data:image/png;base64,..."
 *   }
 * }
 */
export function attachmentToOpenAIImage(
  attachment: MessageAttachment,
): OpenAIContentBlock | null {
  if (attachment.type !== "image") return null;

  let imageUrl: string;

  // Use URL if available (cloud storage)
  if (attachment.url) {
    imageUrl = attachment.url;
  } else if (attachment.data) {
    // Build data URI if not already one
    imageUrl = attachment.data.startsWith("data:")
      ? attachment.data
      : `data:${attachment.mimeType || "image/png"};base64,${attachment.data}`;
  } else {
    return null;
  }

  return {
    type: "image_url",
    image_url: {
      url: imageUrl,
      detail: "auto",
    },
  };
}

/**
 * Convert MessageAttachment (PDF) to Anthropic document content block
 *
 * Anthropic format:
 * {
 *   type: "document",
 *   source: {
 *     type: "base64",
 *     media_type: "application/pdf",
 *     data: "base64data..."
 *   }
 * }
 */
export function attachmentToAnthropicDocument(
  attachment: MessageAttachment,
): AnthropicContentBlock | null {
  // Only handle PDF files
  if (attachment.type !== "file" || attachment.mimeType !== "application/pdf") {
    return null;
  }

  // Use URL if available (cloud storage)
  if (attachment.url) {
    return {
      type: "document",
      source: {
        type: "url",
        url: attachment.url,
      },
    };
  }

  // Fall back to base64 data
  if (!attachment.data) return null;

  // Extract base64 data (remove data URI prefix if present)
  let base64Data = attachment.data;
  if (base64Data.startsWith("data:")) {
    const commaIndex = base64Data.indexOf(",");
    if (commaIndex !== -1) {
      base64Data = base64Data.slice(commaIndex + 1);
    }
  }

  return {
    type: "document",
    source: {
      type: "base64",
      media_type: "application/pdf",
      data: base64Data,
    },
  };
}

/**
 * Convert a Message to Anthropic multimodal content blocks
 */
export function messageToAnthropicContent(
  message: Message,
): string | AnthropicContentBlock[] {
  const attachments = message.metadata?.attachments;
  const content = message.content ?? "";

  // If no media attachments (images or PDFs), return simple string
  if (!hasMediaAttachments(message)) {
    return content;
  }

  // Build content blocks array
  const blocks: AnthropicContentBlock[] = [];

  // Add media attachments first (Claude recommends media before text)
  if (attachments) {
    for (const attachment of attachments) {
      // Try image first
      const imageBlock = attachmentToAnthropicImage(attachment);
      if (imageBlock) {
        blocks.push(imageBlock);
        continue;
      }
      // Try document (PDF)
      const docBlock = attachmentToAnthropicDocument(attachment);
      if (docBlock) {
        blocks.push(docBlock);
      }
    }
  }

  // Add text content
  if (content) {
    blocks.push({ type: "text", text: content });
  }

  return blocks;
}

/**
 * Convert a Message to OpenAI multimodal content blocks
 */
export function messageToOpenAIContent(
  message: Message,
): string | OpenAIContentBlock[] {
  const attachments = message.metadata?.attachments;
  const content = message.content ?? "";

  // If no image attachments, return simple string
  if (!hasImageAttachments(message)) {
    return content;
  }

  // Build content blocks array
  const blocks: OpenAIContentBlock[] = [];

  // Add text content first
  if (content) {
    blocks.push({ type: "text", text: content });
  }

  // Add image attachments
  if (attachments) {
    for (const attachment of attachments) {
      const imageBlock = attachmentToOpenAIImage(attachment);
      if (imageBlock) {
        blocks.push(imageBlock);
      }
    }
  }

  return blocks;
}

/**
 * Anthropic content block types (extended for tools)
 */
export type AnthropicToolUseBlock = {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
};

export type AnthropicToolResultBlock = {
  type: "tool_result";
  tool_use_id: string;
  content: string;
};

export type AnthropicMessageContent =
  | string
  | Array<
      AnthropicContentBlock | AnthropicToolUseBlock | AnthropicToolResultBlock
    >;

/**
 * Format messages for Anthropic with full tool support
 * Handles: text, images, tool_use, and tool_result
 *
 * Key differences from OpenAI:
 * - tool_calls become tool_use blocks in assistant content
 * - tool results become tool_result blocks in user content
 */
export function formatMessagesForAnthropic(
  messages: Message[],
  systemPrompt?: string,
): {
  system: string;
  messages: Array<{
    role: "user" | "assistant";
    content: AnthropicMessageContent;
  }>;
} {
  const formatted: Array<{
    role: "user" | "assistant";
    content: AnthropicMessageContent;
  }> = [];

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];

    if (msg.role === "system") continue; // System handled separately

    if (msg.role === "assistant") {
      // Build content array for assistant
      const content: Array<AnthropicContentBlock | AnthropicToolUseBlock> = [];

      // Add text content if present
      if (msg.content) {
        content.push({ type: "text", text: msg.content });
      }

      // Convert tool_calls to tool_use blocks
      if (msg.tool_calls && msg.tool_calls.length > 0) {
        for (const tc of msg.tool_calls) {
          content.push({
            type: "tool_use",
            id: tc.id,
            name: tc.function.name,
            input: JSON.parse(tc.function.arguments),
          });
        }
      }

      formatted.push({
        role: "assistant",
        content:
          content.length === 1 && content[0].type === "text"
            ? (content[0] as { type: "text"; text: string }).text
            : content,
      });
    } else if (msg.role === "tool" && msg.tool_call_id) {
      // Tool results go in user message as tool_result blocks
      // Group consecutive tool messages together
      const toolResults: AnthropicToolResultBlock[] = [
        {
          type: "tool_result",
          tool_use_id: msg.tool_call_id,
          content: msg.content ?? "",
        },
      ];

      // Look ahead for more consecutive tool messages
      while (i + 1 < messages.length && messages[i + 1].role === "tool") {
        i++;
        const nextTool = messages[i];
        if (nextTool.tool_call_id) {
          toolResults.push({
            type: "tool_result",
            tool_use_id: nextTool.tool_call_id,
            content: nextTool.content ?? "",
          });
        }
      }

      formatted.push({
        role: "user",
        content: toolResults,
      });
    } else if (msg.role === "user") {
      formatted.push({
        role: "user",
        content: messageToAnthropicContent(msg),
      });
    }
  }

  return {
    system: systemPrompt || "",
    messages: formatted,
  };
}

/**
 * OpenAI message format with tool support
 */
export type OpenAIMessage =
  | { role: "system"; content: string }
  | { role: "user"; content: string | OpenAIContentBlock[] }
  | {
      role: "assistant";
      content: string | null;
      tool_calls?: Array<{
        id: string;
        type: "function";
        function: { name: string; arguments: string };
      }>;
    }
  | { role: "tool"; content: string; tool_call_id: string };

/**
 * Format messages for OpenAI with full tool support
 * Handles: text, images, tool_calls, and tool results
 */
export function formatMessagesForOpenAI(
  messages: Message[],
  systemPrompt?: string,
): OpenAIMessage[] {
  const formatted: OpenAIMessage[] = [];

  // Add system prompt if provided
  if (systemPrompt) {
    formatted.push({ role: "system", content: systemPrompt });
  }

  for (const msg of messages) {
    if (msg.role === "system") {
      formatted.push({ role: "system", content: msg.content ?? "" });
    } else if (msg.role === "user") {
      formatted.push({
        role: "user",
        content: messageToOpenAIContent(msg),
      });
    } else if (msg.role === "assistant") {
      const assistantMsg: OpenAIMessage = {
        role: "assistant",
        content: msg.content,
      };
      if (msg.tool_calls && msg.tool_calls.length > 0) {
        (assistantMsg as { tool_calls: typeof msg.tool_calls }).tool_calls =
          msg.tool_calls;
      }
      formatted.push(assistantMsg);
    } else if (msg.role === "tool" && msg.tool_call_id) {
      formatted.push({
        role: "tool",
        content: msg.content ?? "",
        tool_call_id: msg.tool_call_id,
      });
    }
  }

  return formatted;
}
