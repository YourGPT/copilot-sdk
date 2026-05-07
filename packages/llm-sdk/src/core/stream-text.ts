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
  let fullText = "";
  let finalUsage: TokenUsage = {
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
  };
  let finalFinishReason: FinishReason = "stop";

  // Create the stream generator
  async function* createFullStream(): AsyncGenerator<StreamPart> {
    let messages = buildMessages(params);

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
      const toolCalls: ToolCall[] = [];
      let currentToolCall: Partial<ToolCall> | null = null;
      let stepFinishReason: FinishReason = "stop";

      try {
        // Stream from model
        for await (const chunk of model.doStream({
          messages,
          tools: formattedTools,
          temperature: params.temperature,
          maxTokens: params.maxTokens,
          responseFormat: params.responseFormat,
          signal,
        })) {
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

      yield { type: "step-finish", step, finishReason: stepFinishReason };

      // If no tool calls, we're done
      if (toolCalls.length === 0 || !tools) {
        break;
      }

      // Execute tools and continue
      const assistantMessage: CoreMessage = {
        role: "assistant",
        content: stepText || null,
        toolCalls,
      };
      messages = [...messages, assistantMessage];

      // Execute each tool
      for (const call of toolCalls) {
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

          yield { type: "tool-result", toolCallId: call.id, result };
          messages = [
            ...messages,
            {
              role: "tool",
              toolCallId: call.id,
              content: JSON.stringify(result),
            },
          ];
        } catch (error) {
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
    };
  }

  // Create text-only stream
  async function* createTextStream(): AsyncIterable<string> {
    for await (const part of createFullStream()) {
      if (part.type === "text-delta") {
        yield part.text;
      }
    }
  }

  // Promises for lazy evaluation
  let textPromise: Promise<string> | undefined;
  let usagePromise: Promise<TokenUsage> | undefined;
  let finishReasonPromise: Promise<FinishReason> | undefined;

  // Consume stream to get final values
  async function consumeStream(): Promise<void> {
    for await (const _ of createFullStream()) {
      // Just consume to completion
    }
  }

  return {
    textStream: createTextStream(),
    fullStream: createFullStream(),

    get text(): Promise<string> {
      if (!textPromise) {
        textPromise = consumeStream().then(() => fullText);
      }
      return textPromise;
    },

    get usage(): Promise<TokenUsage> {
      if (!usagePromise) {
        usagePromise = consumeStream().then(() => finalUsage);
      }
      return usagePromise;
    },

    get finishReason(): Promise<FinishReason> {
      if (!finishReasonPromise) {
        finishReasonPromise = consumeStream().then(() => finalFinishReason);
      }
      return finishReasonPromise;
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
      const stream = createDataStreamReadable(createFullStream());
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
  tools: Record<string, Tool>,
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
