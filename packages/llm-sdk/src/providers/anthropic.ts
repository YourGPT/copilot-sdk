/**
 * Anthropic/Claude Provider Formatter
 *
 * Transformation functions for Anthropic API format
 */

import type {
  ToolDefinition,
  UnifiedToolCall,
  UnifiedToolResult,
} from "../core/stream-events";
import type {
  ProviderFormatter,
  AnthropicTool,
  AnthropicToolUse,
  AnthropicToolResult,
} from "./types";

// ========================================
// Tool Definition Transformation
// ========================================

/**
 * Transform unified tool definitions to Anthropic format
 */
export function transformTools(tools: ToolDefinition[]): AnthropicTool[] {
  return tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    input_schema: tool.inputSchema
      ? {
          type: "object",
          properties: tool.inputSchema.properties ?? {},
          required: tool.inputSchema.required,
        }
      : { type: "object", properties: {} },
  }));
}

// ========================================
// Response Parsing
// ========================================

/**
 * Parse tool calls from Anthropic response content
 */
export function parseToolCalls(response: unknown): UnifiedToolCall[] {
  // Handle both raw response and content array
  const content = Array.isArray(response)
    ? response
    : (response as Record<string, unknown>)?.content;

  if (!Array.isArray(content)) {
    return [];
  }

  return content
    .filter((block): block is AnthropicToolUse => block?.type === "tool_use")
    .map((block) => ({
      id: block.id,
      name: block.name,
      input: block.input || {},
    }));
}

/**
 * Extract text content from Anthropic response
 */
export function extractTextContent(response: unknown): string {
  // Handle both raw response and content array
  const content = Array.isArray(response)
    ? response
    : (response as Record<string, unknown>)?.content;

  if (!Array.isArray(content)) {
    return "";
  }

  return content
    .filter((block) => block?.type === "text")
    .map((block) => (block as { text?: string }).text || "")
    .join("\n");
}

// ========================================
// Tool Result Formatting
// ========================================

/**
 * Format tool results for Anthropic
 */
export function formatToolResults(
  results: UnifiedToolResult[],
): AnthropicToolResult[] {
  return results.map((r) => ({
    type: "tool_result" as const,
    tool_use_id: r.toolCallId,
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
  return resp?.stop_reason === "tool_use";
}

/**
 * Check if response indicates conversation should end
 */
export function isEndTurnStop(response: unknown): boolean {
  const resp = response as Record<string, unknown>;
  const stopReason = resp?.stop_reason;
  return stopReason === "end_turn" || stopReason === "stop";
}

/**
 * Get the stop reason string from response
 */
export function getStopReason(response: unknown): string {
  const resp = response as Record<string, unknown>;
  return (resp?.stop_reason as string) || "unknown";
}

// ========================================
// Message Building
// ========================================

/**
 * Build assistant message with tool calls for Anthropic format
 */
export function buildAssistantToolMessage(
  toolCalls: UnifiedToolCall[],
  textContent?: string,
): unknown {
  const content: unknown[] = [];

  if (textContent) {
    content.push({ type: "text", text: textContent });
  }

  toolCalls.forEach((tc) => {
    content.push({
      type: "tool_use",
      id: tc.id,
      name: tc.name,
      input: tc.input,
    });
  });

  return { role: "assistant", content };
}

/**
 * Build user message with tool results for Anthropic
 * In Anthropic format, tool results are sent as a user message with tool_result blocks
 */
export function buildToolResultMessage(results: UnifiedToolResult[]): unknown {
  return {
    role: "user",
    content: formatToolResults(results),
  };
}

// ========================================
// Formatter Object
// ========================================

/**
 * Anthropic provider formatter
 */
export const anthropicFormatter: ProviderFormatter = {
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
