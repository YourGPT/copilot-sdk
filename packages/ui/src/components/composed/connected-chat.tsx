"use client";

import React from "react";
import { useYourGPTContext } from "@yourgpt/react";
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
 * import { YourGPTProvider } from '@yourgpt/react';
 * import { CopilotChat } from '@yourgpt/ui';
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

  // Filter messages to only show user/assistant/system (not tool messages)
  // Attach tool executions to the last assistant message
  const visibleMessages = chat.messages
    .filter(
      (m) => m.role === "user" || m.role === "assistant" || m.role === "system",
    )
    .map((m, index, arr) => {
      const isLastAssistant =
        m.role === "assistant" && index === arr.length - 1;
      return {
        id: m.id,
        role: m.role as "user" | "assistant" | "system",
        content: m.content,
        thinking: (m as { thinking?: string }).thinking,
        // Include attachments (images, files)
        attachments: m.attachments,
        // Attach tool executions to last assistant message
        toolExecutions: isLastAssistant ? toolExecutions : undefined,
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

  return (
    <Chat
      {...props}
      messages={visibleMessages}
      onSendMessage={actions.sendMessage}
      onStop={actions.stopGeneration}
      isLoading={chat.isLoading}
      showPoweredBy={showPoweredBy}
      suggestions={suggestions}
      // Tool execution props
      toolExecutions={toolExecutions}
      showToolExecutions={showToolExecutions}
      loopIteration={agentLoop.iteration}
      loopMaxIterations={agentLoop.maxIterations}
      loopRunning={loopRunning}
      // Tool approval props
      onApproveToolExecution={approveToolExecution}
      onRejectToolExecution={rejectToolExecution}
    />
  );
}

// Alias for backwards compatibility
export const ConnectedChat = CopilotChat;
export type ConnectedChatProps = CopilotChatProps;
