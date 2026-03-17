"use client";

import React from "react";
import {
  useCopilot,
  type UIMessage,
  type ChatToolExecution,
} from "../../../react";
import { Chat, type ChatProps } from "./chat";
import type { ToolExecutionData } from "./tools/tool-execution-list";
import { ThreadPicker } from "../ui/thread-picker";
import {
  useInternalThreadManager,
  type UseInternalThreadManagerConfig,
} from "../../hooks/useInternalThreadManager";
import type {
  ThreadStorageAdapter,
  AsyncThreadStorageAdapter,
} from "../../../thread/adapters";
import { createServerAdapter } from "../../../thread/adapters";

// ============================================
// Persistence Configuration Types
// ============================================

/**
 * localStorage persistence (zero config)
 */
export interface LocalPersistenceConfig {
  type: "local";
  /** Debounce delay for auto-save (ms). Default: 1000 */
  saveDebounce?: number;
  /** Whether to auto-restore the last active thread. Default: true */
  autoRestoreLastThread?: boolean;
}

/**
 * Server persistence (point to your own API routes)
 */
export interface ServerPersistenceConfig {
  type: "server";
  /**
   * Endpoint URL for your thread CRUD API
   * @example "/api/threads"
   */
  endpoint: string;
  /** Additional headers for requests (e.g., auth tokens) */
  headers?: Record<string, string>;
  /** Debounce delay for auto-save (ms). Default: 1000 */
  saveDebounce?: number;
  /** Whether to auto-restore the last active thread. Default: true */
  autoRestoreLastThread?: boolean;
}

/**
 * Cloud persistence (future - managed service)
 */
export interface CloudPersistenceConfig {
  type: "cloud";
  /** Copilot Cloud API key */
  apiKey: string;
  /** Custom endpoint for enterprise (optional) */
  endpoint?: string;
}

/**
 * Legacy persistence config (backward compatibility)
 */
export interface LegacyPersistenceConfig {
  /** Storage adapter (defaults to localStorage) */
  adapter?: ThreadStorageAdapter | AsyncThreadStorageAdapter;
  /** Debounce delay for auto-save (ms). Default: 1000 */
  saveDebounce?: number;
  /** Whether to auto-restore the last active thread on mount. Default: true */
  autoRestoreLastThread?: boolean;
}

/**
 * Persistence configuration for CopilotChat
 *
 * @example localStorage (zero config)
 * ```tsx
 * <CopilotChat persistence={true} />
 * // or explicitly:
 * <CopilotChat persistence={{ type: "local" }} />
 * ```
 *
 * @example Server persistence
 * ```tsx
 * <CopilotChat
 *   persistence={{
 *     type: "server",
 *     threadsUrl: "/api/threads",
 *     headers: { Authorization: `Bearer ${token}` },
 *   }}
 * />
 * ```
 */
export type CopilotChatPersistenceConfig =
  | LocalPersistenceConfig
  | ServerPersistenceConfig
  | CloudPersistenceConfig
  | LegacyPersistenceConfig;

/**
 * Extended classNames for CopilotChat including thread picker
 */
export interface CopilotChatClassNames {
  // Existing Chat classNames
  root?: string;
  header?: string;
  container?: string;
  messageList?: string;
  userMessage?: string;
  assistantMessage?: string;
  input?: string;
  suggestions?: string;
  footer?: string;
  // Thread picker classNames
  threadPicker?: string;
  threadPickerButton?: string;
  threadPickerDropdown?: string;
  threadPickerItem?: string;
  threadPickerNewButton?: string;
}

/**
 * Header configuration for CopilotChat
 */
export interface CopilotChatHeaderConfig {
  /** Logo image URL (default: YourGPT logo) */
  logo?: string;
  /** Copilot name (default: "AI Copilot") */
  name?: string;
  /** Called when close button is clicked */
  onClose?: () => void;
}

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
  | "classNames"
  | "header"
  | "threadPicker"
  | "recentThreads"
  | "onSelectThread"
  | "onViewMoreThreads"
> & {
  /**
   * Header configuration.
   * Providing this prop will automatically show the header.
   */
  header?: CopilotChatHeaderConfig;
  /**
   * Enable built-in persistence.
   * - `true`: Use localStorage with default settings
   * - `object`: Custom persistence config
   * - `undefined`: No persistence (default)
   */
  persistence?: boolean | CopilotChatPersistenceConfig;

  /**
   * Show thread picker in the header for switching conversations.
   * Requires `persistence` to be enabled.
   * @default false
   */
  showThreadPicker?: boolean;

  /**
   * Callback when the current thread changes.
   * Useful for syncing thread ID with URL or external state.
   */
  onThreadChange?: (threadId: string | null) => void;

  /**
   * Granular class names for sub-components including thread picker
   */
  classNames?: CopilotChatClassNames;
};

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
/**
 * Parse persistence config into internal thread manager config
 */
function parsePersistenceConfig(
  persistence: boolean | CopilotChatPersistenceConfig | undefined,
  onThreadChange?: (threadId: string | null) => void,
): UseInternalThreadManagerConfig | undefined {
  // Not enabled
  if (!persistence) {
    return undefined;
  }

  // Boolean true = localStorage with defaults
  if (persistence === true) {
    return {
      onThreadChange,
      autoRestoreLastThread: true,
    };
  }

  // Type-based config
  if ("type" in persistence) {
    switch (persistence.type) {
      case "local":
        return {
          saveDebounce: persistence.saveDebounce,
          autoRestoreLastThread: persistence.autoRestoreLastThread ?? true,
          onThreadChange,
        };

      case "server":
        return {
          adapter: createServerAdapter({
            endpoint: persistence.endpoint,
            headers: persistence.headers,
          }),
          saveDebounce: persistence.saveDebounce,
          autoRestoreLastThread: persistence.autoRestoreLastThread ?? true,
          onThreadChange,
        };

      case "cloud":
        // Future: Cloud persistence not yet implemented
        console.warn(
          "[Copilot SDK] Cloud persistence is not yet implemented. Falling back to localStorage.",
        );
        return {
          onThreadChange,
          autoRestoreLastThread: true,
        };
    }
  }

  // Legacy config (has adapter property or other legacy fields)
  const legacyConfig = persistence as LegacyPersistenceConfig;
  return {
    adapter: legacyConfig.adapter,
    saveDebounce: legacyConfig.saveDebounce,
    autoRestoreLastThread: legacyConfig.autoRestoreLastThread ?? true,
    onThreadChange,
  };
}

function CopilotChatBase(
  props: CopilotChatProps & { children?: React.ReactNode },
) {
  const {
    persistence,
    showThreadPicker = false,
    onThreadChange,
    classNames,
    header,
    children,
    ...chatProps
  } = props;

  // Parse persistence config
  const persistenceConfig = parsePersistenceConfig(persistence, onThreadChange);

  // Use internal thread manager when persistence is enabled.
  // When persistence is disabled, pass enabled:false so no sync/restore effects
  // fire — prevents the shared singleton from being touched by a no-persistence instance
  // and avoids stale async createThread calls overwriting messages on navigation.
  const threadManagerResult = useInternalThreadManager(
    persistenceConfig ?? { autoRestoreLastThread: false, enabled: false },
  );

  const isPersistenceEnabled = !!persistence;

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
    switchBranch,
    getBranchInfo,
    editMessage,
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
      approvalTitle: exec.approvalTitle,
      approvalMessage: exec.approvalMessage,
      hidden: exec.hidden,
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
  // Keep compaction-markers (system messages with type='compaction-marker') visible
  const visibleMessages = messages
    .filter(
      (m: UIMessage) =>
        m.role !== "tool" &&
        (m.role !== "system" ||
          (m.metadata as Record<string, unknown>)?.type ===
            "compaction-marker"),
    ) // Hide tool/system messages except compaction markers
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
          // Get hidden info from message metadata (set by handleJsonResponse)
          const toolCallsHidden = (
            m.metadata as { toolCallsHidden?: Record<string, boolean> }
          )?.toolCallsHidden;

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
              // Check hidden from metadata first (from server response),
              // then fall back to registeredTools
              let hidden = toolCallsHidden?.[tc.id];
              if (hidden === undefined) {
                const toolDef = registeredTools?.find(
                  (t) => t.name === tc.function.name,
                );
                hidden = toolDef?.hidden;
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
                hidden,
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

      // Filter out hidden tool executions for the message
      const visibleToolExecutions = messageToolExecutions?.filter(
        (exec) => !exec.hidden,
      );

      return {
        id: m.id,
        role: m.role as "user" | "assistant" | "system",
        content: m.content ?? "",
        thinking: m.thinking,
        // Include attachments (images, files)
        attachments: m.attachments,
        // Include tool_calls for assistant messages
        tool_calls: m.toolCalls,
        // Attach matched tool executions to assistant messages (only visible ones)
        toolExecutions: visibleToolExecutions,
        // Include metadata (citations from native web search, etc.)
        metadata: m.metadata,
        // Mark if this message had only hidden tools (for filtering empty bubbles)
        _hasOnlyHiddenTools:
          messageToolExecutions &&
          messageToolExecutions.length > 0 &&
          (!visibleToolExecutions || visibleToolExecutions.length === 0),
      };
    })
    // Filter out empty assistant messages that only had hidden tools
    .filter((m) => {
      if (
        m.role === "assistant" &&
        !m.content &&
        (m as { _hasOnlyHiddenTools?: boolean })._hasOnlyHiddenTools
      ) {
        return false;
      }
      return true;
    });

  // Show suggestions only when no messages
  const suggestions =
    visibleMessages.length === 0 && chatProps.suggestions?.length
      ? chatProps.suggestions
      : [];

  // isProcessing: Show "Continuing..." loader when tools finished and AI is about to respond
  const lastMessage = messages[messages.length - 1];

  // Find the last assistant message with tool calls (may not be the very last message
  // since tool result messages follow it)
  const lastAssistantWithTools = [...messages]
    .reverse()
    .find(
      (m) => m.role === "assistant" && (m as UIMessage).toolCalls?.length,
    ) as UIMessage | undefined;

  // In tool flow when: last msg is a tool result (tools ran, waiting for AI),
  // OR last msg is assistant with tool calls (tools still executing)
  const isInToolFlow =
    lastMessage?.role === "tool" ||
    (lastMessage?.role === "assistant" &&
      (lastMessage as UIMessage).toolCalls?.length);

  let isProcessingToolResults = false;

  if (isLoading && isInToolFlow) {
    // Last message is a tool result → all tools for this turn are done, AI is continuing
    if (lastMessage?.role === "tool") {
      isProcessingToolResults = true;
    } else if (lastAssistantWithTools) {
      const currentToolCallIds = new Set(
        lastAssistantWithTools.toolCalls?.map((tc: { id: string }) => tc.id) ||
          [],
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
      isProcessingToolResults = hasCompletedTools && !hasExecutingTools;
    }
  }

  // Extract chat classNames (without thread picker classes)
  const chatClassNames = classNames
    ? {
        root: classNames.root,
        header: classNames.header,
        container: classNames.container,
        messageList: classNames.messageList,
        userMessage: classNames.userMessage,
        assistantMessage: classNames.assistantMessage,
        input: classNames.input,
        suggestions: classNames.suggestions,
        footer: classNames.footer,
      }
    : undefined;

  // Build thread picker element (if enabled)
  const { threadManager, handleSwitchThread, handleNewThread, isBusy } =
    threadManagerResult;

  // Handle delete thread
  const handleDeleteThread = React.useCallback(
    (threadId: string) => {
      const isCurrentThread = threadManager.currentThreadId === threadId;
      threadManager.deleteThread(threadId);

      // If deleting the current thread, clear messages and show welcome screen
      if (isCurrentThread) {
        handleNewThread();
      }
    },
    [threadManager, handleNewThread],
  );

  const threadPickerElement =
    isPersistenceEnabled && showThreadPicker ? (
      <ThreadPicker
        value={threadManager.currentThreadId}
        threads={threadManager.threads}
        onSelect={handleSwitchThread}
        onDeleteThread={handleDeleteThread}
        onNewThread={handleNewThread}
        loading={threadManager.isLoading}
        disabled={isBusy}
        size="sm"
        className={classNames?.threadPicker}
        buttonClassName={classNames?.threadPickerButton}
        dropdownClassName={classNames?.threadPickerDropdown}
        itemClassName={classNames?.threadPickerItem}
        newButtonClassName={classNames?.threadPickerNewButton}
      />
    ) : undefined;

  // Auto-show header when any header element is configured
  const shouldShowHeader = !!header || showThreadPicker || chatProps.showHeader;

  // Only use custom renderHeader if user provided it AND we're not using built-in header features
  const useCustomHeader =
    chatProps.renderHeader && !header && !showThreadPicker;

  return (
    <Chat
      {...chatProps}
      messages={visibleMessages}
      onSendMessage={sendMessage}
      onStop={stop}
      isLoading={isLoading}
      showPoweredBy={chatProps.showPoweredBy ?? true}
      suggestions={suggestions}
      isProcessing={isProcessingToolResults}
      onApproveToolExecution={approveToolExecution}
      onRejectToolExecution={rejectToolExecution}
      registeredTools={registeredTools}
      classNames={chatClassNames}
      header={header}
      threadPicker={threadPickerElement}
      showHeader={shouldShowHeader}
      renderHeader={useCustomHeader ? chatProps.renderHeader : undefined}
      // Welcome screen props
      recentThreads={isPersistenceEnabled ? threadManager.threads : undefined}
      onSelectThread={isPersistenceEnabled ? handleSwitchThread : undefined}
      onDeleteThread={isPersistenceEnabled ? handleDeleteThread : undefined}
      // Thread management for compound components
      onNewChat={handleNewThread}
      threads={isPersistenceEnabled ? threadManager.threads : undefined}
      currentThreadId={threadManager.currentThreadId}
      onSwitchThread={isPersistenceEnabled ? handleSwitchThread : undefined}
      isThreadBusy={isBusy}
      // Branching (auto-wired from context)
      getBranchInfo={getBranchInfo}
      onSwitchBranch={switchBranch}
      onEditMessage={editMessage}
    >
      {children}
    </Chat>
  );
}

// Attach compound components from Chat to CopilotChat
// This allows: <CopilotChat.Root>, <CopilotChat.HomeView>, <CopilotChat.ChatView>, etc.
export const CopilotChat = Object.assign(CopilotChatBase, {
  Root: CopilotChatBase, // Alias for layout composition pattern
  Home: Chat.Home, // Backward compat alias
  HomeView: Chat.HomeView, // New name
  ChatView: Chat.ChatView,
  Header: Chat.Header,
  Footer: Chat.Footer,
  Input: Chat.Input,
  Suggestions: Chat.Suggestions,
  BackButton: Chat.BackButton, // Navigation: start new chat
  ThreadPicker: Chat.ThreadPicker, // Thread switching
});

// Alias for backwards compatibility
export const ConnectedChat = CopilotChat;
export type ConnectedChatProps = CopilotChatProps;
