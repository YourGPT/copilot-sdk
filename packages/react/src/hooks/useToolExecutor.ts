"use client";

import { useCallback, useRef } from "react";
import type {
  ToolDefinition,
  ToolResponse,
  UnifiedToolCall,
  ToolExecution,
} from "@yourgpt/core";
import { useYourGPTContext } from "../context/YourGPTContext";

/**
 * Tool executor return type
 */
export interface UseToolExecutorReturn {
  /**
   * Execute a tool by name with given arguments
   */
  executeTool: (toolCall: UnifiedToolCall) => Promise<ToolResponse>;

  /**
   * Send tool result back to server
   */
  sendToolResult: (toolCallId: string, result: ToolResponse) => Promise<void>;

  /**
   * Get a registered tool by name
   */
  getTool: (name: string) => ToolDefinition | undefined;

  /**
   * Check if a tool is registered
   */
  hasTool: (name: string) => boolean;
}

/**
 * Internal hook for executing client-side tools
 *
 * This hook is used internally by the YourGPTProvider to execute
 * tools when the server requests them via SSE events.
 *
 * It can also be used for custom implementations where you need
 * direct control over tool execution.
 *
 * @example
 * ```tsx
 * const { executeTool, sendToolResult } = useToolExecutor();
 *
 * // When receiving a tool:execute event from server
 * const handleToolExecute = async (event: ToolExecuteEvent) => {
 *   const result = await executeTool({
 *     id: event.id,
 *     name: event.name,
 *     input: event.args,
 *   });
 *
 *   // Send result back to server
 *   await sendToolResult(event.id, result);
 * };
 * ```
 */
export function useToolExecutor(): UseToolExecutorReturn {
  const {
    registeredTools,
    config,
    chat,
    addToolExecution,
    updateToolExecution,
  } = useYourGPTContext();

  const toolsRef = useRef(registeredTools);
  toolsRef.current = registeredTools;

  /**
   * Execute a tool
   */
  const executeTool = useCallback(
    async (toolCall: UnifiedToolCall): Promise<ToolResponse> => {
      const tool = toolsRef.current.find((t) => t.name === toolCall.name);

      if (!tool) {
        return {
          success: false,
          error: `Unknown tool: ${toolCall.name}`,
        };
      }

      if (!tool.handler) {
        return {
          success: false,
          error: `Tool "${toolCall.name}" has no handler`,
        };
      }

      // Create execution record
      const execution: ToolExecution = {
        id: toolCall.id,
        name: toolCall.name,
        args: toolCall.input,
        status: "executing",
        timestamp: Date.now(),
        approvalStatus: "none",
      };

      // Add to execution list
      addToolExecution?.(execution);

      try {
        const startTime = Date.now();
        const result = await tool.handler(toolCall.input);
        const duration = Date.now() - startTime;

        // Update execution status
        updateToolExecution?.(toolCall.id, {
          status: result.success ? "completed" : "error",
          result,
          error: result.error,
          duration,
        });

        return result;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Tool execution failed";

        // Update execution status
        updateToolExecution?.(toolCall.id, {
          status: "error",
          error: errorMessage,
        });

        return {
          success: false,
          error: errorMessage,
        };
      }
    },
    [addToolExecution, updateToolExecution],
  );

  /**
   * Send tool result back to server
   */
  const sendToolResult = useCallback(
    async (toolCallId: string, result: ToolResponse): Promise<void> => {
      const runtimeUrl = config.runtimeUrl || config.cloud?.endpoint;

      if (!runtimeUrl) {
        console.warn(
          "[useToolExecutor] No runtime URL configured, cannot send tool result",
        );
        return;
      }

      // Extract base URL (remove /chat if present)
      const baseUrl = runtimeUrl.replace(/\/chat\/?$/, "");

      try {
        const response = await fetch(`${baseUrl}/tool-result`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            threadId: chat.threadId || "default",
            toolCallId,
            result,
          }),
        });

        if (!response.ok) {
          console.error(
            "[useToolExecutor] Failed to send tool result:",
            await response.text(),
          );
        }
      } catch (error) {
        console.error("[useToolExecutor] Error sending tool result:", error);
      }
    },
    [config.runtimeUrl, config.cloud?.endpoint, chat.threadId],
  );

  /**
   * Get a registered tool by name
   */
  const getTool = useCallback((name: string): ToolDefinition | undefined => {
    return toolsRef.current.find((t) => t.name === name);
  }, []);

  /**
   * Check if a tool is registered
   */
  const hasTool = useCallback((name: string): boolean => {
    return toolsRef.current.some((t) => t.name === name);
  }, []);

  return {
    executeTool,
    sendToolResult,
    getTool,
    hasTool,
  };
}
