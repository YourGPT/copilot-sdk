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
    if (signal?.aborted) {
      throw new Error("Generation aborted");
    }

    // Format tools for this model's provider
    const formattedTools = tools
      ? formatToolsForProvider(tools, model.provider)
      : undefined;

    // Call model
    const result = await model.doGenerate({
      messages,
      tools: formattedTools,
      temperature: params.temperature,
      maxTokens: params.maxTokens,
      responseFormat: params.responseFormat,
      mcpServers: params.mcpServers,
      reasoningEffort: params.reasoningEffort,
      signal,
    });

    // Record this step
    const stepToolResults: ToolResult[] = [];

    // If there are tool calls, execute them
    if (result.toolCalls && result.toolCalls.length > 0 && tools) {
      allToolCalls.push(...result.toolCalls);

      // Execute each tool
      for (const call of result.toolCalls) {
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

          const result: ToolResult = {
            toolCallId: call.id,
            result: toolResult,
          };
          stepToolResults.push(result);
          allToolResults.push(result);
        } catch (error) {
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
      toolCalls: result.toolCalls,
      toolResults: stepToolResults,
      finishReason: result.finishReason,
      usage: result.usage,
    });

    // If no tool calls, we're done
    if (!result.toolCalls || result.toolCalls.length === 0) {
      break;
    }

    // Add assistant message with tool calls
    const assistantMessage: AssistantMessage = {
      role: "assistant",
      content: result.text || null,
      toolCalls: result.toolCalls,
    };
    messages = [...messages, assistantMessage];

    // Add tool result messages
    for (const tr of stepToolResults) {
      const toolMessage: ToolMessage = {
        role: "tool",
        toolCallId: tr.toolCallId,
        content: JSON.stringify(tr.result),
      };
      messages = [...messages, toolMessage];
    }
  }

  // Build final result
  const lastStep = steps[steps.length - 1];

  return {
    text: lastStep?.text ?? "",
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

interface AssistantMessage {
  role: "assistant";
  content: string | null;
  toolCalls?: ToolCall[];
}

interface ToolMessage {
  role: "tool";
  toolCallId: string;
  content: string;
}

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
