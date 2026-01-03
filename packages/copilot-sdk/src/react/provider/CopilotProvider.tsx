"use client";

/**
 * CopilotProvider - React context provider for Copilot SDK
 *
 * This provider uses ChatWithTools for coordinated chat + tool execution.
 * All internal wiring is handled by the chat package (framework-agnostic).
 */

import React, {
  createContext,
  useContext,
  useRef,
  useCallback,
  useMemo,
  useEffect,
  useSyncExternalStore,
  useState,
} from "react";

import type {
  Message,
  CopilotConfig,
  ToolsConfig,
  ToolDefinition,
  ActionDefinition,
  MessageAttachment,
  PermissionLevel,
} from "../../core";

import type { UIMessage, ToolExecution } from "../../chat";

import {
  ReactChatWithTools,
  type ReactChatWithToolsConfig,
} from "../internal/ReactChatWithTools";
import {
  addNode,
  removeNode,
  printTree,
  type ContextTreeNode,
} from "../utils/context-tree";

// ============================================
// Types
// ============================================

export interface CopilotProviderProps {
  children: React.ReactNode;
  runtimeUrl: string;
  config?: CopilotConfig["config"];
  cloud?: CopilotConfig["cloud"];
  systemPrompt?: string;
  /** @deprecated Use useTools() hook instead */
  tools?: ToolsConfig;
  threadId?: string;
  initialMessages?: Message[];
  onMessagesChange?: (messages: Message[]) => void;
  onError?: (error: Error) => void;
  /** Enable/disable streaming (default: true) */
  streaming?: boolean;
  debug?: boolean;
}

export interface CopilotContextValue {
  // Chat state
  messages: UIMessage[];
  status: "ready" | "submitted" | "streaming" | "error";
  error: Error | null;
  isLoading: boolean;

  // Chat actions
  sendMessage: (
    content: string,
    attachments?: MessageAttachment[],
  ) => Promise<void>;
  stop: () => void;
  clearMessages: () => void;
  regenerate: (messageId?: string) => Promise<void>;

  // Tool execution
  registerTool: (tool: ToolDefinition) => void;
  unregisterTool: (name: string) => void;
  registeredTools: ToolDefinition[];
  toolExecutions: ToolExecution[];
  pendingApprovals: ToolExecution[];
  approveToolExecution: (
    id: string,
    extraData?: Record<string, unknown>,
    permissionLevel?: PermissionLevel,
  ) => void;
  rejectToolExecution: (
    id: string,
    reason?: string,
    permissionLevel?: PermissionLevel,
  ) => void;

  // Actions
  registerAction: (action: ActionDefinition) => void;
  unregisterAction: (name: string) => void;
  registeredActions: ActionDefinition[];

  // AI Context (for useAIContext hook)
  addContext: (context: string, parentId?: string) => string;
  removeContext: (id: string) => void;

  // Config
  threadId?: string;
  runtimeUrl: string;
  toolsConfig?: ToolsConfig;
}

// ============================================
// Context
// ============================================

const CopilotContext = createContext<CopilotContextValue | null>(null);

export function useCopilot(): CopilotContextValue {
  const context = useContext(CopilotContext);
  if (!context) {
    throw new Error("useCopilot must be used within CopilotProvider");
  }
  return context;
}

// ============================================
// Provider Component
// ============================================

export function CopilotProvider({
  children,
  runtimeUrl,
  config,
  cloud,
  systemPrompt,
  tools: toolsConfig,
  threadId,
  initialMessages,
  onMessagesChange,
  onError,
  streaming,
  debug = false,
}: CopilotProviderProps) {
  // Debug logger
  const debugLog = useCallback(
    (...args: unknown[]) => {
      if (debug) console.log("[Copilot SDK]", ...args);
    },
    [debug],
  );

  // Warn about deprecated tools config
  useEffect(() => {
    if (
      toolsConfig &&
      (toolsConfig.screenshot || toolsConfig.console || toolsConfig.network)
    ) {
      console.warn(
        "[Copilot SDK] The `tools` prop is deprecated. Use the `useTools` hook instead.",
      );
    }
  }, [toolsConfig]);

  // ============================================
  // Tool Executions State (for React reactivity)
  // ============================================
  const [toolExecutions, setToolExecutions] = useState<ToolExecution[]>([]);

  // ============================================
  // ChatWithTools Instance
  // ============================================

  const chatRef = useRef<ReactChatWithTools | null>(null);

  // Initialize chat on first render
  if (chatRef.current === null) {
    // Convert initial messages to UIMessage format
    const uiInitialMessages: UIMessage[] | undefined = initialMessages?.map(
      (m) => ({
        id: m.id,
        role: m.role,
        content: m.content ?? "",
        createdAt: m.created_at ?? new Date(),
        attachments: m.metadata?.attachments as MessageAttachment[] | undefined,
        toolCalls: m.tool_calls,
        toolCallId: m.tool_call_id,
      }),
    );

    chatRef.current = new ReactChatWithTools(
      {
        runtimeUrl,
        llm: config,
        systemPrompt,
        threadId,
        initialMessages: uiInitialMessages,
        streaming,
        debug,
      },
      {
        onToolExecutionsChange: (executions) => {
          debugLog("Tool executions changed:", executions.length);
          setToolExecutions(executions);
        },
        onApprovalRequired: (execution) => {
          debugLog("Tool approval required:", execution.name);
        },
        onError: (error) => {
          if (error) onError?.(error);
        },
      },
    );
  }

  // Subscribe to chat state with useSyncExternalStore
  const messages = useSyncExternalStore(
    chatRef.current.subscribe,
    () => chatRef.current!.messages,
    () => chatRef.current!.messages,
  );

  const status = useSyncExternalStore(
    chatRef.current.subscribe,
    () => chatRef.current!.status,
    () => "ready" as const,
  );

  const errorFromChat = useSyncExternalStore(
    chatRef.current.subscribe,
    () => chatRef.current!.error,
    () => undefined,
  );
  const error = errorFromChat ?? null;

  const isLoading = status === "streaming" || status === "submitted";

  // ============================================
  // Actions
  // ============================================

  const registerTool = useCallback((tool: ToolDefinition) => {
    chatRef.current?.registerTool(tool);
  }, []);

  const unregisterTool = useCallback((name: string) => {
    chatRef.current?.unregisterTool(name);
  }, []);

  const approveToolExecution = useCallback(
    (
      id: string,
      extraData?: Record<string, unknown>,
      permissionLevel?: PermissionLevel,
    ) => {
      chatRef.current?.approveToolExecution(id, extraData, permissionLevel);
    },
    [],
  );

  const rejectToolExecution = useCallback(
    (id: string, reason?: string, permissionLevel?: PermissionLevel) => {
      chatRef.current?.rejectToolExecution(id, reason, permissionLevel);
    },
    [],
  );

  const registeredTools = chatRef.current?.tools ?? [];
  const pendingApprovals = toolExecutions.filter(
    (e) => e.approvalStatus === "required",
  );

  // ============================================
  // Actions Registration (for UI actions like buttons)
  // ============================================

  const actionsRef = useRef<Map<string, ActionDefinition>>(new Map());
  const [actionsVersion, setActionsVersion] = useState(0);

  const registerAction = useCallback((action: ActionDefinition) => {
    actionsRef.current.set(action.name, action);
    setActionsVersion((v) => v + 1);
  }, []);

  const unregisterAction = useCallback((name: string) => {
    actionsRef.current.delete(name);
    setActionsVersion((v) => v + 1);
  }, []);

  const registeredActions = useMemo(
    () => Array.from(actionsRef.current.values()),
    [actionsVersion],
  );

  // ============================================
  // AI Context Tree (for useAIContext hook)
  // ============================================

  const contextTreeRef = useRef<ContextTreeNode[]>([]);
  const contextIdCounter = useRef(0);

  const addContext = useCallback(
    (context: string, parentId?: string): string => {
      const id = `ctx-${++contextIdCounter.current}`;
      contextTreeRef.current = addNode(
        contextTreeRef.current,
        { id, value: context, parentId },
        parentId,
      );
      // Update chat's context
      const contextString = printTree(contextTreeRef.current);
      chatRef.current?.setContext(contextString);
      debugLog("Context added:", id);
      return id;
    },
    [debugLog],
  );

  const removeContext = useCallback(
    (id: string): void => {
      contextTreeRef.current = removeNode(contextTreeRef.current, id);
      // Update chat's context
      const contextString = printTree(contextTreeRef.current);
      chatRef.current?.setContext(contextString);
      debugLog("Context removed:", id);
    },
    [debugLog],
  );

  // ============================================
  // Chat Actions
  // ============================================

  const sendMessage = useCallback(
    async (content: string, attachments?: MessageAttachment[]) => {
      debugLog("Sending message:", content);
      await chatRef.current?.sendMessage(content, attachments);
    },
    [debugLog],
  );

  const stop = useCallback(() => {
    chatRef.current?.stop();
  }, []);

  const clearMessages = useCallback(() => {
    chatRef.current?.clearMessages();
  }, []);

  const regenerate = useCallback(async (messageId?: string) => {
    await chatRef.current?.regenerate(messageId);
  }, []);

  // ============================================
  // Callbacks
  // ============================================

  // Notify external callbacks
  useEffect(() => {
    if (onMessagesChange && messages.length > 0) {
      const coreMessages: Message[] = messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        created_at: m.createdAt,
        tool_calls: m.toolCalls,
        tool_call_id: m.toolCallId,
        metadata: {
          attachments: m.attachments,
          thinking: m.thinking,
        },
      }));
      onMessagesChange(coreMessages);
    }
  }, [messages, onMessagesChange]);

  useEffect(() => {
    if (error && onError) {
      onError(error);
    }
  }, [error, onError]);

  // Cleanup
  useEffect(() => {
    return () => {
      chatRef.current?.dispose();
    };
  }, []);

  // ============================================
  // Context Value
  // ============================================

  const contextValue = useMemo<CopilotContextValue>(
    () => ({
      // Chat state
      messages,
      status,
      error,
      isLoading,

      // Chat actions
      sendMessage,
      stop,
      clearMessages,
      regenerate,

      // Tool execution
      registerTool,
      unregisterTool,
      registeredTools,
      toolExecutions,
      pendingApprovals,
      approveToolExecution,
      rejectToolExecution,

      // Actions
      registerAction,
      unregisterAction,
      registeredActions,

      // AI Context
      addContext,
      removeContext,

      // Config
      threadId,
      runtimeUrl,
      toolsConfig,
    }),
    [
      messages,
      status,
      error,
      isLoading,
      sendMessage,
      stop,
      clearMessages,
      regenerate,
      registerTool,
      unregisterTool,
      registeredTools,
      toolExecutions,
      pendingApprovals,
      approveToolExecution,
      rejectToolExecution,
      registerAction,
      unregisterAction,
      registeredActions,
      addContext,
      removeContext,
      threadId,
      runtimeUrl,
      toolsConfig,
    ],
  );

  return (
    <CopilotContext.Provider value={contextValue}>
      {children}
    </CopilotContext.Provider>
  );
}
