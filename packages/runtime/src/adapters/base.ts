import type {
  Message,
  MessageAttachment,
  ActionDefinition,
  StreamEvent,
  LLMConfig,
} from "@yourgpt/core";

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
   * Non-streaming chat completion
   */
  complete?(request: ChatCompletionRequest): Promise<Message>;
}

/**
 * Adapter factory function type
 */
export type AdapterFactory = (config: LLMConfig) => LLMAdapter;

/**
 * Convert messages to provider format
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
      content: msg.content,
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
      source: {
        type: "base64";
        media_type: string;
        data: string;
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
 */
export function hasImageAttachments(message: Message): boolean {
  return message.attachments?.some((a) => a.type === "image") ?? false;
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

  // Build data URI if not already one
  let dataUri = attachment.data;
  if (!dataUri.startsWith("data:")) {
    const mimeType = attachment.mimeType || "image/png";
    dataUri = `data:${mimeType};base64,${attachment.data}`;
  }

  return {
    type: "image_url",
    image_url: {
      url: dataUri,
      detail: "auto",
    },
  };
}

/**
 * Convert a Message to Anthropic multimodal content blocks
 */
export function messageToAnthropicContent(
  message: Message,
): string | AnthropicContentBlock[] {
  // If no image attachments, return simple string
  if (!hasImageAttachments(message)) {
    return message.content;
  }

  // Build content blocks array
  const blocks: AnthropicContentBlock[] = [];

  // Add image attachments first (Claude recommends images before text)
  if (message.attachments) {
    for (const attachment of message.attachments) {
      const imageBlock = attachmentToAnthropicImage(attachment);
      if (imageBlock) {
        blocks.push(imageBlock);
      }
    }
  }

  // Add text content
  if (message.content) {
    blocks.push({ type: "text", text: message.content });
  }

  return blocks;
}

/**
 * Convert a Message to OpenAI multimodal content blocks
 */
export function messageToOpenAIContent(
  message: Message,
): string | OpenAIContentBlock[] {
  // If no image attachments, return simple string
  if (!hasImageAttachments(message)) {
    return message.content;
  }

  // Build content blocks array
  const blocks: OpenAIContentBlock[] = [];

  // Add text content first
  if (message.content) {
    blocks.push({ type: "text", text: message.content });
  }

  // Add image attachments
  if (message.attachments) {
    for (const attachment of message.attachments) {
      const imageBlock = attachmentToOpenAIImage(attachment);
      if (imageBlock) {
        blocks.push(imageBlock);
      }
    }
  }

  return blocks;
}

/**
 * Format messages for Anthropic with multimodal support
 */
export function formatMessagesForAnthropic(
  messages: Message[],
  systemPrompt?: string,
): {
  system: string;
  messages: Array<{ role: string; content: string | AnthropicContentBlock[] }>;
} {
  const formatted: Array<{
    role: string;
    content: string | AnthropicContentBlock[];
  }> = [];

  for (const msg of messages) {
    if (msg.role === "system") continue; // System handled separately

    formatted.push({
      role: msg.role === "assistant" ? "assistant" : "user",
      content: messageToAnthropicContent(msg),
    });
  }

  return {
    system: systemPrompt || "",
    messages: formatted,
  };
}

/**
 * Format messages for OpenAI with multimodal support
 */
export function formatMessagesForOpenAI(
  messages: Message[],
  systemPrompt?: string,
): Array<{ role: string; content: string | OpenAIContentBlock[] }> {
  const formatted: Array<{
    role: string;
    content: string | OpenAIContentBlock[];
  }> = [];

  // Add system prompt if provided
  if (systemPrompt) {
    formatted.push({ role: "system", content: systemPrompt });
  }

  for (const msg of messages) {
    formatted.push({
      role: msg.role,
      content: messageToOpenAIContent(msg),
    });
  }

  return formatted;
}
