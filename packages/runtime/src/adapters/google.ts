/**
 * Google Gemini LLM Adapter
 *
 * Supports: Gemini 2.0, 1.5 Pro, 1.5 Flash, etc.
 * Features: Vision, Audio, Video, PDF, Tools/Function Calling
 */

import type {
  LLMConfig,
  StreamEvent,
  Message,
} from "@yourgpt/copilot-sdk-core";
import {
  generateMessageId,
  generateToolCallId,
} from "@yourgpt/copilot-sdk-core";
import type {
  LLMAdapter,
  ChatCompletionRequest,
  CompletionResult,
} from "./base";
import { formatTools } from "./base";

// ============================================
// Types
// ============================================

/**
 * Google adapter configuration
 */
export interface GoogleAdapterConfig extends Partial<LLMConfig> {
  apiKey: string;
  model?: string;
  baseUrl?: string;
  /** Safety settings */
  safetySettings?: Array<{
    category: string;
    threshold: string;
  }>;
}

/**
 * Gemini content part types
 */
type GeminiPart =
  | { text: string }
  | { inlineData: { mimeType: string; data: string } }
  | { functionCall: { name: string; args: Record<string, unknown> } }
  | { functionResponse: { name: string; response: Record<string, unknown> } };

/**
 * Gemini message format
 */
interface GeminiContent {
  role: "user" | "model";
  parts: GeminiPart[];
}

/**
 * Gemini tool format
 */
interface GeminiFunctionDeclaration {
  name: string;
  description: string;
  parameters?: {
    type: string;
    properties?: Record<string, unknown>;
    required?: string[];
  };
}

// ============================================
// Content Conversion
// ============================================

/**
 * Convert attachment to Gemini inline data part
 * Note: Gemini requires base64 data for inline images. URL-based attachments
 * are not directly supported and will be skipped.
 */
function attachmentToGeminiPart(attachment: {
  type: string;
  data?: string;
  url?: string;
  mimeType?: string;
}): GeminiPart | null {
  // Gemini requires base64 data - URL-based attachments not supported
  if (!attachment.data) {
    // TODO: Could fetch URL and convert to base64, but that adds latency
    console.warn(
      "Gemini adapter: URL-based attachments not supported, skipping",
    );
    return null;
  }

  if (attachment.type === "image") {
    // Extract base64 data (remove data URI prefix if present)
    let base64Data = attachment.data;
    if (base64Data.startsWith("data:")) {
      const commaIndex = base64Data.indexOf(",");
      if (commaIndex !== -1) {
        base64Data = base64Data.slice(commaIndex + 1);
      }
    }

    return {
      inlineData: {
        mimeType: attachment.mimeType || "image/png",
        data: base64Data,
      },
    };
  }

  // Support for audio/video if present
  if (attachment.type === "audio" || attachment.type === "video") {
    let base64Data = attachment.data;
    if (base64Data.startsWith("data:")) {
      const commaIndex = base64Data.indexOf(",");
      if (commaIndex !== -1) {
        base64Data = base64Data.slice(commaIndex + 1);
      }
    }

    return {
      inlineData: {
        mimeType:
          attachment.mimeType ||
          (attachment.type === "audio" ? "audio/mp3" : "video/mp4"),
        data: base64Data,
      },
    };
  }

  return null;
}

/**
 * Convert Message to Gemini content format
 */
function messageToGeminiContent(msg: Message): GeminiContent | null {
  // Skip system messages (handled separately)
  if (msg.role === "system") return null;

  const parts: GeminiPart[] = [];

  // Handle tool messages - convert to function response
  if (msg.role === "tool" && msg.tool_call_id) {
    // Tool results need to be sent as functionResponse
    let responseData: Record<string, unknown>;
    try {
      responseData = JSON.parse(msg.content || "{}");
    } catch {
      responseData = { result: msg.content || "" };
    }

    // Need to get the tool name from somewhere - use tool_call_id as fallback
    // In practice, we'd need to track the mapping
    const toolName =
      (msg.metadata as { toolName?: string })?.toolName || "tool";

    parts.push({
      functionResponse: {
        name: toolName,
        response: responseData,
      },
    });

    return { role: "user", parts };
  }

  // Add text content
  if (msg.content) {
    parts.push({ text: msg.content });
  }

  // Add attachments (images, audio, video)
  const attachments = msg.metadata?.attachments;
  if (attachments && Array.isArray(attachments)) {
    for (const attachment of attachments) {
      const part = attachmentToGeminiPart(attachment);
      if (part) {
        parts.push(part);
      }
    }
  }

  // Handle assistant messages with tool_calls
  if (msg.role === "assistant" && msg.tool_calls && msg.tool_calls.length > 0) {
    for (const tc of msg.tool_calls) {
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(tc.function.arguments);
      } catch {
        // Keep empty args
      }
      parts.push({
        functionCall: {
          name: tc.function.name,
          args,
        },
      });
    }
  }

  if (parts.length === 0) return null;

  return {
    role: msg.role === "assistant" ? "model" : "user",
    parts,
  };
}

/**
 * Convert tools to Gemini function declarations
 */
function formatToolsForGemini(
  actions: ChatCompletionRequest["actions"],
): { functionDeclarations: GeminiFunctionDeclaration[] } | undefined {
  if (!actions || actions.length === 0) return undefined;

  return {
    functionDeclarations: actions.map((action) => ({
      name: action.name,
      description: action.description,
      parameters: action.parameters
        ? {
            type: "object",
            properties: Object.fromEntries(
              Object.entries(action.parameters).map(([key, param]) => [
                key,
                {
                  type: param.type,
                  description: param.description,
                  enum: param.enum,
                },
              ]),
            ),
            required: Object.entries(action.parameters)
              .filter(([, param]) => param.required)
              .map(([key]) => key),
          }
        : undefined,
    })),
  };
}

// ============================================
// Adapter Implementation
// ============================================

/**
 * Google Gemini LLM Adapter
 */
export class GoogleAdapter implements LLMAdapter {
  readonly provider = "google";
  readonly model: string;

  private client: any; // GoogleGenerativeAI client (lazy loaded)
  private config: GoogleAdapterConfig;

  constructor(config: GoogleAdapterConfig) {
    this.config = config;
    this.model = config.model || "gemini-2.0-flash";
  }

  private async getClient() {
    if (!this.client) {
      // Dynamic import to make @google/generative-ai optional
      const { GoogleGenerativeAI } = await import("@google/generative-ai");
      this.client = new GoogleGenerativeAI(this.config.apiKey);
    }
    return this.client;
  }

  async *stream(request: ChatCompletionRequest): AsyncGenerator<StreamEvent> {
    const client = await this.getClient();
    const modelId = request.config?.model || this.model;

    // Get the generative model
    const model = client.getGenerativeModel({
      model: modelId,
      safetySettings: this.config.safetySettings,
    });

    // Build contents array
    let contents: GeminiContent[] = [];
    let systemInstruction: string | undefined;

    // Handle raw messages (for agent loop)
    if (request.rawMessages && request.rawMessages.length > 0) {
      // Process raw messages
      for (const msg of request.rawMessages) {
        if (msg.role === "system") {
          systemInstruction = (systemInstruction || "") + (msg.content || "");
          continue;
        }

        const content = messageToGeminiContent(msg as unknown as Message);
        if (content) {
          contents.push(content);
        }
      }

      // Add system prompt if provided
      if (request.systemPrompt && !systemInstruction) {
        systemInstruction = request.systemPrompt;
      }
    } else {
      // Format from Message[]
      for (const msg of request.messages) {
        if (msg.role === "system") {
          systemInstruction = (systemInstruction || "") + (msg.content || "");
          continue;
        }

        const content = messageToGeminiContent(msg);
        if (content) {
          contents.push(content);
        }
      }

      if (request.systemPrompt) {
        systemInstruction = request.systemPrompt;
      }
    }

    // Ensure conversation starts with user
    if (contents.length === 0 || contents[0].role !== "user") {
      // Add an empty user message if needed
      contents = [{ role: "user", parts: [{ text: "" }] }, ...contents];
    }

    // Merge consecutive same-role messages (Gemini requires alternating roles)
    const mergedContents: GeminiContent[] = [];
    for (const content of contents) {
      const last = mergedContents[mergedContents.length - 1];
      if (last && last.role === content.role) {
        last.parts.push(...content.parts);
      } else {
        mergedContents.push({ ...content, parts: [...content.parts] });
      }
    }

    // Prepare tools
    const tools = formatToolsForGemini(request.actions);

    const messageId = generateMessageId();

    // Emit message start
    yield { type: "message:start", id: messageId };

    try {
      // Start chat session with system instruction
      const chat = model.startChat({
        history: mergedContents.slice(0, -1), // All but the last message
        systemInstruction: systemInstruction
          ? { parts: [{ text: systemInstruction }] }
          : undefined,
        tools: tools ? [tools] : undefined,
        generationConfig: {
          temperature: request.config?.temperature ?? this.config.temperature,
          maxOutputTokens: request.config?.maxTokens ?? this.config.maxTokens,
        },
      });

      // Get the last message content
      const lastMessage = mergedContents[mergedContents.length - 1];

      // Stream response
      const result = await chat.sendMessageStream(lastMessage.parts);

      let currentToolCall: {
        id: string;
        name: string;
        args: Record<string, unknown>;
      } | null = null;

      for await (const chunk of result.stream) {
        // Check for abort
        if (request.signal?.aborted) {
          break;
        }

        const candidate = chunk.candidates?.[0];
        if (!candidate?.content?.parts) continue;

        for (const part of candidate.content.parts) {
          // Handle text content
          if ("text" in part && part.text) {
            yield { type: "message:delta", content: part.text };
          }

          // Handle function calls
          if ("functionCall" in part && part.functionCall) {
            const fc = part.functionCall;
            const toolId = generateToolCallId();

            // Complete previous tool call if any
            if (currentToolCall) {
              yield {
                type: "action:args",
                id: currentToolCall.id,
                args: JSON.stringify(currentToolCall.args),
              };
            }

            currentToolCall = {
              id: toolId,
              name: fc.name,
              args: fc.args || {},
            };

            yield {
              type: "action:start",
              id: toolId,
              name: fc.name,
            };
          }
        }

        // Check for finish reason
        if (candidate.finishReason) {
          // Complete any pending tool call
          if (currentToolCall) {
            yield {
              type: "action:args",
              id: currentToolCall.id,
              args: JSON.stringify(currentToolCall.args),
            };
          }
        }
      }

      // Emit message end
      yield { type: "message:end" };
      yield { type: "done" };
    } catch (error) {
      yield {
        type: "error",
        message: error instanceof Error ? error.message : "Unknown error",
        code: "GOOGLE_ERROR",
      };
    }
  }

  /**
   * Non-streaming completion (optional, for debugging)
   */
  async complete(request: ChatCompletionRequest): Promise<CompletionResult> {
    const client = await this.getClient();
    const modelId = request.config?.model || this.model;

    const model = client.getGenerativeModel({
      model: modelId,
      safetySettings: this.config.safetySettings,
    });

    // Build contents (same as stream)
    let contents: GeminiContent[] = [];
    let systemInstruction: string | undefined;

    for (const msg of request.messages) {
      if (msg.role === "system") {
        systemInstruction = (systemInstruction || "") + (msg.content || "");
        continue;
      }

      const content = messageToGeminiContent(msg);
      if (content) {
        contents.push(content);
      }
    }

    if (request.systemPrompt) {
      systemInstruction = request.systemPrompt;
    }

    // Ensure conversation starts with user
    if (contents.length === 0 || contents[0].role !== "user") {
      contents = [{ role: "user", parts: [{ text: "" }] }, ...contents];
    }

    // Merge consecutive same-role messages
    const mergedContents: GeminiContent[] = [];
    for (const content of contents) {
      const last = mergedContents[mergedContents.length - 1];
      if (last && last.role === content.role) {
        last.parts.push(...content.parts);
      } else {
        mergedContents.push({ ...content, parts: [...content.parts] });
      }
    }

    const tools = formatToolsForGemini(request.actions);

    const chat = model.startChat({
      history: mergedContents.slice(0, -1),
      systemInstruction: systemInstruction
        ? { parts: [{ text: systemInstruction }] }
        : undefined,
      tools: tools ? [tools] : undefined,
      generationConfig: {
        temperature: request.config?.temperature ?? this.config.temperature,
        maxOutputTokens: request.config?.maxTokens ?? this.config.maxTokens,
      },
    });

    const lastMessage = mergedContents[mergedContents.length - 1];
    const result = await chat.sendMessage(lastMessage.parts);
    const response = result.response;

    // Extract content and tool calls
    let textContent = "";
    const toolCalls: CompletionResult["toolCalls"] = [];

    const candidate = response.candidates?.[0];
    if (candidate?.content?.parts) {
      for (const part of candidate.content.parts) {
        if ("text" in part && part.text) {
          textContent += part.text;
        }
        if ("functionCall" in part && part.functionCall) {
          toolCalls.push({
            id: generateToolCallId(),
            name: part.functionCall.name,
            args: part.functionCall.args || {},
          });
        }
      }
    }

    return {
      content: textContent,
      toolCalls,
      rawResponse: response as Record<string, unknown>,
    };
  }
}

/**
 * Create Google Gemini adapter
 */
export function createGoogleAdapter(
  config: GoogleAdapterConfig,
): GoogleAdapter {
  return new GoogleAdapter(config);
}
