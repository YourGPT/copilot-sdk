import type {
  StreamEvent,
  Message,
  MessageAttachment,
} from "../core/stream-events";
import { generateMessageId, generateToolCallId } from "../core/utils";
import type { LLMAdapter, ChatCompletionRequest } from "./base";
import { formatMessages, formatTools } from "./base";
import type { OllamaModelOptions } from "../providers/types";

/**
 * Ollama adapter configuration
 */
export interface OllamaAdapterConfig {
  model?: string;
  baseUrl?: string;
  temperature?: number;
  maxTokens?: number;
  /** Ollama-specific model options */
  options?: OllamaModelOptions;
}

/**
 * Ollama message format with vision support
 */
interface OllamaMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  images?: string[];
  tool_calls?: Array<{
    id?: string;
    function: {
      name: string;
      arguments: Record<string, unknown>;
    };
  }>;
  tool_call_id?: string;
}

/**
 * Extract base64 data from attachment
 * Removes data URI prefix if present
 */
function extractBase64Data(data: string): string {
  if (data.startsWith("data:")) {
    const commaIndex = data.indexOf(",");
    if (commaIndex !== -1) {
      return data.slice(commaIndex + 1);
    }
  }
  return data;
}

/**
 * Download image from URL and convert to base64
 * Following Vercel AI SDK pattern
 */
async function downloadImageAsBase64(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;

    const buffer = await response.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");
    return base64;
  } catch {
    return null;
  }
}

/**
 * Extract images from message attachments
 * Returns array of base64 strings (Ollama format)
 */
async function extractImagesFromAttachments(
  attachments?: MessageAttachment[],
): Promise<string[]> {
  if (!attachments) return [];

  const images: string[] = [];

  for (const attachment of attachments) {
    if (attachment.type !== "image") continue;

    if (attachment.data) {
      // Use base64 data directly
      images.push(extractBase64Data(attachment.data));
    } else if (attachment.url) {
      // Download image from URL (like Vercel AI SDK does)
      const base64 = await downloadImageAsBase64(attachment.url);
      if (base64) {
        images.push(base64);
      }
    }
  }

  return images;
}

/**
 * Format messages for Ollama with vision and tool support
 */
async function formatMessagesForOllama(
  messages: Message[],
  systemPrompt?: string,
): Promise<OllamaMessage[]> {
  const formatted: OllamaMessage[] = [];

  // Add system prompt if provided
  if (systemPrompt) {
    formatted.push({ role: "system", content: systemPrompt });
  }

  for (const msg of messages) {
    const baseMessage: OllamaMessage = {
      role: msg.role as OllamaMessage["role"],
      content: msg.content ?? "",
    };

    // Handle image attachments (vision support)
    if (msg.role === "user" && msg.metadata?.attachments) {
      const images = await extractImagesFromAttachments(
        msg.metadata.attachments,
      );
      if (images.length > 0) {
        baseMessage.images = images;
      }
    }

    // Handle tool calls on assistant messages
    if (
      msg.role === "assistant" &&
      msg.tool_calls &&
      msg.tool_calls.length > 0
    ) {
      baseMessage.tool_calls = msg.tool_calls.map((tc) => ({
        id: tc.id,
        function: {
          name: tc.function.name,
          arguments: JSON.parse(tc.function.arguments),
        },
      }));
    }

    // Handle tool results
    if (msg.role === "tool" && msg.tool_call_id) {
      baseMessage.tool_call_id = msg.tool_call_id;
    }

    formatted.push(baseMessage);
  }

  return formatted;
}

/**
 * Process raw messages for Ollama
 * Handles conversion of attachments to Ollama image format
 */
async function processRawMessagesForOllama(
  rawMessages: Array<Record<string, unknown>>,
  systemPrompt?: string,
): Promise<OllamaMessage[]> {
  const processed: OllamaMessage[] = [];

  // Add system prompt if provided and not already present
  if (systemPrompt) {
    const hasSystem = rawMessages.some((m) => m.role === "system");
    if (!hasSystem) {
      processed.push({ role: "system", content: systemPrompt });
    }
  }

  for (const msg of rawMessages) {
    const baseMessage: OllamaMessage = {
      role: msg.role as OllamaMessage["role"],
      content: (msg.content as string) ?? "",
    };

    // Handle attachments for vision
    if (
      msg.role === "user" &&
      msg.attachments &&
      Array.isArray(msg.attachments)
    ) {
      const attachments = msg.attachments as MessageAttachment[];
      const images = await extractImagesFromAttachments(attachments);
      if (images.length > 0) {
        baseMessage.images = images;
      }
    }

    // Handle tool calls
    if (msg.tool_calls && Array.isArray(msg.tool_calls)) {
      baseMessage.tool_calls = (
        msg.tool_calls as Array<{
          id: string;
          type: string;
          function: { name: string; arguments: string };
        }>
      ).map((tc) => ({
        id: tc.id,
        function: {
          name: tc.function.name,
          arguments:
            typeof tc.function.arguments === "string"
              ? JSON.parse(tc.function.arguments)
              : tc.function.arguments,
        },
      }));
    }

    // Handle tool result
    if (msg.tool_call_id) {
      baseMessage.tool_call_id = msg.tool_call_id as string;
    }

    processed.push(baseMessage);
  }

  return processed;
}

/**
 * Ollama LLM Adapter (Local models)
 *
 * Supports: Llama 3, Mistral, Phi, Gemma, CodeLlama, LLaVA (vision), etc.
 *
 * Features:
 * - Tool/function calling (OpenAI-compatible format)
 * - Vision support (images via base64)
 * - Ollama-specific options (num_ctx, mirostat, etc.)
 * - Raw message support for agent loop
 */
export class OllamaAdapter implements LLMAdapter {
  readonly provider = "ollama";
  readonly model: string;

  private baseUrl: string;
  private config: OllamaAdapterConfig;

  constructor(config: OllamaAdapterConfig = {}) {
    this.config = config;
    this.model = config.model || "llama3";
    this.baseUrl = config.baseUrl || "http://localhost:11434";
  }

  async *stream(request: ChatCompletionRequest): AsyncGenerator<StreamEvent> {
    // Prepare messages - use rawMessages if provided (for agent loop), otherwise format from Message[]
    let messages: OllamaMessage[];

    if (request.rawMessages && request.rawMessages.length > 0) {
      messages = await processRawMessagesForOllama(
        request.rawMessages,
        request.systemPrompt,
      );
    } else {
      messages = await formatMessagesForOllama(
        request.messages,
        request.systemPrompt,
      );
    }

    // Format tools for Ollama (OpenAI-compatible format)
    const tools = request.actions?.length
      ? formatTools(request.actions)
      : undefined;

    const messageId = generateMessageId();

    // Emit message start
    yield { type: "message:start", id: messageId };

    try {
      // Build Ollama options
      const ollamaOptions: Record<string, unknown> = {
        temperature: request.config?.temperature ?? this.config.temperature,
      };

      // Add num_predict for maxTokens
      const maxTokens = request.config?.maxTokens ?? this.config.maxTokens;
      if (maxTokens !== undefined) {
        ollamaOptions.num_predict = maxTokens;
      }

      // Merge in Ollama-specific options
      if (this.config.options) {
        Object.assign(ollamaOptions, this.config.options);
      }

      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: request.config?.model || this.model,
          messages,
          tools,
          stream: true,
          options: ollamaOptions,
        }),
        signal: request.signal,
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "Unknown error");
        throw new Error(`Ollama API error: ${response.status} - ${errorText}`);
      }

      if (!response.body) {
        throw new Error("No response body");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let hasEmittedToolCalls = false;

      // Track accumulated tool calls for streaming
      const toolCallsInProgress: Map<
        number,
        { id: string; name: string; arguments: Record<string, unknown> }
      > = new Map();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;

          try {
            const chunk = JSON.parse(line);

            // Handle content
            if (chunk.message?.content) {
              yield { type: "message:delta", content: chunk.message.content };
            }

            // Handle tool calls from Ollama
            if (chunk.message?.tool_calls && !hasEmittedToolCalls) {
              for (let i = 0; i < chunk.message.tool_calls.length; i++) {
                const toolCall = chunk.message.tool_calls[i];
                const toolCallId = toolCall.id || generateToolCallId();

                // Store the tool call
                toolCallsInProgress.set(i, {
                  id: toolCallId,
                  name: toolCall.function?.name || "",
                  arguments: toolCall.function?.arguments || {},
                });

                // Emit action start
                yield {
                  type: "action:start",
                  id: toolCallId,
                  name: toolCall.function?.name || "",
                };

                // Emit action args (Ollama sends complete args, not streamed)
                yield {
                  type: "action:args",
                  id: toolCallId,
                  args: JSON.stringify(toolCall.function?.arguments || {}),
                };
              }
              hasEmittedToolCalls = true;
            }

            // Ollama indicates completion with done: true
            if (chunk.done) {
              break;
            }
          } catch {
            // Skip invalid JSON
          }
        }
      }

      yield { type: "message:end" };
      yield { type: "done" };
    } catch (error) {
      if ((error as Error).name === "AbortError") {
        yield { type: "done" };
      } else {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";

        // Provide helpful error messages for common issues
        let code = "OLLAMA_ERROR";
        let message = errorMessage;

        if (
          errorMessage.includes("ECONNREFUSED") ||
          errorMessage.includes("fetch failed")
        ) {
          message = `Cannot connect to Ollama at ${this.baseUrl}. Make sure Ollama is running (ollama serve).`;
          code = "OLLAMA_CONNECTION_ERROR";
        } else if (
          errorMessage.includes("model") &&
          errorMessage.includes("not found")
        ) {
          message = `Model "${this.model}" not found. Pull it with: ollama pull ${this.model}`;
          code = "OLLAMA_MODEL_NOT_FOUND";
        }

        yield {
          type: "error",
          message,
          code,
        };
      }
    }
  }
}

/**
 * Create Ollama adapter
 */
export function createOllamaAdapter(
  config?: OllamaAdapterConfig,
): OllamaAdapter {
  return new OllamaAdapter(config);
}
