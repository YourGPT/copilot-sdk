import { responseReplayMetadata } from "./openai-responses";
import { resolveToolOutput } from "./tool-output";
/**
 * generateText - Generate text using a language model
 *
 * @example
 * ```ts
 * import { generateText } from '@yourgpt/llm-sdk';
 * import { openai } from '@yourgpt/llm-sdk/openai';
 *
 * // Simple usage
 * const result = await generateText({
 *   model: openai('gpt-4o'),
 *   prompt: 'Explain quantum computing in simple terms.',
 * });
 * console.log(result.text);
 *
 * // With tools (agentic)
 * const result = await generateText({
 *   model: openai('gpt-4o'),
 *   prompt: 'What is the weather in Tokyo?',
 *   tools: { weather: weatherTool },
 *   maxSteps: 5,
 * });
 * ```
 */

import type {
  GenerateTextParams,
  AssistantMessage,
  ToolMessage,
  GenerateTextResult,
  GenerateStep,
  CoreMessage,
  Tool,
  ToolCall,
  ToolResult,
  TokenUsage,
  FinishReason,
} from "./types";
import { formatToolsForOpenAI, formatToolsForAnthropic } from "./tool";
import { throwIfAborted } from "./provider-error";

/**
 * Generate text using a language model
 *
 * @param params - Generation parameters
 * @returns Promise resolving to generation result with text, usage, and tool interactions
 */
export async function generateText(
  params: GenerateTextParams,
): Promise<GenerateTextResult> {
  const { model, tools, maxSteps = 1, signal } = params;

  if (params.responseFormat && model.capabilities.supportsJsonMode === false) {
    console.warn(
      `[llm-sdk] ${model.provider}/${model.modelId} does not support structured output (responseFormat); the request will be sent but the provider may ignore it.`,
    );
  }

  // Build initial messages
  let messages = buildMessages(params);
  const steps: GenerateStep[] = [];
  const allToolCalls: ToolCall[] = [];
  const allToolResults: ToolResult[] = [];

  // Agent loop - keep going until no more tool calls or max steps reached
  for (let step = 0; step < maxSteps; step++) {
    // Check for abort
    throwIfAborted(signal);

    // Format tools for this model's provider
    const formattedTools = tools
      ? formatToolsForProvider(tools, model.provider)
      : undefined;

    // Call model
    const result = await model.doGenerate({
      messages,
      openai: params.openai,
      tools: formattedTools,
      temperature: params.temperature,
      reasoningEffort: params.reasoningEffort,
      maxTokens: params.maxTokens,
      responseFormat: params.responseFormat,
      signal,
    });
    throwIfAborted(signal);

    const toolCalls = result.toolCalls ?? [];

    // Record this step
    const stepToolResults: ToolResult[] = [];

    // If there are tool calls, execute them
    if (toolCalls.length > 0 && tools) {
      allToolCalls.push(...toolCalls);

      // Execute each tool
      for (const call of toolCalls) {
        throwIfAborted(signal);
        const toolDef = tools[call.name];
        if (!toolDef) {
          const errorResult: ToolResult = {
            toolCallId: call.id,
            result: { error: `Tool not found: ${call.name}` },
          };
          stepToolResults.push(errorResult);
          allToolResults.push(errorResult);
          continue;
        }

        try {
          // Validate and execute
          const parsedArgs = toolDef.parameters.parse(call.args);
          const toolResult = await toolDef.execute(parsedArgs, {
            toolCallId: call.id,
            abortSignal: signal,
            messages,
          });
          throwIfAborted(signal);

          const result: ToolResult = {
            toolCallId: call.id,
            result: toolResult,
            modelOutput: resolveToolOutput(
              toolResult,
              toolDef.toModelOutput?.(toolResult),
            ),
          };
          stepToolResults.push(result);
          allToolResults.push(result);
        } catch (error) {
          throwIfAborted(signal);
          const errorResult: ToolResult = {
            toolCallId: call.id,
            result: {
              error:
                error instanceof Error
                  ? error.message
                  : "Tool execution failed",
            },
          };
          stepToolResults.push(errorResult);
          allToolResults.push(errorResult);
        }
      }
    }

    // Record step
    steps.push({
      text: result.text,
      toolCalls,
      toolResults: stepToolResults,
      finishReason: result.finishReason,
      usage: result.usage,
      providerMetadata: result.providerMetadata,
    });

    // Keep every assistant turn, including the final text and opaque replay state.
    const assistantMessage: AssistantMessage = {
      role: "assistant",
      content: result.text || null,
      ...(toolCalls.length ? { toolCalls } : {}),
      ...(result.providerMetadata
        ? { providerMetadata: responseReplayMetadata(result.providerMetadata) }
        : {}),
    };
    messages = [...messages, assistantMessage];
    if (toolCalls.length === 0) break;

    // Add tool result messages
    for (const tr of stepToolResults) {
      const toolMessage: ToolMessage = {
        role: "tool",
        toolCallId: tr.toolCallId,
        content: tr.modelOutput
          ? "[Tool returned content]"
          : JSON.stringify(tr.result),
        ...(tr.modelOutput ? { modelOutput: tr.modelOutput } : {}),
      };
      messages = [...messages, toolMessage];
    }
  }

  // Build final result
  const lastStep = steps[steps.length - 1];

  return {
    text: lastStep?.text ?? "",
    providerMetadata: lastStep?.providerMetadata,
    usage: sumUsage(steps),
    finishReason: lastStep?.finishReason ?? "stop",
    steps,
    toolCalls: allToolCalls,
    toolResults: allToolResults,
    response: {
      messages,
    },
  };
}

// ============================================
// Helper Functions
// ============================================

/**
 * Build initial messages from params
 */
function buildMessages(params: GenerateTextParams): CoreMessage[] {
  const messages: CoreMessage[] = [];

  // Add system prompt if provided
  if (params.system) {
    messages.push({ role: "system", content: params.system });
  }

  // Add existing messages
  if (params.messages) {
    messages.push(...params.messages);
  }

  // Add prompt as user message if provided
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
 * Sum token usage across all steps
 */
function sumUsage(steps: GenerateStep[]): TokenUsage {
  return steps.reduce(
    (acc, step) => ({
      promptTokens: acc.promptTokens + (step.usage?.promptTokens ?? 0),
      completionTokens:
        acc.completionTokens + (step.usage?.completionTokens ?? 0),
      totalTokens: acc.totalTokens + (step.usage?.totalTokens ?? 0),
    }),
    { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
  );
}
