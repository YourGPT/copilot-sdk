/**
 * Agent Loop Implementation
 *
 * Server-side agentic loop that:
 * 1. Calls LLM with tools
 * 2. Parses tool calls from response
 * 3. Executes server-side tools or requests client execution
 * 4. Loops until LLM returns end_turn or max iterations reached
 *
 * Streams events to client via SSE for real-time updates
 */

import type {
  StreamEvent,
  ToolDefinition,
  UnifiedToolCall,
  UnifiedToolResult,
  ToolResponse,
  AgentLoopConfig,
  Message,
} from "../core/stream-events";
import type { AIProvider } from "../providers/types";
import { generateToolCallId, generateMessageId } from "../core/utils";
import { getFormatter } from "../providers";

// ========================================
// Constants
// ========================================

/** Default maximum iterations */
const DEFAULT_MAX_ITERATIONS = 20;

// ========================================
// Types
// ========================================

/**
 * Agent loop options
 */
export interface AgentLoopOptions {
  /** Initial messages */
  messages: Message[];
  /** Available tools */
  tools: ToolDefinition[];
  /** System prompt */
  systemPrompt?: string;
  /** AI provider */
  provider: AIProvider;
  /** Abort signal for cancellation */
  signal?: AbortSignal;
  /** Loop configuration */
  config?: AgentLoopConfig;
  /**
   * LLM call function
   * Should call the LLM and return the raw response
   */
  callLLM: (messages: unknown[], tools: unknown[]) => Promise<unknown>;
  /**
   * Server-side tool executor
   * Called when a server-side tool needs to be executed
   */
  executeServerTool?: (
    name: string,
    args: Record<string, unknown>,
  ) => Promise<ToolResponse>;
  /**
   * Callback to wait for client tool result
   * Called when a client-side tool needs to be executed
   * Should return a Promise that resolves when client sends result
   */
  waitForClientToolResult?: (
    toolCallId: string,
    name: string,
    args: Record<string, unknown>,
  ) => Promise<ToolResponse>;
}

/**
 * Internal conversation message format
 */
interface ConversationMessage {
  role: string;
  content: unknown;
  [key: string]: unknown;
}

// ========================================
// Main Agent Loop
// ========================================

/**
 * Run the agentic loop
 *
 * @yields Stream events for each step of the loop
 */
export async function* runAgentLoop(
  options: AgentLoopOptions,
): AsyncGenerator<StreamEvent> {
  const {
    messages,
    tools,
    systemPrompt,
    provider,
    signal,
    config,
    callLLM,
    executeServerTool,
    waitForClientToolResult,
  } = options;

  const maxIterations = config?.maxIterations ?? DEFAULT_MAX_ITERATIONS;
  const debug = config?.debug ?? false;
  const formatter = getFormatter(provider.name);

  // Separate server and client tools
  const serverTools = tools.filter((t) => t.location === "server");
  const clientTools = tools.filter((t) => t.location === "client");
  const allTools = [...serverTools, ...clientTools];

  // Transform tools to provider format
  const providerTools = formatter.transformTools(allTools);

  // Build conversation
  const conversation: ConversationMessage[] = buildConversation(
    messages,
    systemPrompt,
  );

  let iteration = 0;

  if (debug) {
    console.log("[AgentLoop] Starting with", {
      messageCount: messages.length,
      toolCount: allTools.length,
      serverToolCount: serverTools.length,
      clientToolCount: clientTools.length,
      maxIterations,
    });
  }

  // Main loop
  while (iteration < maxIterations) {
    // Check for abort
    if (signal?.aborted) {
      yield {
        type: "loop:complete",
        iterations: iteration,
        aborted: true,
      };
      return;
    }

    iteration++;

    // Emit iteration progress
    yield {
      type: "loop:iteration",
      iteration,
      maxIterations,
    };

    if (debug) {
      console.log(`[AgentLoop] Iteration ${iteration}/${maxIterations}`);
    }

    try {
      // Call LLM
      const response = await callLLM(conversation, providerTools);

      // Parse tool calls and text from response
      const toolCalls = formatter.parseToolCalls(response);
      const textContent = formatter.extractTextContent(response);

      // Emit text content as message
      if (textContent) {
        const messageId = generateMessageId();
        yield { type: "message:start", id: messageId };
        yield { type: "message:delta", content: textContent };
        yield { type: "message:end" };
      }

      // Check if we should use tools
      if (formatter.isToolUseStop(response) && toolCalls.length > 0) {
        if (debug) {
          console.log(
            "[AgentLoop] Tool calls:",
            toolCalls.map((tc) => tc.name),
          );
        }

        // Execute tools
        const results = await executeToolCalls(
          toolCalls,
          tools,
          executeServerTool,
          waitForClientToolResult,
          function* (event: StreamEvent) {
            yield event;
          },
          debug,
        );

        // Emit tool results
        for (const result of results) {
          const toolCall = toolCalls.find((tc) => tc.id === result.toolCallId);
          if (toolCall) {
            yield {
              type: "tool:result",
              id: result.toolCallId,
              name: toolCall.name,
              result: JSON.parse(result.content) as ToolResponse,
            };
          }
        }

        // Add assistant message with tool calls to conversation
        const assistantMessage = formatter.buildAssistantToolMessage(
          toolCalls,
          textContent,
        );
        conversation.push(assistantMessage as ConversationMessage);

        // Add tool results to conversation
        const toolResultMessage = formatter.buildToolResultMessage(results);
        if (Array.isArray(toolResultMessage)) {
          // OpenAI format returns array of messages
          conversation.push(...(toolResultMessage as ConversationMessage[]));
        } else {
          conversation.push(toolResultMessage as ConversationMessage);
        }

        // Continue loop
        continue;
      }

      // Check for end turn
      if (formatter.isEndTurnStop(response)) {
        if (debug) {
          console.log("[AgentLoop] End turn detected");
        }
        break;
      }

      // Unknown stop reason - break to be safe
      const stopReason = formatter.getStopReason(response);
      if (debug) {
        console.log("[AgentLoop] Unknown stop reason:", stopReason);
      }
      break;
    } catch (error) {
      if (debug) {
        console.error("[AgentLoop] Error:", error);
      }

      yield {
        type: "error",
        message: error instanceof Error ? error.message : "Unknown error",
        code: "AGENT_LOOP_ERROR",
      };

      break;
    }
  }

  // Emit completion
  yield {
    type: "loop:complete",
    iterations: iteration,
    maxIterationsReached: iteration >= maxIterations,
  };

  yield { type: "done" };
}

// ========================================
// Helper Functions
// ========================================

/**
 * Build conversation from messages
 */
function buildConversation(
  messages: Message[],
  systemPrompt?: string,
): ConversationMessage[] {
  const conversation: ConversationMessage[] = [];

  // Add system prompt if provided
  if (systemPrompt) {
    conversation.push({
      role: "system",
      content: systemPrompt,
    });
  }

  // Add messages
  for (const msg of messages) {
    conversation.push({
      role: msg.role,
      content: msg.content,
    });
  }

  return conversation;
}

/**
 * Execute tool calls
 */
async function executeToolCalls(
  toolCalls: UnifiedToolCall[],
  tools: ToolDefinition[],
  executeServerTool?: (
    name: string,
    args: Record<string, unknown>,
  ) => Promise<ToolResponse>,
  waitForClientToolResult?: (
    toolCallId: string,
    name: string,
    args: Record<string, unknown>,
  ) => Promise<ToolResponse>,
  emitEvent?: (event: StreamEvent) => void,
  debug?: boolean,
): Promise<UnifiedToolResult[]> {
  const results: UnifiedToolResult[] = [];

  for (const toolCall of toolCalls) {
    const tool = tools.find((t) => t.name === toolCall.name);

    if (!tool) {
      // Unknown tool
      if (debug) {
        console.warn(`[AgentLoop] Unknown tool: ${toolCall.name}`);
      }

      results.push({
        toolCallId: toolCall.id,
        content: JSON.stringify({
          success: false,
          error: `Unknown tool: ${toolCall.name}`,
        }),
        success: false,
        error: `Unknown tool: ${toolCall.name}`,
      });
      continue;
    }

    // Emit action start (include hidden flag for client-side filtering)
    emitEvent?.({
      type: "action:start",
      id: toolCall.id,
      name: toolCall.name,
      hidden: tool.hidden ?? false,
    });

    // Emit arguments
    emitEvent?.({
      type: "action:args",
      id: toolCall.id,
      args: JSON.stringify(toolCall.input),
    });

    try {
      let response: ToolResponse;

      if (tool.location === "server") {
        // Server-side tool
        if (tool.handler) {
          response = (await tool.handler(toolCall.input)) as ToolResponse;
        } else if (executeServerTool) {
          response = await executeServerTool(toolCall.name, toolCall.input);
        } else {
          response = {
            success: false,
            error: `No handler for server tool: ${toolCall.name}`,
          };
        }
      } else {
        // Client-side tool
        if (waitForClientToolResult) {
          // Wait for client result (client handles execution)
          response = await waitForClientToolResult(
            toolCall.id,
            toolCall.name,
            toolCall.input,
          );
        } else {
          response = {
            success: false,
            error: `No client tool handler for: ${toolCall.name}`,
          };
        }
      }

      // Emit action end
      emitEvent?.({
        type: "action:end",
        id: toolCall.id,
        name: toolCall.name,
        result: response,
      });

      results.push({
        toolCallId: toolCall.id,
        content: JSON.stringify(response),
        success: response.success,
        error: response.error,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Tool execution failed";

      // Emit action end with error
      emitEvent?.({
        type: "action:end",
        id: toolCall.id,
        name: toolCall.name,
        error: errorMessage,
      });

      results.push({
        toolCallId: toolCall.id,
        content: JSON.stringify({
          success: false,
          error: errorMessage,
        }),
        success: false,
        error: errorMessage,
      });
    }
  }

  return results;
}

// ========================================
// Exports
// ========================================

export { DEFAULT_MAX_ITERATIONS };
