"use client";

import React from "react";
import {
  useCopilot,
  type UIMessage,
  type ChatToolExecution,
} from "../../../react";
import { Chat, type ChatProps } from "./chat";
import type { ToolExecutionData } from "./tools/tool-execution-list";

/**
 * Props for CopilotChat - auto-connects to CopilotProvider context
 * No need to pass messages, sendMessage, etc. - handled internally
 */
export type CopilotChatProps = Omit<
  ChatProps,
  | "messages"
  | "onSendMessage"
  | "onStop"
  | "isLoading"
  | "isProcessing"
  | "onApproveToolExecution"
  | "onRejectToolExecution"
  | "processAttachment"
>;

/**
 * CopilotChat - Auto-connected chat component
 *
 * Automatically connects to CopilotProvider context.
 * No need to use hooks or pass messages - everything is handled internally.
 *
 * @example
 * ```tsx
 * import { CopilotProvider } from '../../react';
 * import { CopilotChat } from '@yourgpt/copilot-sdk-ui';
 *
 * function App() {
 *   return (
 *     <CopilotProvider runtimeUrl="/api/chat">
 *       <CopilotChat
 *         title="AI Assistant"
 *         placeholder="Ask anything..."
 *       />
 *     </CopilotProvider>
 *   );
 * }
 * ```
 *
 * @example Generative UI with custom tool renderers
 * ```tsx
 * import { CopilotChat, type ToolRendererProps } from '@yourgpt/copilot-sdk-ui';
 *
 * function WeatherCard({ execution }: ToolRendererProps) {
 *   if (execution.status !== 'completed') return <div>Loading...</div>;
 *   return <div>{execution.result.city}: {execution.result.temperature}°</div>;
 * }
 *
 * <CopilotChat
 *   toolRenderers={{
 *     get_weather: WeatherCard,
 *   }}
 * />
 * ```
 */
export function CopilotChat(props: CopilotChatProps) {
  // Auto-connect to context internally
  const {
    messages,
    isLoading,
    sendMessage,
    stop,
    toolExecutions: rawToolExecutions,
    approveToolExecution,
    rejectToolExecution,
    registeredTools,
  } = useCopilot();

  // Convert tool executions to the expected format
  const toolExecutions: ToolExecutionData[] = rawToolExecutions.map(
    (exec: ChatToolExecution) => ({
      id: exec.id,
      name: exec.name,
      args: exec.args,
      status: exec.status,
      result: exec.result as ToolExecutionData["result"],
      error: exec.error,
      timestamp: exec.startedAt ? exec.startedAt.getTime() : Date.now(),
      approvalStatus: exec.approvalStatus,
    }),
  );

  // Build map of tool results from tool messages (for merging)
  const toolResultsMap = new Map<string, string>();
  messages
    .filter((m: UIMessage) => m.role === "tool" && m.toolCallId)
    .forEach((m: UIMessage) => {
      toolResultsMap.set(m.toolCallId!, m.content ?? "");
    });

  // Filter out tool messages and merge results into parent assistant messages
  const visibleMessages = messages
    .filter((m: UIMessage) => m.role !== "tool") // Hide tool messages - results merged into assistant
    .map((m: UIMessage) => {
      // For assistant messages with tool_calls, merge results
      let messageToolExecutions: ToolExecutionData[] | undefined;

      if (m.role === "assistant" && m.toolCalls && m.toolCalls.length > 0) {
        const toolCallIds = new Set(
          m.toolCalls.map((tc: { id: string }) => tc.id),
        );

        // Try live executions first (from agentLoop)
        const liveExecutions = toolExecutions.filter(
          (exec: ToolExecutionData) => toolCallIds.has(exec.id),
        );

        if (liveExecutions.length > 0) {
          // Enrich live executions with results from tool messages if not already present
          messageToolExecutions = liveExecutions.map(
            (exec: ToolExecutionData) => {
              if (!exec.result && toolResultsMap.has(exec.id)) {
                const resultContent = toolResultsMap.get(exec.id)!;
                try {
                  return { ...exec, result: JSON.parse(resultContent) };
                } catch {
                  return {
                    ...exec,
                    result: { success: true, message: resultContent },
                  };
                }
              }
              return exec;
            },
          );
        } else {
          // Build from stored tool_calls + tool messages (historical)
          messageToolExecutions = m.toolCalls.map(
            (tc: {
              id: string;
              function: { name: string; arguments: string };
            }) => {
              const resultContent = toolResultsMap.get(tc.id);
              let result: ToolExecutionData["result"] = undefined;
              if (resultContent) {
                try {
                  result = JSON.parse(resultContent);
                } catch {
                  result = { success: true, message: resultContent };
                }
              }
              let args: Record<string, unknown> = {};
              try {
                args = JSON.parse(tc.function.arguments || "{}");
              } catch {
                // Keep empty args
              }
              return {
                id: tc.id,
                name: tc.function.name,
                args,
                status: (result
                  ? "completed"
                  : "pending") as ToolExecutionData["status"],
                result,
                timestamp: Date.now(), // Historical - use current time
              };
            },
          );
        }
      }

      // Check for saved executions in metadata (for historical messages without tool_calls)
      const savedExecutions = (
        m.metadata as { toolExecutions?: ToolExecutionData[] }
      )?.toolExecutions;
      if (
        savedExecutions &&
        savedExecutions.length > 0 &&
        !messageToolExecutions
      ) {
        messageToolExecutions = savedExecutions;
      }

      return {
        id: m.id,
        role: m.role as "user" | "assistant" | "system",
        content: m.content ?? "",
        thinking: m.thinking,
        // Include attachments (images, files)
        attachments: m.attachments,
        // Include tool_calls for assistant messages
        tool_calls: m.toolCalls,
        // Attach matched tool executions to assistant messages
        toolExecutions: messageToolExecutions,
      };
    });

  // Show suggestions only when no messages
  const suggestions =
    visibleMessages.length === 0 && props.suggestions?.length
      ? props.suggestions
      : [];

  // isProcessing: Show "Continuing..." loader ONLY when we're in an active tool flow
  // Condition: Last message must be assistant with tool_calls (not user starting new request)
  const lastMessage = messages[messages.length - 1];
  const isInToolFlow =
    lastMessage?.role === "assistant" &&
    (lastMessage as UIMessage).toolCalls?.length;

  let isProcessingToolResults = false;

  if (isLoading && isInToolFlow) {
    const currentToolCallIds = new Set(
      (lastMessage as UIMessage).toolCalls?.map(
        (tc: { id: string }) => tc.id,
      ) || [],
    );
    const currentExecutions = toolExecutions.filter((exec) =>
      currentToolCallIds.has(exec.id),
    );

    const hasCompletedTools = currentExecutions.some(
      (exec) =>
        exec.status === "completed" ||
        exec.status === "error" ||
        exec.status === "failed",
    );
    const hasExecutingTools = currentExecutions.some(
      (exec) => exec.status === "executing" || exec.status === "pending",
    );

    // Show "Continuing..." only when tools completed and waiting for AI to continue
    isProcessingToolResults = hasCompletedTools && !hasExecutingTools;
  }

  return (
    <Chat
      {...props}
      messages={visibleMessages}
      onSendMessage={sendMessage}
      onStop={stop}
      isLoading={isLoading}
      showPoweredBy={props.showPoweredBy ?? true}
      suggestions={suggestions}
      isProcessing={isProcessingToolResults}
      onApproveToolExecution={approveToolExecution}
      onRejectToolExecution={rejectToolExecution}
      registeredTools={registeredTools}
    />
  );
}

// Alias for backwards compatibility
export const ConnectedChat = CopilotChat;
export type ConnectedChatProps = CopilotChatProps;
