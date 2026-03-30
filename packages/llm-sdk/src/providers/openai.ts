/**
 * OpenAI Provider Formatter
 *
 * Transformation functions for OpenAI API format
 * Also used by xAI/Grok (they use OpenAI-compatible format)
 */

import type {
  ToolDefinition,
  UnifiedToolCall,
  UnifiedToolResult,
} from "../core/stream-events";
import type {
  ProviderFormatter,
  OpenAITool,
  OpenAIToolCall,
  OpenAIToolResult,
} from "./types";

// ========================================
// Tool Definition Transformation
// ========================================

/**
 * Transform unified tool definitions to OpenAI format
 */
export function transformTools(tools: ToolDefinition[]): OpenAITool[] {
  return tools.map((tool) => ({
    type: "function" as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.inputSchema
        ? {
            type: "object",
            properties: tool.inputSchema.properties ?? {},
            required: tool.inputSchema.required,
          }
        : { type: "object", properties: {} },
    },
  }));
}

// ========================================
// Response Parsing
// ========================================

/**
 * Parse tool calls from OpenAI response
 */
export function parseToolCalls(response: unknown): UnifiedToolCall[] {
  const resp = response as Record<string, unknown>;
  const choices = resp?.choices as Array<Record<string, unknown>> | undefined;
  const message = choices?.[0]?.message as Record<string, unknown> | undefined;
  const toolCalls = (message?.tool_calls as OpenAIToolCall[]) || [];

  return toolCalls.map((tc) => {
    let input: Record<string, unknown> = {};
    try {
      input = JSON.parse(tc.function.arguments);
    } catch (e) {
      console.error(
        "Failed to parse tool arguments:",
        tc.function.arguments,
        e,
      );
    }
    return {
      id: tc.id,
      name: tc.function.name,
      input,
    };
  });
}

/**
 * Extract text content from OpenAI response
 */
export function extractTextContent(response: unknown): string {
  const resp = response as Record<string, unknown>;
  const choices = resp?.choices as Array<Record<string, unknown>> | undefined;
  const message = choices?.[0]?.message as Record<string, unknown> | undefined;
  return (message?.content as string) || "";
}

// ========================================
// Tool Result Formatting
// ========================================

/**
 * Format tool results for OpenAI
 */
export function formatToolResults(
  results: UnifiedToolResult[],
): OpenAIToolResult[] {
  return results.map((r) => ({
    role: "tool" as const,
    tool_call_id: r.toolCallId,
    content: r.content,
  }));
}

// ========================================
// Stop Reason Detection
// ========================================

/**
 * Check if response indicates the AI wants to use tools
 */
export function isToolUseStop(response: unknown): boolean {
  const resp = response as Record<string, unknown>;
  const choices = resp?.choices as Array<Record<string, unknown>> | undefined;
  return choices?.[0]?.finish_reason === "tool_calls";
}

/**
 * Check if response indicates conversation should end
 */
export function isEndTurnStop(response: unknown): boolean {
  const resp = response as Record<string, unknown>;
  const choices = resp?.choices as Array<Record<string, unknown>> | undefined;
  return choices?.[0]?.finish_reason === "stop";
}

/**
 * Get the stop reason string from response
 */
export function getStopReason(response: unknown): string {
  const resp = response as Record<string, unknown>;
  const choices = resp?.choices as Array<Record<string, unknown>> | undefined;
  return (choices?.[0]?.finish_reason as string) || "unknown";
}

// ========================================
// Message Building
// ========================================

/**
 * Build assistant message with tool calls for OpenAI format
 */
export function buildAssistantToolMessage(
  toolCalls: UnifiedToolCall[],
  textContent?: string,
): unknown {
  return {
    role: "assistant",
    content: textContent || null,
    tool_calls: toolCalls.map((tc) => ({
      id: tc.id,
      type: "function",
      function: {
        name: tc.name,
        arguments: JSON.stringify(tc.input),
      },
    })),
  };
}

/**
 * Build tool result messages for OpenAI
 * In OpenAI format, each tool result is a separate message
 */
export function buildToolResultMessage(results: UnifiedToolResult[]): unknown {
  // OpenAI expects each tool result as a separate message
  // Return an array to be spread into the conversation
  return formatToolResults(results);
}

// ========================================
// Formatter Object
// ========================================

/**
 * OpenAI provider formatter
 */
export const openaiFormatter: ProviderFormatter = {
  transformTools,
  parseToolCalls,
  formatToolResults,
  isToolUseStop,
  isEndTurnStop,
  getStopReason,
  extractTextContent,
  buildAssistantToolMessage,
  buildToolResultMessage,
};
