/**
 * Google Gemini Provider Formatter
 *
 * Transformation functions for Google Gemini API format
 */

import type {
  ToolDefinition,
  UnifiedToolCall,
  UnifiedToolResult,
} from "../core/stream-events";
import type {
  ProviderFormatter,
  GeminiFunctionDeclaration,
  GeminiFunctionCall,
  GeminiFunctionResponse,
} from "./types";

// ========================================
// Tool Definition Transformation
// ========================================

/**
 * Transform unified tool definitions to Gemini format
 */
export function transformTools(
  tools: ToolDefinition[],
): Array<{ functionDeclarations: GeminiFunctionDeclaration[] }> {
  return [
    {
      functionDeclarations: tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        parameters: tool.inputSchema
          ? {
              type: "object",
              properties: tool.inputSchema.properties ?? {},
              required: tool.inputSchema.required,
            }
          : { type: "object", properties: {} },
      })),
    },
  ];
}

// ========================================
// Response Parsing
// ========================================

/**
 * Parse tool calls from Gemini response
 */
export function parseToolCalls(response: unknown): UnifiedToolCall[] {
  const resp = response as Record<string, unknown>;
  const candidates = resp?.candidates as
    | Array<Record<string, unknown>>
    | undefined;
  const content = candidates?.[0]?.content as
    | Record<string, unknown>
    | undefined;
  const parts = content?.parts as Array<Record<string, unknown>> | undefined;

  if (!parts) return [];

  const functionCalls: UnifiedToolCall[] = [];

  for (const part of parts) {
    const functionCall = part.functionCall as GeminiFunctionCall | undefined;
    if (functionCall) {
      functionCalls.push({
        id: `gemini_${Date.now()}_${functionCalls.length}`, // Gemini doesn't provide IDs
        name: functionCall.name,
        input: functionCall.args || {},
      });
    }
  }

  return functionCalls;
}

/**
 * Extract text content from Gemini response
 */
export function extractTextContent(response: unknown): string {
  const resp = response as Record<string, unknown>;
  const candidates = resp?.candidates as
    | Array<Record<string, unknown>>
    | undefined;
  const content = candidates?.[0]?.content as
    | Record<string, unknown>
    | undefined;
  const parts = content?.parts as Array<Record<string, unknown>> | undefined;

  if (!parts) return "";

  return parts
    .filter((part) => typeof part.text === "string")
    .map((part) => part.text as string)
    .join("\n");
}

// ========================================
// Tool Result Formatting
// ========================================

/**
 * Format tool results for Gemini
 */
export function formatToolResults(
  results: UnifiedToolResult[],
): GeminiFunctionResponse[] {
  return results.map((r) => {
    let response: Record<string, unknown>;
    try {
      response = JSON.parse(r.content);
    } catch {
      response = { result: r.content };
    }

    return {
      name: r.toolCallId.split("_").slice(2).join("_") || "unknown", // Extract name from ID
      response,
    };
  });
}

// ========================================
// Stop Reason Detection
// ========================================

/**
 * Check if response indicates the AI wants to use tools
 */
export function isToolUseStop(response: unknown): boolean {
  const resp = response as Record<string, unknown>;
  const candidates = resp?.candidates as
    | Array<Record<string, unknown>>
    | undefined;
  const content = candidates?.[0]?.content as
    | Record<string, unknown>
    | undefined;
  const parts = content?.parts as Array<Record<string, unknown>> | undefined;

  if (!parts) return false;

  return parts.some((part) => part.functionCall !== undefined);
}

/**
 * Check if response indicates conversation should end
 */
export function isEndTurnStop(response: unknown): boolean {
  const resp = response as Record<string, unknown>;
  const candidates = resp?.candidates as
    | Array<Record<string, unknown>>
    | undefined;
  const finishReason = candidates?.[0]?.finishReason as string | undefined;

  return finishReason === "STOP" || finishReason === "END_TURN";
}

/**
 * Get the stop reason string from response
 */
export function getStopReason(response: unknown): string {
  const resp = response as Record<string, unknown>;
  const candidates = resp?.candidates as
    | Array<Record<string, unknown>>
    | undefined;
  return (candidates?.[0]?.finishReason as string) || "unknown";
}

// ========================================
// Message Building
// ========================================

/**
 * Build assistant message with tool calls for Gemini format
 */
export function buildAssistantToolMessage(
  toolCalls: UnifiedToolCall[],
  textContent?: string,
): unknown {
  const parts: unknown[] = [];

  if (textContent) {
    parts.push({ text: textContent });
  }

  toolCalls.forEach((tc) => {
    parts.push({
      functionCall: {
        name: tc.name,
        args: tc.input,
      },
    });
  });

  return {
    role: "model",
    parts,
  };
}

/**
 * Build user message with tool results for Gemini
 */
export function buildToolResultMessage(results: UnifiedToolResult[]): unknown {
  const parts = results.map((r) => {
    let response: Record<string, unknown>;
    try {
      response = JSON.parse(r.content);
    } catch {
      response = { result: r.content };
    }

    // Extract tool name from the result - we need to track this separately
    // For now, use a placeholder since Gemini doesn't use IDs
    return {
      functionResponse: {
        name: "tool", // This should be the actual tool name
        response,
      },
    };
  });

  return {
    role: "user",
    parts,
  };
}

// ========================================
// Formatter Object
// ========================================

/**
 * Gemini provider formatter
 */
export const geminiFormatter: ProviderFormatter = {
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
