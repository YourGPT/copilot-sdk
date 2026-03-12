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
  ToolOptimizationConfig,
} from "../../core";

import type { MCPServerConfig } from "../../mcp/types";
import type { Resolvable } from "../../core/utils/resolvable";

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
import { useMCPTools } from "../hooks/useMCPTools";
import {
  MessageHistoryContext,
  defaultMessageHistoryConfig,
  useMessageHistoryContext,
} from "../message-history/context";
import { useMessageHistory } from "../message-history/useMessageHistory";
import { toDisplayMessage } from "../message-history/message-utils";
import { buildSummaryBufferContext } from "../message-history/strategies/summary-buffer";
import type { MessageHistoryConfig } from "../message-history/types";

// ============================================
// Internal MCP Connection Component
// ============================================

function MCPConnection({ config }: { config: MCPServerConfig }) {
  useMCPTools({
    name: config.name,
    transport: config.transport,
    url: config.url,
    headers: config.headers,
    autoConnect: true,
    prefixToolNames: config.prefixToolNames ?? true,
    timeout: config.timeout,
  });
  return null;
}

// ============================================
// MessageHistoryBridge — wires useMessageHistory into AbstractChat.buildRequest()
// ============================================

const COMPACTING_MARKER_ID = "__compacting-in-progress__";

function MessageHistoryBridge({
  chatRef,
}: {
  chatRef: React.MutableRefObject<InstanceType<
    typeof ReactChatWithTools
  > | null>;
}) {
  const { compactionState, tokenUsage } = useMessageHistory();
  const ctx = useMessageHistoryContext();

  // Track whether we've already added the loading marker for the current compaction cycle
  const loaderAddedRef = useRef(false);
  const prevCompactionCountRef = useRef(compactionState.compactionCount);

  // When threshold is first crossed → add loading indicator
  useEffect(() => {
    if (!tokenUsage.isApproaching) {
      loaderAddedRef.current = false;
      return;
    }
    if (loaderAddedRef.current) return;
    const chat = chatRef.current;
    if (!chat) return;
    const alreadyAdded = chat.messages.some(
      (m) => m.id === COMPACTING_MARKER_ID,
    );
    if (alreadyAdded) return;
    loaderAddedRef.current = true;
    const loading: UIMessage = {
      id: COMPACTING_MARKER_ID,
      role: "system",
      content: "Compacting conversation…",
      createdAt: new Date(),
      metadata: { type: "compaction-marker", compacting: true },
    };
    chat.setMessages([...chat.messages, loading]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokenUsage.isApproaching]);

  // When compaction count increases → replace loader with permanent marker
  useEffect(() => {
    if (compactionState.compactionCount <= prevCompactionCountRef.current)
      return;
    prevCompactionCountRef.current = compactionState.compactionCount;
    loaderAddedRef.current = false;
    const chat = chatRef.current;
    if (!chat) return;
    const hasLoader = chat.messages.some((m) => m.id === COMPACTING_MARKER_ID);
    const base = hasLoader
      ? chat.messages.map((m) =>
          m.id === COMPACTING_MARKER_ID
            ? {
                ...m,
                id: `compaction-marker-${compactionState.compactionCount}`,
                content: `Conversation compacted — context window refreshed`,
                metadata: { type: "compaction-marker", compacting: false },
              }
            : m,
        )
      : [
          ...chat.messages,
          {
            id: `compaction-marker-${compactionState.compactionCount}`,
            role: "system" as const,
            content: `Conversation compacted — context window refreshed`,
            createdAt: new Date(),
            metadata: { type: "compaction-marker", compacting: false },
          },
        ];
    chat.setMessages(base);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compactionState.compactionCount]);

  // Keep latest compaction state + config in refs so the transform
  // (called synchronously inside AbstractChat) always sees fresh values.
  const compactionStateRef = useRef(compactionState);
  compactionStateRef.current = compactionState;
  const configRef = useRef(ctx.config);
  configRef.current = ctx.config;

  useEffect(() => {
    const chat = chatRef.current;
    if (!chat) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (chat as any).setRequestMessageTransform((allMessages: UIMessage[]) => {
      if (allMessages.length === 0) return allMessages;

      // Find the last user message — everything from here is the "current turn"
      // (user msg + any assistant tool-calls + tool results).
      // This is ALWAYS kept verbatim so we never send an invalid payload.
      let lastUserIdx = -1;
      for (let i = allMessages.length - 1; i >= 0; i--) {
        if (allMessages[i].role === "user") {
          lastUserIdx = i;
          break;
        }
      }

      // No user message at all — pass through untouched (safety valve)
      if (lastUserIdx === -1) return allMessages;

      const historyMessages = allMessages.slice(0, lastUserIdx);
      const currentTurn = allMessages.slice(lastUserIdx);

      // Nothing to compact
      if (historyMessages.length === 0) return allMessages;

      const cfg = configRef.current;
      const maxTokens = cfg.maxContextTokens ?? 128000;
      const reserve = cfg.reserveForResponse ?? 4096;

      // Apply summary-buffer only to the completed history, never the current turn
      const compactedHistory = buildSummaryBufferContext(
        historyMessages.map(toDisplayMessage),
        compactionStateRef.current,
        {
          recentBuffer: cfg.recentBuffer ?? 10,
          tokenBudget: maxTokens - reserve,
          compactionThreshold: cfg.compactionThreshold ?? 0.75,
          compactionUrl: cfg.compactionUrl,
        },
      );

      return [...compactedHistory, ...currentTurn] as unknown as UIMessage[];
    });
    return () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (chatRef.current as any)?.setRequestMessageTransform(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}

// ============================================
// Types
// ============================================

export interface CopilotProviderProps {
  children: React.ReactNode;
  /**
   * Runtime API endpoint URL
   * Can be static string or getter function for dynamic resolution.
   */
  runtimeUrl: Resolvable<string>;
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
  /**
   * Custom headers to send with each request
   * Can be static object or getter function for dynamic resolution.
   */
  headers?: Resolvable<Record<string, string>>;
  /**
   * Additional body properties to include in each request
   * Can be static object or getter function for dynamic resolution.
   */
  body?: Resolvable<Record<string, unknown>>;
  /** Enable debug logging */
  debug?: boolean;
  /** Max tool execution iterations (default: 20) */
  maxIterations?: number;
  /** Custom message when max iterations reached (sent to AI as tool result) */
  maxIterationsMessage?: string;
  /** MCP servers to connect to automatically */
  mcpServers?: MCPServerConfig[];
  /** Optional prompt/tool optimization controls (tool profiles, context budgets, etc.) */
  optimization?: ToolOptimizationConfig;
  /**
   * Context window management config. Controls compaction strategy, token budgets,
   * session persistence, and working memory.
   * @default strategy: 'none' — current behaviour, zero breaking changes
   */
  messageHistory?: MessageHistoryConfig;
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
  /**
   * Runtime URL configuration.
   * Can be a static string or getter function (matches what was passed to provider).
   */
  runtimeUrl: Resolvable<string>;
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
  systemPrompt,
  tools: toolsConfig,
  threadId,
  initialMessages,
  onMessagesChange,
  onError,
  streaming,
  headers,
  body,
  debug = false,
  maxIterations,
  maxIterationsMessage,
  mcpServers,
  optimization,
  messageHistory,
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
        body,
        debug,
        maxIterations,
        maxIterationsMessage,
        optimization,
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

  // ============================================
  // Headers & Body Reactivity
  // ============================================

  // Watch for headers prop changes and update chat
  useEffect(() => {
    if (chatRef.current && headers !== undefined) {
      chatRef.current.setHeaders(headers);
      debugLog("Headers config updated from prop");
    }
  }, [headers, debugLog]);

  // Watch for body prop changes
  useEffect(() => {
    if (chatRef.current && body !== undefined) {
      chatRef.current.setBody(body);
      debugLog("Body config updated from prop");
    }
  }, [body, debugLog]);

  // Watch for runtimeUrl prop changes
  useEffect(() => {
    if (chatRef.current && runtimeUrl !== undefined) {
      chatRef.current.setUrl(runtimeUrl);
      debugLog("URL config updated from prop");
    }
  }, [runtimeUrl, debugLog]);

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
    ],
  );

  const messageHistoryContextValue = React.useMemo(
    () => ({
      config: { ...defaultMessageHistoryConfig, ...messageHistory },
      tokenUsage: {
        current: 0,
        max: messageHistory?.maxContextTokens ?? 128000,
        percentage: 0,
        isApproaching: false,
      },
      compactionState: {
        rollingSummary: null,
        lastCompactionAt: null,
        compactionCount: 0,
        totalTokensSaved: 0,
        workingMemory: [],
        displayMessageCount: 0,
        llmMessageCount: 0,
      },
    }),
    [messageHistory],
  );

  return (
    <MessageHistoryContext.Provider value={messageHistoryContextValue}>
      <CopilotContext.Provider value={contextValue}>
        {mcpServers?.map((config) => (
          <MCPConnection key={config.name} config={config} />
        ))}
        {messageHistory?.strategy && messageHistory.strategy !== "none" && (
          <MessageHistoryBridge chatRef={chatRef} />
        )}
        {children}
      </CopilotContext.Provider>
    </MessageHistoryContext.Provider>
  );
}
