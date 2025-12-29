"use client";

import React from "react";
import { useYourGPTContext } from "@yourgpt/copilot-sdk-react";
import { Chat, type ChatProps } from "./chat";
import type { ToolExecutionData } from "./tools/tool-execution-list";

/**
 * Props for CopilotChat - auto-connects to YourGPTProvider context
 * No need to pass messages, sendMessage, etc. - handled internally
 */
export type CopilotChatProps = Omit<
  ChatProps,
  | "messages"
  | "onSendMessage"
  | "onStop"
  | "isLoading"
  | "toolExecutions"
  | "loopIteration"
  | "loopMaxIterations"
  | "loopRunning"
  | "onApproveToolExecution"
  | "onRejectToolExecution"
  | "processAttachment"
> & {
  /**
   * Show tool executions in the chat (default: true when tools are being executed)
   */
  showToolExecutions?: boolean;
};

/**
 * CopilotChat - Auto-connected chat component
 *
 * Automatically connects to YourGPTProvider context.
 * No need to use hooks or pass messages - everything is handled internally.
 *
 * @example
 * ```tsx
 * import { YourGPTProvider } from '@yourgpt/copilot-sdk-react';
 * import { CopilotChat } from '@yourgpt/copilot-sdk-ui';
 *
 * function App() {
 *   return (
 *     <YourGPTProvider runtimeUrl="/api/chat">
 *       <CopilotChat
 *         title="AI Assistant"
 *         placeholder="Ask anything..."
 *       />
 *     </YourGPTProvider>
 *   );
 * }
 * ```
 */
export function CopilotChat(props: CopilotChatProps) {
  // Auto-connect to context internally
  const {
    chat,
    actions,
    agentLoop,
    isPremium,
    isCloudStorageAvailable,
    approveToolExecution,
    rejectToolExecution,
  } = useYourGPTContext();

  // Auto-hide powered by for premium users (unless explicitly set)
  const showPoweredBy = props.showPoweredBy ?? !isPremium;

  // Convert tool executions to the expected format
  const toolExecutions: ToolExecutionData[] = agentLoop.toolExecutions.map(
    (exec) => ({
      id: exec.id,
      name: exec.name,
      args: exec.args,
      status: exec.status,
      result: exec.result,
      error: exec.error,
      timestamp: exec.timestamp,
      duration: exec.duration,
      approvalStatus: exec.approvalStatus,
      approvalMessage: exec.approvalMessage,
    }),
  );

  // Build map of tool results from tool messages (for merging)
  const toolResultsMap = new Map<string, string>();
  chat.messages
    .filter((m) => m.role === "tool" && m.tool_call_id)
    .forEach((m) => {
      toolResultsMap.set(m.tool_call_id!, m.content ?? "");
    });

  // Filter out tool messages and merge results into parent assistant messages
  const visibleMessages = chat.messages
    .filter((m) => m.role !== "tool") // Hide tool messages - results merged into assistant
    .map((m) => {
      // For assistant messages with tool_calls, merge results
      let messageToolExecutions: ToolExecutionData[] | undefined;

      if (m.role === "assistant" && m.tool_calls && m.tool_calls.length > 0) {
        const toolCallIds = new Set(m.tool_calls.map((tc) => tc.id));

        // Try live executions first (from agentLoop)
        const liveExecutions = toolExecutions.filter((exec) =>
          toolCallIds.has(exec.id),
        );

        if (liveExecutions.length > 0) {
          // Enrich live executions with results from tool messages if not already present
          messageToolExecutions = liveExecutions.map((exec) => {
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
          });
        } else {
          // Build from stored tool_calls + tool messages (historical)
          messageToolExecutions = m.tool_calls.map((tc) => {
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
          });
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
        thinking: m.metadata?.thinking,
        // Include attachments (images, files)
        attachments: m.metadata?.attachments,
        // Include tool_calls for assistant messages
        tool_calls: m.tool_calls,
        // Attach matched tool executions to assistant messages
        toolExecutions: messageToolExecutions,
      };
    });

  // Show suggestions only when no messages
  const suggestions =
    visibleMessages.length === 0 && props.suggestions?.length
      ? props.suggestions
      : [];

  // Show tool executions when there are any (they get cleared on new message)
  const showToolExecutions =
    props.showToolExecutions ?? toolExecutions.length > 0;

  // Determine if agent loop is running
  const loopRunning = chat.isLoading && agentLoop.iteration > 0;

  // Cloud storage allows larger files (25MB vs 5MB)
  const maxFileSize = isCloudStorageAvailable
    ? (props.maxFileSize ?? 25 * 1024 * 1024)
    : (props.maxFileSize ?? 5 * 1024 * 1024);

  return (
    <Chat
      {...props}
      messages={visibleMessages}
      onSendMessage={actions.sendMessage}
      onStop={actions.stopGeneration}
      isLoading={chat.isLoading}
      showPoweredBy={showPoweredBy}
      suggestions={suggestions}
      // Attachment processing (cloud storage or base64)
      processAttachment={actions.processAttachment}
      maxFileSize={maxFileSize}
      // Tool execution props
      toolExecutions={toolExecutions}
      showToolExecutions={showToolExecutions}
      loopIteration={agentLoop.iteration}
      loopMaxIterations={agentLoop.maxIterations}
      loopRunning={loopRunning}
      isProcessing={agentLoop.isProcessing}
      // Tool approval props
      onApproveToolExecution={approveToolExecution}
      onRejectToolExecution={rejectToolExecution}
    />
  );
}

// Alias for backwards compatibility
export const ConnectedChat = CopilotChat;
export type ConnectedChatProps = CopilotChatProps;
