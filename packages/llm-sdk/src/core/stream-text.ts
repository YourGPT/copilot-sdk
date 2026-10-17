import { resolveToolOutput } from "./tool-output";
import {
  responseReplayMetadata,
  type ProviderMetadata,
} from "./openai-responses";
/**
 * streamText - Stream text from a language model
 *
 * @example
 * ```ts
 * import { streamText } from '@yourgpt/llm-sdk';
 * import { openai } from '@yourgpt/llm-sdk/openai';
 *
 * // Simple streaming
 * const result = await streamText({
 *   model: openai('gpt-4o'),
 *   prompt: 'Tell me a story.',
 * });
 *
 * // Option 1: Iterate text chunks
 * for await (const chunk of result.textStream) {
 *   process.stdout.write(chunk);
 * }
 *
 * // Option 2: Get full text
 * const text = await result.text;
 *
 * // Option 3: Return as Response (for API routes)
 * return result.toTextStreamResponse();
 * ```
 */

import type {
  StreamTextParams,
  StreamTextResult,
  StreamPart,
  CoreMessage,
  Tool,
  ToolCall,
  TokenUsage,
  FinishReason,
  ResponseOptions,
  StreamChunk,
} from "./types";
import { formatToolsForOpenAI, formatToolsForAnthropic } from "./tool";
import { throwIfAborted } from "./provider-error";

/**
 * Stream text from a language model
 *
 * @param params - Stream parameters
 * @returns Promise resolving to stream result with text stream and helpers
 */
export async function streamText(
  params: StreamTextParams,
): Promise<StreamTextResult> {
  const { model, tools, maxSteps = 1, signal } = params;

  if (params.responseFormat && model.capabilities.supportsJsonMode === false) {
    console.warn(
      `[llm-sdk] ${model.provider}/${model.modelId} does not support structured output (responseFormat); the request will be sent but the provider may ignore it.`,
    );
  }

  // State for collecting results
  let messages = buildMessages(params);
  let finalProviderMetadata: ProviderMetadata | undefined;
  let fullText = "";
  let finalUsage: TokenUsage = {
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
  };
  let finalFinishReason: FinishReason = "stop";

  // Create the stream generator
  async function* createFullStream(): AsyncGenerator<StreamPart> {
    for (let step = 0; step < maxSteps; step++) {
      yield { type: "step-start", step };

      // Check for abort
      if (signal?.aborted) {
        yield { type: "error", error: new Error("Stream aborted") };
        return;
      }

      // Format tools for this model's provider
      const formattedTools = tools
        ? formatToolsForProvider(tools, model.provider)
        : undefined;

      // Collect data from this step
      let stepText = "";
      let stepProviderMetadata: ProviderMetadata | undefined;
      const toolCalls: ToolCall[] = [];
      let currentToolCall: Partial<ToolCall> | null = null;
      let stepFinishReason: FinishReason = "stop";

      try {
        // Stream from model
        for await (const chunk of model.doStream({
          messages,
          openai: params.openai,
          tools: formattedTools,
          temperature: params.temperature,
          reasoningEffort: params.reasoningEffort,
          maxTokens: params.maxTokens,
          responseFormat: params.responseFormat,
          signal,
        })) {
          throwIfAborted(signal);
          switch (chunk.type) {
            case "text-delta":
              stepText += chunk.text;
              fullText += chunk.text;
              yield { type: "text-delta", text: chunk.text };
              break;

            case "tool-call":
              toolCalls.push(chunk.toolCall);
              yield {
                type: "tool-call-complete",
                toolCall: chunk.toolCall,
              };
              break;

            case "finish":
              stepProviderMetadata = chunk.providerMetadata;
              finalProviderMetadata = chunk.providerMetadata;
              stepFinishReason = chunk.finishReason;
              finalFinishReason = chunk.finishReason;
              if (chunk.usage) {
                finalUsage = {
                  promptTokens:
                    finalUsage.promptTokens + chunk.usage.promptTokens,
                  completionTokens:
                    finalUsage.completionTokens + chunk.usage.completionTokens,
                  totalTokens: finalUsage.totalTokens + chunk.usage.totalTokens,
                };
              }
              break;

            case "error":
              yield { type: "error", error: chunk.error };
              return;
          }
        }
      } catch (error) {
        yield {
          type: "error",
          error: error instanceof Error ? error : new Error(String(error)),
        };
        return;
      }

      yield {
        type: "step-finish",
        step,
        finishReason: stepFinishReason,
        providerMetadata: stepProviderMetadata,
      };
      messages = [
        ...messages,
        {
          role: "assistant",
          content: stepText || null,
          ...(toolCalls.length ? { toolCalls } : {}),
          ...(stepProviderMetadata
            ? { providerMetadata: responseReplayMetadata(stepProviderMetadata) }
            : {}),
        },
      ];
      if (toolCalls.length === 0 || !tools) break;

      // Execute each tool
      for (const call of toolCalls) {
        throwIfAborted(signal);
        const toolDef = tools[call.name];
        if (!toolDef) {
          const errorResult = { error: `Tool not found: ${call.name}` };
          yield {
            type: "tool-result",
            toolCallId: call.id,
            result: errorResult,
          };
          messages = [
            ...messages,
            {
              role: "tool",
              toolCallId: call.id,
              content: JSON.stringify(errorResult),
            },
          ];
          continue;
        }

        try {
          const parsedArgs = toolDef.parameters.parse(call.args);
          const result = await toolDef.execute(parsedArgs, {
            toolCallId: call.id,
            abortSignal: signal,
            messages,
          });
          throwIfAborted(signal);

          const modelOutput = resolveToolOutput(
            result,
            toolDef.toModelOutput?.(result),
          );
          yield {
            type: "tool-result",
            toolCallId: call.id,
            result,
            modelOutput,
          };
          messages = [
            ...messages,
            {
              role: "tool",
              toolCallId: call.id,
              content: modelOutput
                ? "[Tool returned content]"
                : JSON.stringify(result),
              ...(modelOutput ? { modelOutput } : {}),
            },
          ];
        } catch (error) {
          throwIfAborted(signal);
          const errorResult = {
            error:
              error instanceof Error ? error.message : "Tool execution failed",
          };
          yield {
            type: "tool-result",
            toolCallId: call.id,
            result: errorResult,
          };
          messages = [
            ...messages,
            {
              role: "tool",
              toolCallId: call.id,
              content: JSON.stringify(errorResult),
            },
          ];
        }
      }
    }

    // Final finish event
    yield {
      type: "finish",
      finishReason: finalFinishReason,
      usage: finalUsage,
      providerMetadata: finalProviderMetadata,
    };
  }

  // All readers share one execution. Retain parts for later/concurrent readers;
  // a result getter must never start another model request or run a tool again.
  const source = createFullStream();
  const parts: StreamPart[] = [];
  let finished = false;
  let failure: unknown;
  let pending: Promise<void> | undefined;

  async function advance(): Promise<void> {
    if (!pending) {
      pending = (async () => {
        try {
          const next = await source.next();
          if (next.done) finished = true;
          else parts.push(next.value);
        } catch (error) {
          failure = error;
          finished = true;
        }
      })();
    }
    const current = pending;
    await current;
    if (pending === current) pending = undefined;
  }

  async function* sharedStream(): AsyncGenerator<StreamPart> {
    let index = 0;
    while (true) {
      if (index < parts.length) yield parts[index++];
      else if (finished) {
        if (failure) throw failure;
        return;
      } else await advance();
    }
  }

  async function* createTextStream(): AsyncIterable<string> {
    for await (const part of sharedStream()) {
      if (part.type === "error") throw part.error;
      if (part.type === "text-delta") yield part.text;
    }
  }

  let completion: Promise<void> | undefined;
  function consumeStream(): Promise<void> {
    return (completion ??= (async () => {
      for await (const part of sharedStream()) {
        if (part.type === "error") throw part.error;
      }
    })());
  }

  return {
    textStream: createTextStream(),
    fullStream: sharedStream(),

    get response(): Promise<{ messages: CoreMessage[] }> {
      return consumeStream().then(() => ({ messages }));
    },
    get providerMetadata(): Promise<ProviderMetadata | undefined> {
      return consumeStream().then(() => finalProviderMetadata);
    },
    get text(): Promise<string> {
      return consumeStream().then(() => fullText);
    },
    get usage(): Promise<TokenUsage> {
      return consumeStream().then(() => finalUsage);
    },
    get finishReason(): Promise<FinishReason> {
      return consumeStream().then(() => finalFinishReason);
    },

    toTextStreamResponse(options?: ResponseOptions): Response {
      const stream = createTextStreamReadable(createTextStream());
      return new Response(stream, {
        status: options?.status ?? 200,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
          ...options?.headers,
        },
      });
    },

    toDataStreamResponse(options?: ResponseOptions): Response {
      const stream = createDataStreamReadable(sharedStream());
      return new Response(stream, {
        status: options?.status ?? 200,
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
          ...options?.headers,
        },
      });
    },
  };
}

// ============================================
// Helper Functions
// ============================================

/**
 * Build initial messages from params
 */
function buildMessages(params: StreamTextParams): CoreMessage[] {
  const messages: CoreMessage[] = [];

  if (params.system) {
    messages.push({ role: "system", content: params.system });
  }

  if (params.messages) {
    messages.push(...params.messages);
  }

  if (params.prompt) {
    messages.push({ role: "user", content: params.prompt });
  }

  return messages;
}

/**
 * Format tools based on provider
 */
function formatToolsForProvider(
  tools: Record<string, Tool<any, any>>,
  provider: string,
): unknown[] {
  switch (provider) {
    case "anthropic":
      return formatToolsForAnthropic(tools);
    case "openai":
    case "xai":
    case "azure":
    default:
      return formatToolsForOpenAI(tools);
  }
}

/**
 * Create a ReadableStream from text async iterable
 */
function createTextStreamReadable(
  textStream: AsyncIterable<string>,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      try {
        for await (const text of textStream) {
          controller.enqueue(encoder.encode(text));
        }
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });
}

/**
 * Create a ReadableStream for SSE data stream
 */
function createDataStreamReadable(
  fullStream: AsyncIterable<StreamPart>,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      try {
        for await (const part of fullStream) {
          const data = JSON.stringify(part);
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      } catch (error) {
        const errorData = JSON.stringify({
          type: "error",
          error: error instanceof Error ? error.message : String(error),
        });
        controller.enqueue(encoder.encode(`data: ${errorData}\n\n`));
        controller.close();
      }
    },
  });
}
