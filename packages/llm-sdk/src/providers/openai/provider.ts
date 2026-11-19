import { textToolOutput } from "../../core/tool-output";
import {
  assertToolTurnComplete,
  createToolCallSlotter,
  mapOpenAIFinishReason,
  parseToolArguments,
  validateToolCalls,
} from "../../core/tool-validation";
import {
  resolveOpenAITransport,
  useOpenAIResponses,
  type OpenAITransportOptions,
} from "../../core/openai-responses";
import { OpenAIAdapter } from "../../adapters/openai";
import type { ChatCompletionRequest } from "../../adapters/base";
import { type OpenAIParameterOptions } from "../../core/openai-parameters";
import {
  errorFromEvent,
  throwIfAborted,
  invalidProviderResponse,
} from "../../core/provider-error";
/**
 * OpenAI Provider - Modern Pattern
 *
 * Returns a LanguageModel instance that can be used directly with
 * generateText() and streamText().
 *
 * @example
 * ```ts
 * import { openai } from '@yourgpt/llm-sdk/openai';
 * import { generateText } from '@yourgpt/llm-sdk';
 *
 * const result = await generateText({
 *   model: openai('gpt-4o'),
 *   prompt: 'Hello!',
 * });
 * ```
 */

import type {
  LanguageModel,
  ModelCapabilities,
  DoGenerateParams,
  DoGenerateResult,
  StreamChunk,
  ToolCall,
  FinishReason,
  CoreMessage,
} from "../../core/types";
import {
  buildOpenAITokenParams,
  toOpenAIResponseFormat,
} from "../../adapters/base";

// ============================================
// Model Definitions
// ============================================

interface OpenAIModelConfig {
  vision: boolean;
  tools: boolean;
  jsonMode: boolean;
  maxTokens: number;
}

const OPENAI_MODELS: Record<string, OpenAIModelConfig> = {
  // GPT-4o series
  "gpt-4o": { vision: true, tools: true, jsonMode: true, maxTokens: 128000 },
  "gpt-5.2": {
    vision: true,
    tools: true,
    jsonMode: true,
    maxTokens: 128000,
  },
  "gpt-4o-2024-11-20": {
    vision: true,
    tools: true,
    jsonMode: true,
    maxTokens: 128000,
  },
  "gpt-4o-2024-08-06": {
    vision: true,
    tools: true,
    jsonMode: true,
    maxTokens: 128000,
  },

  // GPT-4 Turbo
  "gpt-4-turbo": {
    vision: true,
    tools: true,
    jsonMode: true,
    maxTokens: 128000,
  },
  "gpt-4-turbo-preview": {
    vision: false,
    tools: true,
    jsonMode: true,
    maxTokens: 128000,
  },

  // GPT-4
  "gpt-4": { vision: false, tools: true, jsonMode: false, maxTokens: 8192 },
  "gpt-4-32k": {
    vision: false,
    tools: true,
    jsonMode: false,
    maxTokens: 32768,
  },

  // GPT-3.5
  "gpt-3.5-turbo": {
    vision: false,
    tools: true,
    jsonMode: true,
    maxTokens: 16385,
  },

  // O1 series (reasoning)
  o1: { vision: true, tools: false, jsonMode: false, maxTokens: 128000 },
  "o1-mini": { vision: true, tools: false, jsonMode: false, maxTokens: 128000 },
  "o1-preview": {
    vision: true,
    tools: false,
    jsonMode: false,
    maxTokens: 128000,
  },

  // O3 series
  "o3-mini": { vision: true, tools: false, jsonMode: false, maxTokens: 128000 },
};

// ============================================
// Provider Options
// ============================================

export interface OpenAIProviderOptions
  extends OpenAIParameterOptions, OpenAITransportOptions {
  /** API key (defaults to OPENAI_API_KEY env var) */
  apiKey?: string;
  /** Base URL for API (defaults to https://api.openai.com/v1) */
  baseURL?: string;
  /** Organization ID */
  organization?: string;
  /** Default headers */
  headers?: Record<string, string>;
}

// ============================================
// Provider Implementation
// ============================================

/**
 * Create an OpenAI language model
 *
 * @param modelId - Model ID (e.g., 'gpt-4o', 'gpt-5.2')
 * @param options - Provider options
 * @returns LanguageModel instance
 *
 * @example
 * ```ts
 * // Basic usage
 * const model = openai('gpt-4o');
 *
 * // With custom options
 * const model = openai('gpt-4o', {
 *   apiKey: 'sk-...',
 *   baseURL: 'https://custom-endpoint.com/v1',
 * });
 * ```
 */
export function openai(
  modelId: string,
  options: OpenAIProviderOptions = {},
): LanguageModel {
  const apiKey = options.apiKey ?? process.env.OPENAI_API_KEY;
  const baseURL = options.baseURL ?? "https://api.openai.com/v1";

  // Lazy-load OpenAI client
  let client: any = null;
  async function getClient(): Promise<any> {
    if (!client) {
      const { default: OpenAI } = await import("openai");
      client = new OpenAI({
        apiKey,
        baseURL,
        organization: options.organization,
        defaultHeaders: options.headers,
      });
    }
    return client;
  }

  function parameterOptions(params: DoGenerateParams): OpenAIParameterOptions {
    return {
      ...options,
      reasoningEffort: params.reasoningEffort ?? options.reasoningEffort,
    };
  }

  function useResponses(params: DoGenerateParams): boolean {
    return useOpenAIResponses(
      modelId,
      baseURL,
      parameterOptions(params),
      resolveOpenAITransport(options, params.openai),
      !!params.tools?.length,
      params.messages.some(
        (message) =>
          message.role === "assistant" &&
          !!message.providerMetadata?.openai?.response,
      ),
    );
  }

  const responsesAdapter = new OpenAIAdapter({
    ...options,
    apiKey: apiKey ?? "",
    model: modelId,
    baseUrl: baseURL,
  });

  function responsesRequest(params: DoGenerateParams): ChatCompletionRequest {
    return {
      messages: [],
      rawMessages: formatMessagesForOpenAI(params.messages, true),
      toolDefinitions: params.tools?.map((raw) => {
        const tool = raw as {
          type: string;
          function: { name: string; description?: string; parameters?: any };
        };
        if (tool.type !== "function")
          throw new Error(
            "Only function tools are supported by this OpenAI generation path",
          );
        return {
          name: tool.function.name,
          description: tool.function.description ?? "",
          location: "server" as const,
          inputSchema: tool.function.parameters,
        };
      }),
      config: {
        openai: {
          ...resolveOpenAITransport(options, params.openai),
          api: "responses",
        },
        temperature: params.temperature,
        maxTokens: params.maxTokens,
        responseFormat: params.responseFormat,
        reasoningEffort: parameterOptions(params).reasoningEffort,
      },
      signal: params.signal,
    };
  }

  // Get model config
  const modelConfig = OPENAI_MODELS[modelId] ?? OPENAI_MODELS["gpt-4o"];

  return {
    provider: "openai",
    modelId,

    capabilities: {
      supportsVision: modelConfig.vision,
      supportsTools: modelConfig.tools,
      supportsStreaming: true,
      supportsJsonMode: modelConfig.jsonMode,
      supportsThinking: false,
      supportsPDF: false,
      maxTokens: modelConfig.maxTokens,
      supportedImageTypes: modelConfig.vision
        ? ["image/png", "image/jpeg", "image/gif", "image/webp"]
        : [],
    },

    async doGenerate(params: DoGenerateParams): Promise<DoGenerateResult> {
      throwIfAborted(params.signal);
      if (useResponses(params)) {
        const result = await responsesAdapter.complete(
          responsesRequest(params),
        );
        return {
          text: result.content,
          toolCalls: result.toolCalls,
          finishReason: result.toolCalls.length
            ? "tool-calls"
            : result.providerMetadata?.openai?.response?.refusals.length
              ? "content-filter"
              : "stop",
          usage: result.usage ?? {
            promptTokens: 0,
            completionTokens: 0,
            totalTokens: 0,
          },
          rawResponse: result.rawResponse,
          providerMetadata: result.providerMetadata,
        };
      }
      const client = await getClient();

      const messages = formatMessagesForOpenAI(params.messages);

      const response = await client.chat.completions.create(
        {
          model: modelId,
          messages,
          tools: params.tools as any,
          ...buildOpenAITokenParams(
            modelId,
            params.maxTokens,
            params.temperature,
            parameterOptions(params),
          ),
          response_format: toOpenAIResponseFormat(params.responseFormat),
        },
        { signal: params.signal },
      );

      const choice = response.choices[0];
      const message = choice.message;

      // Parse tool calls
      const toolCalls: ToolCall[] = (message.tool_calls ?? []).map(
        (tc: any) => ({
          id: tc.id,
          name: tc.function.name,
          args: parseToolArguments(tc.function.arguments),
        }),
      );

      validateToolCalls(toolCalls);
      if (choice.finish_reason)
        assertToolTurnComplete(
          choice.finish_reason,
          (message.tool_calls ?? []).map((tc: any) => tc.function?.arguments),
          "OpenAI response",
        );

      return {
        text: message.content ?? "",
        toolCalls,
        finishReason: mapOpenAIFinishReason(
          choice.finish_reason,
          toolCalls.length > 0,
        ),
        usage: {
          promptTokens: response.usage?.prompt_tokens ?? 0,
          completionTokens: response.usage?.completion_tokens ?? 0,
          totalTokens: response.usage?.total_tokens ?? 0,
        },
        rawResponse: response,
      };
    },

    async *doStream(params: DoGenerateParams): AsyncGenerator<StreamChunk> {
      throwIfAborted(params.signal);
      if (useResponses(params)) {
        const calls = new Map<string, { name: string; args: string }>();
        let hasTools = false;
        for await (const event of responsesAdapter.stream(
          responsesRequest(params),
        )) {
          switch (event.type) {
            case "message:delta":
              yield { type: "text-delta", text: event.content };
              break;
            case "action:start":
              calls.set(event.id, { name: event.name, args: "" });
              break;
            case "action:args": {
              const call = calls.get(event.id);
              if (call) call.args += event.args;
              break;
            }
            case "action:end": {
              const call = calls.get(event.id);
              if (!call)
                throw new Error("Responses tool call has no matching start");
              hasTools = true;
              yield {
                type: "tool-call",
                toolCall: {
                  id: event.id,
                  name: call.name,
                  args: JSON.parse(call.args || "{}"),
                },
              };
              calls.delete(event.id);
              break;
            }
            case "error":
              throw errorFromEvent(event);
            case "done":
              yield {
                type: "finish",
                finishReason: hasTools
                  ? "tool-calls"
                  : event.providerMetadata?.openai?.response?.refusals.length
                    ? "content-filter"
                    : "stop",
                providerMetadata: event.providerMetadata,
                usage: {
                  promptTokens: event.usage?.prompt_tokens ?? 0,
                  completionTokens: event.usage?.completion_tokens ?? 0,
                  totalTokens: event.usage?.total_tokens ?? 0,
                },
              };
              break;
          }
        }
        return;
      }
      const client = await getClient();

      const messages = formatMessagesForOpenAI(params.messages);

      const stream = await client.chat.completions.create(
        {
          model: modelId,
          messages,
          tools: params.tools as any,
          ...buildOpenAITokenParams(
            modelId,
            params.maxTokens,
            params.temperature,
            parameterOptions(params),
          ),
          response_format: toOpenAIResponseFormat(params.responseFormat),
          stream: true,
          stream_options: { include_usage: true },
        },
        { signal: params.signal },
      );

      const toolCalls = new Map<
        string,
        { id: string; name: string; arguments: string }
      >();
      const slotOf = createToolCallSlotter();
      let usage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
      let finishReason: string | undefined;
      for await (const chunk of stream) {
        throwIfAborted(params.signal);
        if (chunk.usage) {
          usage = {
            promptTokens: chunk.usage.prompt_tokens ?? 0,
            completionTokens: chunk.usage.completion_tokens ?? 0,
            totalTokens:
              chunk.usage.total_tokens ??
              (chunk.usage.prompt_tokens ?? 0) +
                (chunk.usage.completion_tokens ?? 0),
          };
        }
        const choice = chunk.choices?.[0];
        if (choice?.delta?.content)
          yield { type: "text-delta", text: choice.delta.content };
        for (const part of choice?.delta?.tool_calls ?? []) {
          const slot = slotOf(part);
          const call = toolCalls.get(slot) ?? {
            id: "",
            name: "",
            arguments: "",
          };
          if (part.id) call.id = part.id;
          if (part.function?.name) call.name += part.function.name;
          if (part.function?.arguments)
            call.arguments += part.function.arguments;
          toolCalls.set(slot, call);
        }
        if (choice?.finish_reason) finishReason = choice.finish_reason;
      }
      throwIfAborted(params.signal);
      if (!finishReason)
        throw invalidProviderResponse(
          "OpenAI stream ended without a finish reason",
        );
      // Parse all calls before yielding any executable call.
      const calls = [...toolCalls.values()].map((call) => {
        if (!call.id || !call.name)
          throw invalidProviderResponse(
            "OpenAI stream contains an incomplete tool call",
          );
        return {
          id: call.id,
          name: call.name,
          args: parseToolArguments(call.arguments),
        };
      });
      assertToolTurnComplete(
        finishReason,
        [...toolCalls.values()].map((call) => call.arguments),
        "OpenAI stream",
      );
      validateToolCalls(calls);
      for (const toolCall of calls) yield { type: "tool-call", toolCall };
      yield {
        type: "finish",
        finishReason: mapOpenAIFinishReason(finishReason, calls.length > 0),
        usage,
      };
    },
  };
}

// ============================================
// Helper Functions
// ============================================

/**
 * Format CoreMessage[] for OpenAI API
 */
function formatMessagesForOpenAI(
  messages: CoreMessage[],
  responses = false,
): any[] {
  return messages.map((msg) => {
    switch (msg.role) {
      case "system":
        return { role: "system", content: msg.content };

      case "user":
        if (typeof msg.content === "string") {
          return { role: "user", content: msg.content };
        }
        // Handle multimodal content
        return {
          role: "user",
          content: msg.content.map((part) => {
            if (part.type === "text") {
              return { type: "text", text: part.text };
            }
            if (part.type === "image") {
              const imageData =
                typeof part.image === "string"
                  ? part.image
                  : Buffer.from(part.image).toString("base64");
              const url = /^(data:|https?:\/\/)/.test(imageData)
                ? imageData
                : `data:${part.mimeType ?? "image/png"};base64,${imageData}`;
              return { type: "image_url", image_url: { url, detail: "auto" } };
            }
            if (part.type === "file") {
              if (!responses)
                throw new Error(
                  "File inputs require the Responses API on this OpenAI path",
                );
              return /^https?:\/\//.test(part.data)
                ? { type: "input_file", file_url: part.data }
                : {
                    type: "input_file",
                    filename: part.filename ?? "document.pdf",
                    file_data: part.data.startsWith("data:")
                      ? part.data
                      : `data:${part.mimeType};base64,${part.data}`,
                  };
            }
            throw new Error("Unsupported OpenAI message content");
          }),
        };

      case "assistant":
        const assistantMsg: any = {
          role: "assistant",
          content: msg.content,
          ...(responses && msg.providerMetadata
            ? { providerMetadata: msg.providerMetadata }
            : {}),
        };
        if (msg.toolCalls && msg.toolCalls.length > 0) {
          assistantMsg.tool_calls = msg.toolCalls.map((tc) => ({
            id: tc.id,
            type: "function",
            function: {
              name: tc.name,
              arguments: JSON.stringify(tc.args),
            },
          }));
        }
        return assistantMsg;

      case "tool":
        return {
          role: "tool",
          tool_call_id: msg.toolCallId,
          content: responses
            ? msg.content
            : textToolOutput(msg.modelOutput, msg.content),
          ...(responses && msg.modelOutput
            ? { modelOutput: msg.modelOutput }
            : {}),
        };

      default:
        return msg;
    }
  });
}

// Also export as createOpenAI for backward compatibility
export { openai as createOpenAI };
