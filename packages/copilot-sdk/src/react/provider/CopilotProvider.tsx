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
  /** Runtime API endpoint URL */
  runtimeUrl: string;
  /** System prompt sent with each request */
  systemPrompt?: string;
  /** @deprecated Use useTools() hook instead */
  tools?: ToolsConfig;
  /** Thread ID for conversation persistence */
  threadId?: string;
  /** Initial messages to populate the chat */
  initialMessages?: Message[];
  /** Callback when messages change */
  onMessagesChange?: (messages: Message[]) => void;
  /** Callback when an error occurs */
  onError?: (error: Error) => void;
  /** Enable/disable streaming (default: true) */
  streaming?: boolean;
  /** Custom headers to send with each request */
  headers?: Record<string, string>;
  /** Enable debug logging */
  debug?: boolean;
  /** Max tool execution iterations (default: 20) */
  maxIterations?: number;
  /** Custom message when max iterations reached (sent to AI as tool result) */
  maxIterationsMessage?: string;
  /** Enable/disable navigation messages (default: true) */
  showNavigationMessages?: boolean;
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
  setMessages: (messages: UIMessage[]) => void;
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

  // System Prompt
  setSystemPrompt: (prompt: string) => void;

  // Config
  threadId?: string;
  runtimeUrl: string;
  toolsConfig?: ToolsConfig;
  showNavigationMessages: boolean;
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
  systemPrompt,
  tools: toolsConfig,
  threadId,
  initialMessages,
  onMessagesChange,
  onError,
  streaming,
  headers,
  debug = false,
  maxIterations,
  maxIterationsMessage,
  showNavigationMessages = true,
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
  // If disposed (React StrictMode), revive instead of recreate to preserve tools
  if (chatRef.current !== null && chatRef.current.disposed) {
    chatRef.current.revive();
    debugLog("Revived disposed instance (React StrictMode)");
  }

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
        systemPrompt,
        threadId,
        initialMessages: uiInitialMessages,
        streaming,
        headers,
        debug,
        maxIterations,
        maxIterationsMessage,
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

  // ============================================
  // System Prompt Reactivity
  // ============================================

  // Watch for systemPrompt prop changes and update chat
  useEffect(() => {
    if (chatRef.current && systemPrompt !== undefined) {
      chatRef.current.setSystemPrompt(systemPrompt);
      debugLog("System prompt updated from prop");
    }
  }, [systemPrompt, debugLog]);

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
  // System Prompt
  // ============================================

  const setSystemPrompt = useCallback(
    (prompt: string): void => {
      chatRef.current?.setSystemPrompt(prompt);
      debugLog("System prompt updated via function");
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

  const setMessages = useCallback((messages: UIMessage[]) => {
    chatRef.current?.setMessages(messages);
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
      setMessages,
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

      // System Prompt
      setSystemPrompt,

      // Config
      threadId,
      runtimeUrl,
      toolsConfig,
      showNavigationMessages,
    }),
    [
      messages,
      status,
      error,
      isLoading,
      sendMessage,
      stop,
      clearMessages,
      setMessages,
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
      setSystemPrompt,
      threadId,
      runtimeUrl,
      toolsConfig,
      showNavigationMessages,
    ],
  );

  return (
    <CopilotContext.Provider value={contextValue}>
      {children}
    </CopilotContext.Provider>
  );
}
