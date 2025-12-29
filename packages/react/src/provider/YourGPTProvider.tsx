"use client";

import React, {
  useCallback,
  useMemo,
  useReducer,
  useRef,
  useEffect,
  type ReactNode,
} from "react";
import type {
  YourGPTConfig,
  Message,
  MessageAttachment,
  ActionDefinition,
  StreamEvent,
  ToolsConfig,
  ToolType,
  ToolConsentRequest,
  CapturedContext,
  Source,
  Thread,
  ThreadData,
  PersistenceConfig,
  ToolDefinition,
  ToolExecution,
  ToolResponse,
  ToolCallInfo,
  ToolCall,
  AssistantToolMessage,
  PermissionLevel,
  ToolPermission,
  PermissionStorageConfig,
  PermissionStorageAdapter,
  StorageService,
} from "@yourgpt/copilot-sdk-core";
import { generateThreadTitle } from "@yourgpt/copilot-sdk-core";
import {
  generateMessageId,
  generateThreadId,
  createMessage,
  streamSSE,
  // Tools
  detectIntent,
  generateSuggestionReason,
  captureScreenshot,
  startConsoleCapture,
  stopConsoleCapture,
  getConsoleLogs,
  startNetworkCapture,
  stopNetworkCapture,
  getNetworkRequests,
  formatLogsForAI,
  formatRequestsForAI,
  // Storage service
  createYourGPTStorage,
  processFileToAttachment,
} from "@yourgpt/copilot-sdk-core";
import {
  addNode,
  removeNode,
  printTree,
  type ContextTreeNode,
} from "../utils/context-tree";
import {
  YourGPTContext,
  initialChatState,
  initialToolsState,
  initialAgentLoopState,
  type ChatState,
  type ToolsState,
  type AgentLoopState,
  type YourGPTContextValue,
} from "../context/YourGPTContext";
import {
  ThreadsContext,
  type ThreadsContextValue,
} from "../context/ThreadsContext";
import { localStoragePersistence, noopPersistence } from "../utils/persistence";
import {
  createPermissionStorage,
  createSessionPermissionCache,
} from "../utils/permission-storage";

/**
 * Provider props
 */
export interface YourGPTProviderProps {
  /** SDK configuration */
  config?: YourGPTConfig["config"];
  /** Cloud configuration (alternative to config) */
  cloud?: YourGPTConfig["cloud"];
  /** Runtime URL for self-hosted backend */
  runtimeUrl?: string;
  /** System prompt */
  systemPrompt?: string;
  /** Extensions */
  extensions?: YourGPTConfig["extensions"];
  /** Tools configuration for Smart Context Awareness */
  tools?: ToolsConfig;
  /** Initial messages */
  initialMessages?: Message[];
  /** Callback when messages change */
  onMessagesChange?: (messages: Message[]) => void;
  /**
   * YourGPT API key for premium features
   * - Unlocks full headless mode
   * - Allows hiding "Powered by YourGPT" attribution
   * Get your key at https://yourgpt.ai
   */
  yourgptApiKey?: string;
  /**
   * Explicit thread ID to use
   * If provided, the provider will use this thread ID
   */
  threadId?: string;
  /**
   * Callback when thread changes
   */
  onThreadChange?: (threadId: string) => void;
  /**
   * Persistence configuration for threads
   * Default: disabled
   */
  persistence?: PersistenceConfig;
  /**
   * Knowledge base configuration
   * When provided, registers a search_knowledge tool automatically
   */
  knowledgeBase?: {
    /** Project UID for the knowledge base */
    projectUid: string;
    /** Auth token for API calls */
    token: string;
    /** App ID (default: "1") */
    appId?: string;
    /** Results limit (default: 5) */
    limit?: number;
    /** Whether to enable (default: true) */
    enabled?: boolean;
  };
  /**
   * Permission storage configuration for persistent tool approvals
   * Controls how "don't ask again" choices are stored
   */
  permissionStorage?: PermissionStorageConfig;
  /**
   * Custom permission storage adapter
   * Use for custom storage backends (e.g., server-side)
   */
  customPermissionStorage?: PermissionStorageAdapter;
  /**
   * Enable debug logging (default: false in production, true in development)
   */
  debug?: boolean;
  /**
   * Enable streaming responses (default: true)
   * Set to false for non-streaming mode (useful for debugging/comparison)
   */
  streaming?: boolean;
  /** Children */
  children: ReactNode;
}

/**
 * Chat UI state reducer actions (UI state only - messages are in threadsState)
 */
type ChatAction =
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "SET_ERROR"; payload: Error | null }
  | { type: "CLEAR" };

/**
 * Tools state reducer actions
 */
type ToolsAction =
  | { type: "SET_ENABLED"; payload: boolean }
  | { type: "SET_PENDING_CONSENT"; payload: ToolConsentRequest | null }
  | { type: "SET_LAST_CONTEXT"; payload: CapturedContext | null }
  | { type: "SET_CAPTURING"; payload: boolean };

/**
 * Chat UI state reducer (UI state only - messages are in threadsState)
 */
function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case "SET_LOADING":
      return { ...state, isLoading: action.payload };
    case "SET_ERROR":
      return { ...state, error: action.payload };
    case "CLEAR":
      return { ...initialChatState };
    default:
      return state;
  }
}

/**
 * Tools state reducer
 */
function toolsReducer(state: ToolsState, action: ToolsAction): ToolsState {
  switch (action.type) {
    case "SET_ENABLED":
      return { ...state, isEnabled: action.payload };
    case "SET_PENDING_CONSENT":
      return { ...state, pendingConsent: action.payload };
    case "SET_LAST_CONTEXT":
      return { ...state, lastContext: action.payload };
    case "SET_CAPTURING":
      return { ...state, isCapturing: action.payload };
    default:
      return state;
  }
}

/**
 * Agent loop state reducer actions
 */
type AgentLoopAction =
  | { type: "ADD_EXECUTION"; payload: ToolExecution }
  | {
      type: "UPDATE_EXECUTION";
      payload: { id: string; update: Partial<ToolExecution> };
    }
  | {
      type: "SET_ITERATION";
      payload: { iteration: number; maxIterations: number };
    }
  | { type: "SET_MAX_ITERATIONS_REACHED"; payload: boolean }
  | { type: "SET_PROCESSING"; payload: boolean }
  | { type: "CLEAR_EXECUTIONS" };

/**
 * Agent loop state reducer
 */
function agentLoopReducer(
  state: AgentLoopState,
  action: AgentLoopAction,
): AgentLoopState {
  switch (action.type) {
    case "ADD_EXECUTION":
      return {
        ...state,
        toolExecutions: [...state.toolExecutions, action.payload],
      };
    case "UPDATE_EXECUTION":
      return {
        ...state,
        toolExecutions: state.toolExecutions.map((exec) =>
          exec.id === action.payload.id
            ? { ...exec, ...action.payload.update }
            : exec,
        ),
      };
    case "SET_ITERATION":
      return {
        ...state,
        iteration: action.payload.iteration,
        maxIterations: action.payload.maxIterations,
      };
    case "SET_MAX_ITERATIONS_REACHED":
      return {
        ...state,
        maxIterationsReached: action.payload,
      };
    case "SET_PROCESSING":
      return {
        ...state,
        isProcessing: action.payload,
      };
    case "CLEAR_EXECUTIONS":
      return {
        ...state,
        toolExecutions: [],
        iteration: 0,
        maxIterationsReached: false,
        isProcessing: false,
      };
    default:
      return state;
  }
}

/**
 * Threads state
 */
interface ThreadsState {
  threads: Map<string, ThreadData>;
  activeThreadId: string;
}

/**
 * Threads reducer actions
 */
type ThreadsAction =
  | {
      type: "INIT_THREADS";
      payload: { threads: ThreadData[]; activeThreadId: string };
    }
  | { type: "CREATE_THREAD"; payload: { id: string; title?: string } }
  | { type: "SWITCH_THREAD"; payload: { id: string } }
  | { type: "DELETE_THREAD"; payload: { id: string } }
  | { type: "CLEAR_THREAD"; payload: { id: string } }
  | { type: "UPDATE_THREAD_TITLE"; payload: { id: string; title: string } }
  | {
      type: "ADD_MESSAGE_TO_THREAD";
      payload: { threadId: string; message: Message };
    }
  | {
      type: "REMOVE_MESSAGE_FROM_THREAD";
      payload: { threadId: string; messageId: string };
    }
  | {
      type: "UPDATE_MESSAGE_IN_THREAD";
      payload: { threadId: string; messageId: string; content: string };
    }
  | {
      type: "UPDATE_THINKING_IN_THREAD";
      payload: { threadId: string; messageId: string; thinking: string };
    }
  | {
      type: "SET_TOOL_CALLS_IN_THREAD";
      payload: { threadId: string; messageId: string; toolCalls: ToolCall[] };
    }
  | {
      type: "ADD_SOURCE_TO_THREAD";
      payload: { threadId: string; messageId: string; source: Source };
    }
  | {
      type: "SET_MESSAGES_IN_THREAD";
      payload: { threadId: string; messages: Message[] };
    }
  | {
      type: "REPLACE_STREAMING_WITH_MESSAGES";
      payload: {
        threadId: string;
        streamingMessageId: string;
        messages: Message[];
      };
    }
  | {
      type: "SET_TOOL_EXECUTIONS_IN_THREAD";
      payload: {
        threadId: string;
        messageId: string;
        toolExecutions: ToolExecution[];
      };
    };

/**
 * Initial threads state
 */
function createInitialThreadsState(initialThreadId: string): ThreadsState {
  const now = new Date();
  const initialThread: ThreadData = {
    id: initialThreadId,
    messages: [],
    sources: [],
    createdAt: now,
    updatedAt: now,
  };
  const threads = new Map<string, ThreadData>();
  threads.set(initialThreadId, initialThread);
  return {
    threads,
    activeThreadId: initialThreadId,
  };
}

/**
 * Threads state reducer
 */
function threadsReducer(
  state: ThreadsState,
  action: ThreadsAction,
): ThreadsState {
  switch (action.type) {
    case "INIT_THREADS": {
      const threads = new Map<string, ThreadData>();
      action.payload.threads.forEach((t) => threads.set(t.id, t));
      return {
        threads,
        activeThreadId: action.payload.activeThreadId,
      };
    }

    case "CREATE_THREAD": {
      const now = new Date();
      const newThread: ThreadData = {
        id: action.payload.id,
        title: action.payload.title,
        messages: [],
        sources: [],
        createdAt: now,
        updatedAt: now,
      };
      const threads = new Map(state.threads);
      threads.set(action.payload.id, newThread);
      return {
        threads,
        activeThreadId: action.payload.id,
      };
    }

    case "SWITCH_THREAD": {
      if (!state.threads.has(action.payload.id)) {
        return state;
      }
      return {
        ...state,
        activeThreadId: action.payload.id,
      };
    }

    case "DELETE_THREAD": {
      const threads = new Map(state.threads);
      threads.delete(action.payload.id);

      // If deleting active thread, switch to first available or create new
      let activeThreadId = state.activeThreadId;
      if (activeThreadId === action.payload.id) {
        const remaining = Array.from(threads.keys());
        if (remaining.length > 0) {
          activeThreadId = remaining[0];
        } else {
          // Create a new thread if all deleted
          const newId = generateThreadId();
          const now = new Date();
          threads.set(newId, {
            id: newId,
            messages: [],
            sources: [],
            createdAt: now,
            updatedAt: now,
          });
          activeThreadId = newId;
        }
      }
      return { threads, activeThreadId };
    }

    case "CLEAR_THREAD": {
      const threads = new Map(state.threads);
      const thread = threads.get(action.payload.id);
      if (thread) {
        threads.set(action.payload.id, {
          ...thread,
          messages: [],
          sources: [],
          updatedAt: new Date(),
        });
      }
      return { ...state, threads };
    }

    case "UPDATE_THREAD_TITLE": {
      const threads = new Map(state.threads);
      const thread = threads.get(action.payload.id);
      if (thread) {
        threads.set(action.payload.id, {
          ...thread,
          title: action.payload.title,
          updatedAt: new Date(),
        });
      }
      return { ...state, threads };
    }

    case "ADD_MESSAGE_TO_THREAD": {
      const threads = new Map(state.threads);
      const thread = threads.get(action.payload.threadId);
      if (thread) {
        const updatedThread = {
          ...thread,
          messages: [...thread.messages, action.payload.message],
          updatedAt: new Date(),
        };
        // Auto-generate title from first user message
        if (
          !updatedThread.title &&
          action.payload.message.role === "user" &&
          action.payload.message.content &&
          thread.messages.length === 0
        ) {
          updatedThread.title = generateThreadTitle(
            action.payload.message.content,
          );
        }
        threads.set(action.payload.threadId, updatedThread);
      }
      return { ...state, threads };
    }

    case "REMOVE_MESSAGE_FROM_THREAD": {
      const threads = new Map(state.threads);
      const thread = threads.get(action.payload.threadId);
      if (thread) {
        threads.set(action.payload.threadId, {
          ...thread,
          messages: thread.messages.filter(
            (msg) => msg.id !== action.payload.messageId,
          ),
          updatedAt: new Date(),
        });
      }
      return { ...state, threads };
    }

    case "UPDATE_MESSAGE_IN_THREAD": {
      const threads = new Map(state.threads);
      const thread = threads.get(action.payload.threadId);
      if (thread) {
        threads.set(action.payload.threadId, {
          ...thread,
          messages: thread.messages.map((msg) =>
            msg.id === action.payload.messageId
              ? { ...msg, content: msg.content + action.payload.content }
              : msg,
          ),
          updatedAt: new Date(),
        });
      }
      return { ...state, threads };
    }

    case "UPDATE_THINKING_IN_THREAD": {
      const threads = new Map(state.threads);
      const thread = threads.get(action.payload.threadId);
      if (thread) {
        threads.set(action.payload.threadId, {
          ...thread,
          messages: thread.messages.map((msg) =>
            msg.id === action.payload.messageId
              ? {
                  ...msg,
                  metadata: {
                    ...msg.metadata,
                    thinking:
                      (msg.metadata?.thinking || "") + action.payload.thinking,
                  },
                }
              : msg,
          ),
          updatedAt: new Date(),
        });
      }
      return { ...state, threads };
    }

    case "SET_TOOL_CALLS_IN_THREAD": {
      const threads = new Map(state.threads);
      const thread = threads.get(action.payload.threadId);
      if (thread) {
        threads.set(action.payload.threadId, {
          ...thread,
          messages: thread.messages.map((msg) =>
            msg.id === action.payload.messageId
              ? { ...msg, tool_calls: action.payload.toolCalls }
              : msg,
          ),
          updatedAt: new Date(),
        });
      }
      return { ...state, threads };
    }

    case "ADD_SOURCE_TO_THREAD": {
      const threads = new Map(state.threads);
      const thread = threads.get(action.payload.threadId);
      if (thread) {
        threads.set(action.payload.threadId, {
          ...thread,
          sources: [...thread.sources, action.payload.source],
          messages: thread.messages.map((msg) =>
            msg.id === action.payload.messageId
              ? {
                  ...msg,
                  metadata: {
                    ...msg.metadata,
                    sources: [
                      ...(msg.metadata?.sources || []),
                      action.payload.source,
                    ],
                  },
                }
              : msg,
          ),
          updatedAt: new Date(),
        });
      }
      return { ...state, threads };
    }

    case "SET_MESSAGES_IN_THREAD": {
      const threads = new Map(state.threads);
      const thread = threads.get(action.payload.threadId);
      if (thread) {
        threads.set(action.payload.threadId, {
          ...thread,
          messages: action.payload.messages,
          updatedAt: new Date(),
        });
      }
      return { ...state, threads };
    }

    case "REPLACE_STREAMING_WITH_MESSAGES": {
      // Replace the streaming assistant message with server-returned messages
      // This handles server-side tool execution where we need to add:
      // - Assistant messages with tool_calls
      // - Tool result messages
      // - Final assistant response
      const threads = new Map(state.threads);
      const thread = threads.get(action.payload.threadId);
      if (thread) {
        // Remove the streaming message and append server-returned messages
        const filteredMessages = thread.messages.filter(
          (msg) => msg.id !== action.payload.streamingMessageId,
        );
        threads.set(action.payload.threadId, {
          ...thread,
          messages: [...filteredMessages, ...action.payload.messages],
          updatedAt: new Date(),
        });
      }
      return { ...state, threads };
    }

    case "SET_TOOL_EXECUTIONS_IN_THREAD": {
      // Store tool executions directly on a message so they persist
      // after new messages are sent (toolExecutions stored in agentLoopState
      // get cleared on each new sendMessage, so we need to save them here)
      const threads = new Map(state.threads);
      const thread = threads.get(action.payload.threadId);
      if (thread) {
        threads.set(action.payload.threadId, {
          ...thread,
          messages: thread.messages.map((msg) =>
            msg.id === action.payload.messageId
              ? {
                  ...msg,
                  // Store as metadata since Message type doesn't have toolExecutions
                  metadata: {
                    ...msg.metadata,
                    toolExecutions: action.payload.toolExecutions,
                  },
                }
              : msg,
          ),
          updatedAt: new Date(),
        });
      }
      return { ...state, threads };
    }

    default:
      return state;
  }
}

/**
 * YourGPT Provider Component
 */
export function YourGPTProvider({
  config,
  cloud,
  runtimeUrl,
  systemPrompt,
  extensions,
  tools: toolsConfig,
  initialMessages = [],
  onMessagesChange,
  yourgptApiKey,
  threadId: explicitThreadId,
  onThreadChange,
  persistence,
  knowledgeBase,
  permissionStorage,
  customPermissionStorage,
  debug,
  streaming,
  children,
}: YourGPTProviderProps) {
  // Debug logger - only logs when debug is enabled
  // Default: false (user must explicitly enable)
  const isDebugEnabled = debug === true;
  const debugLog = useCallback(
    (...args: unknown[]) => {
      if (isDebugEnabled) {
        console.log(...args);
      }
    },
    [isDebugEnabled],
  );

  // Check if user has premium features
  // TODO: [Cloud Integration] Validate API key against YourGPT cloud
  // to get enabled features, plan details, and usage limits.
  // Current: Simple prefix check (client-side only)
  // Future: Server validation with feature flags response
  const isPremium = Boolean(yourgptApiKey?.startsWith("ygpt_"));

  // Create storage service for premium users (cloud storage)
  const storageService = useMemo<StorageService | null>(() => {
    if (cloud?.apiKey && isPremium) {
      return createYourGPTStorage({
        apiKey: cloud.apiKey,
        endpoint: cloud.endpoint,
      });
    }
    return null;
  }, [cloud?.apiKey, cloud?.endpoint, isPremium]);

  const isCloudStorageAvailable = storageService?.isAvailable() ?? false;

  // Process file to attachment (uses cloud storage if available, else base64)
  const processAttachment = useCallback(
    async (file: File): Promise<MessageAttachment> => {
      return processFileToAttachment(file, storageService);
    },
    [storageService],
  );

  // Generate initial thread ID
  const initialThreadId = useMemo(
    () => explicitThreadId || generateThreadId(),
    [],
  );

  // Threads state
  const [threadsState, threadsDispatch] = useReducer(
    threadsReducer,
    createInitialThreadsState(initialThreadId),
  );

  // Get persistence adapter
  const persistenceAdapter = useMemo(() => {
    if (!persistence?.enabled) return noopPersistence;
    if (persistence.storage === "custom" && persistence.customStorage) {
      return persistence.customStorage;
    }
    return localStoragePersistence;
  }, [persistence]);

  // Permission storage adapter
  const permissionStorageAdapter = useMemo(() => {
    if (customPermissionStorage) {
      return customPermissionStorage;
    }
    return createPermissionStorage(permissionStorage || { type: "memory" });
  }, [permissionStorage, customPermissionStorage]);

  // Session-only permissions (in-memory, cleared on unmount)
  const sessionPermissionsRef = useRef<Map<string, PermissionLevel>>(
    createSessionPermissionCache(),
  );

  // Stored permissions state
  const [storedPermissions, setStoredPermissions] = React.useState<
    Map<string, ToolPermission>
  >(new Map());
  const [permissionsLoaded, setPermissionsLoaded] = React.useState(false);

  // Load stored permissions on mount
  useEffect(() => {
    permissionStorageAdapter.getAll().then((permissions) => {
      setStoredPermissions(new Map(permissions.map((p) => [p.toolName, p])));
      setPermissionsLoaded(true);
    });
  }, [permissionStorageAdapter]);

  // Load threads from persistence on mount
  const [isLoadingPersistence, setIsLoadingPersistence] = React.useState(
    persistence?.enabled || false,
  );
  useEffect(() => {
    if (!persistence?.enabled) return;

    persistenceAdapter.load().then((loadedThreads) => {
      if (loadedThreads.length > 0) {
        // Find most recently updated thread or use explicit threadId
        const activeId =
          explicitThreadId ||
          loadedThreads.sort(
            (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime(),
          )[0].id;

        threadsDispatch({
          type: "INIT_THREADS",
          payload: { threads: loadedThreads, activeThreadId: activeId },
        });
      }
      setIsLoadingPersistence(false);
    });
  }, []);

  // Save threads to persistence when they change
  useEffect(() => {
    if (!persistence?.enabled || isLoadingPersistence) return;

    const threadsArray = Array.from(threadsState.threads.values());
    persistenceAdapter.save(threadsArray);
  }, [
    threadsState.threads,
    persistence?.enabled,
    isLoadingPersistence,
    persistenceAdapter,
  ]);

  // Notify on thread change
  useEffect(() => {
    onThreadChange?.(threadsState.activeThreadId);
  }, [threadsState.activeThreadId, onThreadChange]);

  // Derived values from threadsState (single source of truth for messages)
  const currentThread = threadsState.threads.get(threadsState.activeThreadId);
  const currentMessages = currentThread?.messages || [];
  const currentSources = currentThread?.sources || [];
  const currentThreadId = threadsState.activeThreadId;

  // Chat UI state (only loading/error - messages come from threadsState)
  const [chatState, chatDispatch] = useReducer(chatReducer, initialChatState);

  // Tools state
  const [toolsState, toolsDispatch] = useReducer(toolsReducer, {
    ...initialToolsState,
    isEnabled: Boolean(
      toolsConfig?.screenshot || toolsConfig?.console || toolsConfig?.network,
    ),
  });

  // Agent loop state (for agentic tool executions)
  const [agentLoopState, agentLoopDispatch] = useReducer(
    agentLoopReducer,
    initialAgentLoopState,
  );

  // Ref to always have latest agentLoopState (for use in callbacks to avoid stale closures)
  const agentLoopStateRef = useRef(agentLoopState);
  useEffect(() => {
    agentLoopStateRef.current = agentLoopState;
  }, [agentLoopState]);

  // Registered tools (agentic loop)
  const registeredToolsRef = useRef<Map<string, ToolDefinition>>(new Map());
  const [registeredToolsVersion, setRegisteredToolsVersion] = React.useState(0);

  // Registered actions
  const actionsRef = useRef<Map<string, ActionDefinition>>(new Map());
  const [actionsVersion, setActionsVersion] = React.useState(0);

  // Abort controller for stopping generation
  const abortControllerRef = useRef<AbortController | null>(null);

  // Client-side tool loop state (Vercel AI SDK pattern)
  const pendingToolCallsRef = useRef<ToolCallInfo[]>([]);
  const pendingAssistantMessageRef = useRef<AssistantToolMessage | null>(null);
  const currentAssistantMessageIdRef = useRef<string | null>(null);

  // Refs for storing state during tool approval (needsApproval pattern)
  const pendingMessagesForApprovalRef = useRef<Message[] | null>(null);
  const pendingAssistantIdForApprovalRef = useRef<string | null>(null);

  // Ref to store handleStreamEvent for use in executeToolsAndContinue
  const handleStreamEventRef = useRef<
    ((event: StreamEvent, messageId: string) => Promise<void>) | null
  >(null);

  // Ref to track added execution IDs (to prevent duplicates during async state updates)
  const addedExecutionIdsRef = useRef<Set<string>>(new Set());

  // Consent resolver for async flow
  const consentResolverRef = useRef<((approved: ToolType[]) => void) | null>(
    null,
  );

  // Remembered consent for session
  const rememberedConsentRef = useRef<Set<ToolType>>(new Set());

  // Context management for useAIContext (tree-based for hierarchical contexts)
  const [contextTree, setContextTree] = React.useState<ContextTreeNode[]>([]);

  // Add context (returns context ID) - supports optional parentId for nesting
  const addContext = useCallback(
    (context: string, parentId?: string): string => {
      const id = `ctx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      setContextTree((prev) =>
        addNode(prev, { id, value: context, children: [] }, parentId),
      );
      return id;
    },
    [],
  );

  // Remove context by ID
  const removeContext = useCallback((id: string): void => {
    setContextTree((prev) => removeNode(prev, id));
  }, []);

  // Default system prompt when none is provided
  const DEFAULT_SYSTEM_PROMPT =
    "You are a helpful AI copilot. Use the available tools to assist users. Be concise and helpful.";

  // Build system prompt with contexts
  // Note: Knowledge base instruction is added server-side by runtime when KB config is provided
  const buildSystemPromptWithContexts = useCallback((): string => {
    let prompt = systemPrompt || DEFAULT_SYSTEM_PROMPT;

    // Add context tree if available
    const contextString = printTree(contextTree);
    if (contextString) {
      prompt = `${prompt}\n\nThe user has provided you with the following context:\n\`\`\`\n${contextString}\n\`\`\``;
    }

    return prompt;
  }, [systemPrompt, contextTree]);

  // Start console/network capture on mount if enabled
  useEffect(() => {
    if (toolsConfig?.console) {
      startConsoleCapture(toolsConfig.consoleOptions);
    }
    if (toolsConfig?.network) {
      startNetworkCapture(toolsConfig.networkOptions);
    }

    return () => {
      stopConsoleCapture();
      stopNetworkCapture();
    };
  }, [
    toolsConfig?.console,
    toolsConfig?.network,
    toolsConfig?.consoleOptions,
    toolsConfig?.networkOptions,
  ]);

  // ============================================
  // Auto-register Internal Smart Context Tools
  // ============================================
  // When toolsConfig enables screenshot/console/network, automatically
  // register them as AI-callable tools (agentic pattern)

  useEffect(() => {
    if (!toolsConfig) return;

    const registeredInternalTools: string[] = [];

    // Screenshot tool
    if (toolsConfig.screenshot) {
      const screenshotTool: ToolDefinition = {
        name: "capture_screenshot",
        description:
          "Capture a screenshot of the current viewport for visual analysis. Use this when you need to see what the user is looking at or analyze the page layout.",
        location: "client",
        inputSchema: {
          type: "object",
          properties: {
            reason: {
              type: "string",
              description: "Brief reason for capturing the screenshot",
            },
          },
        },
        needsApproval: toolsConfig.requireConsent !== false,
        approvalMessage: (params: { reason?: string }) =>
          params?.reason
            ? `Take a screenshot to ${params.reason}?`
            : "Take a screenshot of the current screen?",
        handler: async () => {
          debugLog("[YourGPT] capture_screenshot: handler called");
          try {
            debugLog(
              "[YourGPT] capture_screenshot: calling captureScreenshot...",
            );
            const screenshot = await captureScreenshot(
              toolsConfig.screenshotOptions,
            );
            debugLog("[YourGPT] capture_screenshot: success", {
              width: screenshot.width,
              height: screenshot.height,
            });
            return {
              success: true,
              message: `Here's my current screen (${screenshot.width}x${screenshot.height})`,
              // Flag to add this as a user message in chat
              addAsUserMessage: true,
              userMessageContent: "Here's my screen:",
              data: {
                attachment: {
                  type: "image" as const,
                  data: screenshot.data,
                  mimeType: `image/${screenshot.format}`,
                  filename: "screenshot.png",
                },
              },
            };
          } catch (error) {
            console.error("[YourGPT] capture_screenshot: error", error);
            return {
              success: false,
              error:
                error instanceof Error
                  ? error.message
                  : "Failed to capture screenshot",
            };
          }
        },
      };
      registeredToolsRef.current.set("capture_screenshot", screenshotTool);
      registeredInternalTools.push("capture_screenshot");
    }

    // Console logs tool
    if (toolsConfig.console) {
      const consoleTool: ToolDefinition = {
        name: "get_console_logs",
        description:
          "Get recent console logs from the browser. Use this to debug errors, warnings, or understand what's happening in the application.",
        location: "client",
        inputSchema: {
          type: "object",
          properties: {
            types: {
              type: "array",
              items: {
                type: "string",
                enum: ["log", "info", "warn", "error", "debug"],
              },
              description: "Filter by log types (default: all types)",
            },
            limit: {
              type: "number",
              description: "Maximum number of logs to return (default: 50)",
            },
          },
        },
        needsApproval: toolsConfig.requireConsent !== false,
        approvalMessage: "Access console logs to help debug the issue?",
        handler: async (params: { types?: string[]; limit?: number }) => {
          debugLog("[YourGPT] get_console_logs: handler called", params);
          try {
            const logs = getConsoleLogs({
              ...toolsConfig.consoleOptions,
              types: params.types as
                | ("log" | "info" | "warn" | "error" | "debug")[]
                | undefined,
              limit: params.limit,
            });
            debugLog("[YourGPT] get_console_logs: success", {
              count: logs.logs.length,
            });
            return {
              success: true,
              message: `Retrieved ${logs.logs.length} console logs`,
              data: {
                logs: logs.logs,
                totalCaptured: logs.totalCaptured,
                formatted: formatLogsForAI(logs.logs),
              },
            };
          } catch (error) {
            console.error("[YourGPT] get_console_logs: error", error);
            return {
              success: false,
              error:
                error instanceof Error
                  ? error.message
                  : "Failed to get console logs",
            };
          }
        },
      };
      registeredToolsRef.current.set("get_console_logs", consoleTool);
      registeredInternalTools.push("get_console_logs");
    }

    // Network requests tool
    if (toolsConfig.network) {
      const networkTool: ToolDefinition = {
        name: "get_network_requests",
        description:
          "Get recent network requests made by the application. Use this to debug API issues, failed requests, or understand data flow.",
        location: "client",
        inputSchema: {
          type: "object",
          properties: {
            failedOnly: {
              type: "boolean",
              description: "Only return failed requests (default: true)",
            },
            limit: {
              type: "number",
              description: "Maximum number of requests to return (default: 20)",
            },
          },
        },
        needsApproval: toolsConfig.requireConsent !== false,
        approvalMessage: "Access network request logs to help debug the issue?",
        handler: async (params: { failedOnly?: boolean; limit?: number }) => {
          debugLog("[YourGPT] get_network_requests: handler called", params);
          try {
            const requests = getNetworkRequests({
              ...toolsConfig.networkOptions,
              failedOnly: params.failedOnly,
              limit: params.limit,
            });
            debugLog("[YourGPT] get_network_requests: success", {
              count: requests.requests.length,
            });
            return {
              success: true,
              message: `Retrieved ${requests.requests.length} network requests`,
              data: {
                requests: requests.requests,
                totalCaptured: requests.totalCaptured,
                formatted: formatRequestsForAI(requests.requests),
              },
            };
          } catch (error) {
            console.error("[YourGPT] get_network_requests: error", error);
            return {
              success: false,
              error:
                error instanceof Error
                  ? error.message
                  : "Failed to get network requests",
            };
          }
        },
      };
      registeredToolsRef.current.set("get_network_requests", networkTool);
      registeredInternalTools.push("get_network_requests");
    }

    // Trigger re-render to include new tools
    if (registeredInternalTools.length > 0) {
      setRegisteredToolsVersion((v) => v + 1);
    }

    // Cleanup: unregister internal tools on unmount or config change
    return () => {
      registeredInternalTools.forEach((name) => {
        registeredToolsRef.current.delete(name);
      });
      if (registeredInternalTools.length > 0) {
        setRegisteredToolsVersion((v) => v + 1);
      }
    };
  }, [
    toolsConfig?.screenshot,
    toolsConfig?.console,
    toolsConfig?.network,
    toolsConfig?.requireConsent,
    toolsConfig?.screenshotOptions,
    toolsConfig?.consoleOptions,
    toolsConfig?.networkOptions,
  ]);

  // Build full config
  const fullConfig = useMemo<YourGPTConfig>(
    () => ({
      config,
      cloud,
      runtimeUrl,
      systemPrompt,
      extensions,
    }),
    [config, cloud, runtimeUrl, systemPrompt, extensions],
  );

  // Get API endpoint
  const getEndpoint = useCallback(() => {
    if (cloud) {
      return cloud.endpoint || "https://api.yourgpt.ai/v1/chat";
    }
    return runtimeUrl || "/api/chat";
  }, [cloud, runtimeUrl]);

  // Build request headers (consolidates duplicate header building)
  const buildRequestHeaders = useCallback((): Record<string, string> => {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (cloud?.apiKey) {
      headers["Authorization"] = `Bearer ${cloud.apiKey}`;
    } else if (config?.apiKey) {
      headers["X-API-Key"] = config.apiKey;
    }
    return headers;
  }, [cloud?.apiKey, config?.apiKey]);

  // Build request body (consolidates duplicate body building)
  const buildRequestBody = useCallback(
    (
      messages: Message[],
      options?: { includeAttachments?: boolean },
    ): Record<string, unknown> => {
      return {
        messages: messages.map((m) => {
          const msg: Record<string, unknown> = {
            role: m.role,
            content: m.content,
          };
          if (options?.includeAttachments && m.metadata?.attachments) {
            msg.attachments = m.metadata.attachments;
          }
          // Preserve tool_calls and tool_call_id for tool results
          // ToolCall has function.arguments (string), ToolCallInfo has args (object)
          if (m.tool_calls && m.tool_calls.length > 0) {
            msg.tool_calls = m.tool_calls.map((tc) => {
              // Handle both ToolCall (function.arguments) and ToolCallInfo (args)
              const tcArgs =
                tc.function?.arguments ||
                (tc as unknown as { args: Record<string, unknown> }).args ||
                {};
              const tcName =
                tc.function?.name || (tc as unknown as { name: string }).name;
              return {
                id: tc.id,
                type: "function" as const,
                function: {
                  name: tcName,
                  arguments:
                    typeof tcArgs === "string"
                      ? tcArgs
                      : JSON.stringify(tcArgs),
                },
              };
            });
          }
          const extendedMsg = m as unknown as Record<string, unknown>;
          // Also check for snake_case (from raw messages in agent loop)
          if (extendedMsg.tool_calls && !msg.tool_calls) {
            msg.tool_calls = extendedMsg.tool_calls;
          }
          if (extendedMsg.tool_call_id) {
            msg.tool_call_id = extendedMsg.tool_call_id;
          }
          return msg;
        }),
        threadId: currentThreadId,
        botId: cloud?.botId,
        config: config,
        systemPrompt: buildSystemPromptWithContexts(),
        actions: Array.from(actionsRef.current.values()).map((a) => ({
          name: a.name,
          description: a.description,
          parameters: a.parameters,
        })),
        // Only send client-side tools (server-side tools are handled by runtime)
        tools: Array.from(registeredToolsRef.current.values())
          .filter((t) => t.available !== false && t.location !== "server")
          .map((t) => ({
            name: t.name,
            description: t.description,
            inputSchema: t.inputSchema,
          })),
        // Pass knowledge base config to server (if enabled)
        knowledgeBase:
          knowledgeBase && knowledgeBase.enabled !== false
            ? {
                projectUid: knowledgeBase.projectUid,
                token: knowledgeBase.token,
                appId: knowledgeBase.appId,
                limit: knowledgeBase.limit,
              }
            : undefined,
        // Pass streaming flag (default: true)
        streaming: streaming ?? true,
      };
    },
    [
      currentThreadId,
      cloud?.botId,
      config,
      buildSystemPromptWithContexts,
      knowledgeBase,
      streaming,
    ],
  );

  // Capture context based on approved tools
  const captureContext = useCallback(
    async (approvedTools: ToolType[]): Promise<CapturedContext> => {
      toolsDispatch({ type: "SET_CAPTURING", payload: true });

      const context: CapturedContext = {
        timestamp: Date.now(),
      };

      try {
        // Capture screenshot
        if (approvedTools.includes("screenshot") && toolsConfig?.screenshot) {
          try {
            context.screenshot = await captureScreenshot(
              toolsConfig.screenshotOptions,
            );
          } catch (e) {
            console.warn("Failed to capture screenshot:", e);
          }
        }

        // Get console logs
        if (approvedTools.includes("console") && toolsConfig?.console) {
          context.consoleLogs = getConsoleLogs(toolsConfig.consoleOptions);
        }

        // Get network requests
        if (approvedTools.includes("network") && toolsConfig?.network) {
          context.networkRequests = getNetworkRequests(
            toolsConfig.networkOptions,
          );
        }
      } finally {
        toolsDispatch({ type: "SET_CAPTURING", payload: false });
      }

      toolsDispatch({ type: "SET_LAST_CONTEXT", payload: context });
      return context;
    },
    [toolsConfig],
  );

  // Request consent for tools
  const requestConsent = useCallback(
    (suggestedTools: ToolType[], reason = ""): Promise<ToolType[]> => {
      // Filter to only enabled tools
      const enabledTools = suggestedTools.filter((tool) => {
        if (tool === "screenshot") return toolsConfig?.screenshot;
        if (tool === "console") return toolsConfig?.console;
        if (tool === "network") return toolsConfig?.network;
        return false;
      });

      if (enabledTools.length === 0) {
        return Promise.resolve([]);
      }

      // Check if consent is required
      if (toolsConfig?.requireConsent === false) {
        return Promise.resolve(enabledTools);
      }

      // Check remembered consent
      const needsConsent = enabledTools.filter(
        (tool) => !rememberedConsentRef.current.has(tool),
      );

      if (needsConsent.length === 0) {
        return Promise.resolve(enabledTools);
      }

      // Create consent request
      const request: ToolConsentRequest = {
        tools: needsConsent,
        reason,
        keywords: [],
      };

      toolsDispatch({ type: "SET_PENDING_CONSENT", payload: request });

      return new Promise((resolve) => {
        consentResolverRef.current = resolve;
      });
    },
    [toolsConfig],
  );

  // Respond to consent request
  const respondToConsent = useCallback(
    (approved: ToolType[], remember = false) => {
      if (remember) {
        approved.forEach((tool) => rememberedConsentRef.current.add(tool));
      }

      toolsDispatch({ type: "SET_PENDING_CONSENT", payload: null });

      if (consentResolverRef.current) {
        consentResolverRef.current(approved);
        consentResolverRef.current = null;
      }
    },
    [],
  );

  // Clear pending consent
  const clearConsent = useCallback(() => {
    toolsDispatch({ type: "SET_PENDING_CONSENT", payload: null });
    if (consentResolverRef.current) {
      consentResolverRef.current([]);
      consentResolverRef.current = null;
    }
  }, []);

  // Format context for AI
  const formatContextForAI = useCallback((context: CapturedContext): string => {
    const parts: string[] = [];

    if (context.screenshot) {
      parts.push(
        `[Screenshot captured: ${context.screenshot.width}x${context.screenshot.height}]`,
      );
    }

    if (context.consoleLogs && context.consoleLogs.logs.length > 0) {
      parts.push(formatLogsForAI(context.consoleLogs.logs));
    }

    if (
      context.networkRequests &&
      context.networkRequests.requests.length > 0
    ) {
      parts.push(formatRequestsForAI(context.networkRequests.requests));
    }

    return parts.join("\n\n");
  }, []);

  // Send message with context
  const sendMessageWithContext = useCallback(
    async (content: string, context: CapturedContext) => {
      if (!content.trim()) return;

      // Build message with context
      let enrichedContent = content.trim();
      const contextStr = formatContextForAI(context);

      if (contextStr) {
        enrichedContent = `${content.trim()}\n\n---\n\n**Captured App Context:**\n${contextStr}`;
      }

      // Create user message
      const userMessage: Message = {
        id: generateMessageId(),
        role: "user",
        content: enrichedContent,
        created_at: new Date(),
        // Store context metadata
        metadata: {
          hasContext: true,
          contextTools: [
            context.screenshot && "screenshot",
            context.consoleLogs && "console",
            context.networkRequests && "network",
          ].filter(Boolean) as string[],
        },
      };

      // Include screenshot as attachment if present
      if (context.screenshot) {
        userMessage.metadata = {
          ...userMessage.metadata,
          attachments: [
            {
              type: "image" as const,
              data: context.screenshot.data,
              mimeType: `image/${context.screenshot.format}`,
            },
          ],
        };
      }

      threadsDispatch({
        type: "ADD_MESSAGE_TO_THREAD",
        payload: {
          threadId: threadsState.activeThreadId,
          message: userMessage,
        },
      });
      chatDispatch({ type: "SET_LOADING", payload: true });
      chatDispatch({ type: "SET_ERROR", payload: null });

      // Create assistant message placeholder
      const assistantMessage: Message = {
        id: generateMessageId(),
        role: "assistant",
        content: "",
        created_at: new Date(),
      };

      threadsDispatch({
        type: "ADD_MESSAGE_TO_THREAD",
        payload: {
          threadId: threadsState.activeThreadId,
          message: assistantMessage,
        },
      });

      // Create abort controller
      abortControllerRef.current = new AbortController();

      try {
        const response = await fetch(getEndpoint(), {
          method: "POST",
          headers: buildRequestHeaders(),
          body: JSON.stringify(
            buildRequestBody([...currentMessages, userMessage], {
              includeAttachments: true,
            }),
          ),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        // Check content-type to determine if streaming or JSON
        const contentType = response.headers.get("content-type") || "";

        if (contentType.includes("application/json")) {
          // NON-STREAMING: Parse JSON response
          const jsonResponse = await response.json();
          debugLog("[YourGPT] Non-streaming JSON response:", jsonResponse);

          if (jsonResponse.error) {
            throw new Error(jsonResponse.error.message || "Unknown error");
          }

          // Update assistant message with content
          if (jsonResponse.content) {
            threadsDispatch({
              type: "UPDATE_MESSAGE_IN_THREAD",
              payload: {
                threadId: threadsState.activeThreadId,
                messageId: assistantMessage.id,
                content: jsonResponse.content,
              },
            });
          }

          // Handle tool calls if present - emit action events for UI
          if (jsonResponse.toolCalls && jsonResponse.toolCalls.length > 0) {
            for (const tc of jsonResponse.toolCalls) {
              handleStreamEvent(
                { type: "action:start", id: tc.id, name: tc.name },
                assistantMessage.id,
              );
              handleStreamEvent(
                {
                  type: "action:args",
                  id: tc.id,
                  args: JSON.stringify(tc.args),
                },
                assistantMessage.id,
              );
            }

            // If requiresAction, emit tool_calls event to trigger client-side execution
            if (jsonResponse.requiresAction) {
              const toolCallsForExecution = jsonResponse.toolCalls.map(
                (tc: {
                  id: string;
                  name: string;
                  args: Record<string, unknown>;
                }) => ({
                  id: tc.id,
                  name: tc.name,
                  args: tc.args,
                }),
              );

              // Build assistant message with tool_calls for the event
              const assistantToolMessage = {
                role: "assistant" as const,
                content: jsonResponse.content || null,
                tool_calls: jsonResponse.toolCalls.map(
                  (tc: {
                    id: string;
                    name: string;
                    args: Record<string, unknown>;
                  }) => ({
                    id: tc.id,
                    type: "function" as const,
                    function: {
                      name: tc.name,
                      arguments: JSON.stringify(tc.args),
                    },
                  }),
                ),
              };

              handleStreamEvent(
                {
                  type: "tool_calls",
                  toolCalls: toolCallsForExecution,
                  assistantMessage: assistantToolMessage,
                },
                assistantMessage.id,
              );
            }
          }

          // Handle done event
          handleStreamEvent(
            {
              type: "done",
              messages: jsonResponse.messages,
              requiresAction: jsonResponse.requiresAction,
            },
            assistantMessage.id,
          );
        } else {
          // STREAMING: Parse SSE events
          for await (const event of streamSSE(response)) {
            handleStreamEvent(event, assistantMessage.id);
          }
        }
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          chatDispatch({
            type: "SET_ERROR",
            payload:
              error instanceof Error ? error : new Error("Unknown error"),
          });
        }
      } finally {
        chatDispatch({ type: "SET_LOADING", payload: false });
        abortControllerRef.current = null;
      }
    },
    [
      currentMessages,
      currentThreadId,
      cloud,
      config,
      getEndpoint,
      systemPrompt,
      formatContextForAI,
      buildRequestBody,
      buildRequestHeaders,
      debugLog,
      threadsState.activeThreadId,
    ],
  );

  // ============================================
  // Permission Management Functions
  // ============================================

  /**
   * Get the permission level for a tool
   * Checks session permissions first, then persisted storage
   */
  const getToolPermission = useCallback(
    async (toolName: string): Promise<PermissionLevel> => {
      // Check session permissions first
      const sessionPermission = sessionPermissionsRef.current.get(toolName);
      if (sessionPermission) {
        return sessionPermission;
      }

      // Check persisted permissions
      const stored = await permissionStorageAdapter.get(toolName);
      if (stored) {
        // Update last used timestamp
        await permissionStorageAdapter.set({
          ...stored,
          lastUsedAt: Date.now(),
        });
        return stored.level;
      }

      return "ask"; // Default
    },
    [permissionStorageAdapter],
  );

  /**
   * Set the permission level for a tool
   */
  const setToolPermission = useCallback(
    async (toolName: string, level: PermissionLevel): Promise<void> => {
      if (level === "session") {
        // Session-only: store in memory
        sessionPermissionsRef.current.set(toolName, level);
      } else if (level === "ask") {
        // Remove stored permission
        await permissionStorageAdapter.remove(toolName);
        sessionPermissionsRef.current.delete(toolName);
        setStoredPermissions((prev) => {
          const next = new Map(prev);
          next.delete(toolName);
          return next;
        });
      } else {
        // Persist permission (allow_always or deny_always)
        const permission: ToolPermission = {
          toolName,
          level,
          createdAt: Date.now(),
        };
        await permissionStorageAdapter.set(permission);
        setStoredPermissions((prev) => new Map(prev).set(toolName, permission));
        sessionPermissionsRef.current.delete(toolName);
      }
    },
    [permissionStorageAdapter],
  );

  /**
   * Clear all stored permissions
   */
  const clearAllPermissions = useCallback(async () => {
    await permissionStorageAdapter.clear();
    sessionPermissionsRef.current.clear();
    setStoredPermissions(new Map());
  }, [permissionStorageAdapter]);

  // Send message (with automatic intent detection)
  /**
   * Helper: Check if a tool needs approval based on its definition, params, and stored permissions
   * Returns an object with:
   * - needsApproval: whether to show the approval UI
   * - autoAction: if defined, skip the UI and auto-approve/reject
   */
  const checkNeedsApproval = useCallback(
    async (
      tool: ToolDefinition | undefined,
      params: Record<string, unknown>,
    ): Promise<{
      needsApproval: boolean;
      autoAction?: "approve" | "reject";
    }> => {
      if (!tool?.needsApproval) {
        return { needsApproval: false };
      }

      // Check if tool has needsApproval flag
      let requiresApproval: boolean;
      if (typeof tool.needsApproval === "function") {
        requiresApproval = await tool.needsApproval(params);
      } else {
        requiresApproval = tool.needsApproval === true;
      }

      if (!requiresApproval) {
        return { needsApproval: false };
      }

      // Check stored permission
      const permission = await getToolPermission(tool.name);

      switch (permission) {
        case "allow_always":
        case "session":
          return { needsApproval: false, autoAction: "approve" };
        case "deny_always":
          return { needsApproval: false, autoAction: "reject" };
        case "ask":
        default:
          return { needsApproval: true };
      }
    },
    [getToolPermission],
  );

  /**
   * Helper: Get approval message for a tool
   */
  const getApprovalMessage = useCallback(
    (
      tool: ToolDefinition | undefined,
      params: Record<string, unknown>,
    ): string => {
      if (!tool?.approvalMessage) {
        return `Tool "${tool?.name || "unknown"}" requires your approval to execute.`;
      }

      if (typeof tool.approvalMessage === "function") {
        return tool.approvalMessage(params);
      }

      return tool.approvalMessage;
    },
    [],
  );

  /**
   * Execute pending tool calls and continue the conversation (Vercel AI SDK pattern)
   * This creates a client-side loop that executes tools and sends follow-up requests
   *
   * Supports needsApproval pattern:
   * - If a tool needs approval and isn't approved yet, execution pauses
   * - User must approve/reject via approveToolExecution/rejectToolExecution
   * - Execution continues automatically when all approvals are resolved
   */
  const executeToolsAndContinue = useCallback(
    async (previousMessages: Message[], assistantMessageId: string) => {
      debugLog("[YourGPT:Execute] executeToolsAndContinue called");
      const toolCalls = pendingToolCallsRef.current;
      const assistantMessage = pendingAssistantMessageRef.current;

      debugLog(
        "[YourGPT:Execute] pendingToolCalls:",
        toolCalls.length,
        toolCalls.map((t) => t.name),
      );
      if (toolCalls.length === 0) {
        debugLog("[YourGPT:Execute] No tool calls, returning");
        return;
      }

      // First pass: Check which tools need approval (considering stored permissions)
      const toolsNeedingApproval: string[] = [];

      for (const tc of toolCalls) {
        const tool = registeredToolsRef.current.get(tc.name);
        const approvalCheck = await checkNeedsApproval(tool, tc.args);

        // Check current approval status from state (use ref to get latest state)
        const currentState = agentLoopStateRef.current;
        const execution = currentState.toolExecutions.find(
          (e) => e.id === tc.id,
        );
        const currentApprovalStatus = execution?.approvalStatus || "none";
        debugLog(
          "[YourGPT:Execute] Tool:",
          tc.name,
          "approvalStatus:",
          currentApprovalStatus,
        );

        // Handle auto-action from stored permissions
        if (approvalCheck.autoAction && currentApprovalStatus === "none") {
          if (approvalCheck.autoAction === "approve") {
            // Auto-approve based on stored permission
            agentLoopDispatch({
              type: "UPDATE_EXECUTION",
              payload: {
                id: tc.id,
                update: {
                  approvalStatus: "approved",
                  approvalTimestamp: Date.now(),
                },
              },
            });
          } else if (approvalCheck.autoAction === "reject") {
            // Auto-reject based on stored permission
            agentLoopDispatch({
              type: "UPDATE_EXECUTION",
              payload: {
                id: tc.id,
                update: {
                  approvalStatus: "rejected",
                  approvalTimestamp: Date.now(),
                  status: "error",
                  error: "Automatically denied based on saved preference",
                },
              },
            });
          }
          // Continue to next tool (don't add to needingApproval list)
          continue;
        }

        if (approvalCheck.needsApproval && currentApprovalStatus === "none") {
          // Tool needs approval but hasn't been marked yet
          const approvalMessage = getApprovalMessage(tool, tc.args);
          agentLoopDispatch({
            type: "UPDATE_EXECUTION",
            payload: {
              id: tc.id,
              update: {
                approvalStatus: "required",
                approvalMessage,
              },
            },
          });
          toolsNeedingApproval.push(tc.id);
        } else if (
          approvalCheck.needsApproval &&
          currentApprovalStatus === "required"
        ) {
          // Still waiting for approval
          toolsNeedingApproval.push(tc.id);
        }
      }

      // If any tools are waiting for approval, pause execution
      if (toolsNeedingApproval.length > 0) {
        debugLog(
          "[YourGPT:Execute] Tools waiting for approval:",
          toolsNeedingApproval,
        );
        // Store state for resumption after approval
        pendingToolCallsRef.current = toolCalls;
        pendingAssistantMessageRef.current = assistantMessage;
        pendingMessagesForApprovalRef.current = previousMessages;
        pendingAssistantIdForApprovalRef.current = assistantMessageId;
        return; // Wait for user approval
      }

      debugLog("[YourGPT:Execute] All tools approved, proceeding to execute");

      // Execute all pending tool calls (either approved or don't need approval)
      const toolResults: Array<{ id: string; result: ToolResponse }> = [];

      for (const tc of toolCalls) {
        const tool = registeredToolsRef.current.get(tc.name);
        // Use ref to get latest state (avoid stale closure)
        const latestState = agentLoopStateRef.current;
        const execution = latestState.toolExecutions.find(
          (e) => e.id === tc.id,
        );

        // Check if this tool was rejected
        if (execution?.approvalStatus === "rejected") {
          // Tool was rejected - return rejection message to AI
          const result: ToolResponse = {
            success: false,
            error: execution.error || "User rejected this action",
          };
          toolResults.push({ id: tc.id, result });
          continue;
        }

        // Update status to executing
        agentLoopDispatch({
          type: "UPDATE_EXECUTION",
          payload: {
            id: tc.id,
            update: { status: "executing" },
          },
        });

        let result: ToolResponse;

        if (tool?.handler) {
          try {
            debugLog(
              "[YourGPT:Execute] Calling handler for:",
              tc.name,
              "args:",
              tc.args,
            );
            result = await tool.handler(tc.args);
            debugLog(
              "[YourGPT:Execute] Handler returned for:",
              tc.name,
              "success:",
              result?.success,
            );
            agentLoopDispatch({
              type: "UPDATE_EXECUTION",
              payload: {
                id: tc.id,
                update: { status: "completed", result },
              },
            });
          } catch (error) {
            result = {
              success: false,
              error:
                error instanceof Error
                  ? error.message
                  : "Tool execution failed",
            };
            agentLoopDispatch({
              type: "UPDATE_EXECUTION",
              payload: {
                id: tc.id,
                update: { status: "error", error: result.error },
              },
            });
          }
        } else {
          result = {
            success: false,
            error: `Tool "${tc.name}" not found on client`,
          };
          agentLoopDispatch({
            type: "UPDATE_EXECUTION",
            payload: {
              id: tc.id,
              update: { status: "error", error: result.error },
            },
          });
        }

        toolResults.push({ id: tc.id, result });
      }

      // Clear pending tool calls (will be repopulated if server sends more)
      pendingToolCallsRef.current = [];
      pendingAssistantMessageRef.current = null;

      // Check for tool results that should be added as user messages (like screenshots)
      // These will be added to both chat UI and sent to server for AI vision
      const screenshotAttachments: MessageAttachment[] = [];

      // Process tool results - extract attachments and simplify tool results
      for (let i = 0; i < toolResults.length; i++) {
        const { result } = toolResults[i];
        const extResult = result as ToolResponse & {
          addAsUserMessage?: boolean;
          userMessageContent?: string;
          data?: { attachment?: MessageAttachment };
        };

        if (extResult.addAsUserMessage && extResult.data?.attachment) {
          // Collect attachment for user message
          screenshotAttachments.push(extResult.data.attachment);

          // Replace tool result with simple message (don't send base64 as tool result)
          toolResults[i].result = {
            success: true,
            message:
              "Screenshot captured successfully. The image is shared in the conversation.",
          };
        }
      }

      // Create user message with screenshots (for both UI and server)
      let screenshotUserMessage: Message | null = null;

      // Create screenshot user message if we have screenshot attachments
      // NOTE: We dispatch it to thread state AFTER tool results (see below)
      // to maintain correct message order: assistant -> tool_result -> user_screenshot
      if (screenshotAttachments.length > 0) {
        screenshotUserMessage = createMessage({
          role: "user",
          content: "Here's my screen:",
          metadata: { attachments: screenshotAttachments },
        });
        debugLog(
          "[YourGPT] Created screenshot user message (will add after tool results):",
          screenshotUserMessage.id,
        );
      }

      // CRITICAL FIX: ALWAYS create a NEW assistant message for EACH follow-up response.
      // This prevents tool_calls from different responses being merged into the same message.
      // Previously, we only created a new message for screenshot flows, causing:
      // - Multiple tool_calls to overwrite each other on the same message
      // - Message history corruption when sequential tools are called
      // NOTE: The original assistant message (with tool_calls) stays in the thread
      // for API history. OpenAI requires it to be followed by tool result messages.
      const responseMessageId = generateMessageId();
      const newAssistantMessage: Message = {
        id: responseMessageId,
        role: "assistant",
        content: "",
        created_at: new Date(),
      };
      if (currentThreadId) {
        threadsDispatch({
          type: "ADD_MESSAGE_TO_THREAD",
          payload: {
            threadId: currentThreadId,
            message: newAssistantMessage,
          },
        });
      }
      debugLog(
        "[YourGPT] Created new assistant message for follow-up response:",
        responseMessageId,
      );

      // Wait for React to commit the state before streaming response
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Build messages with tool results for next request
      // Include: previous messages (excluding the streaming assistant message) + assistant message with tool_calls + tool result messages
      // We exclude the last assistant message from previousMessages because it was added during streaming
      // and doesn't have tool_calls. The proper assistant message (with tool_calls) comes from the server.
      const messagesWithResults: Array<Record<string, unknown>> = [
        ...previousMessages
          .filter((m, i) => {
            // Exclude the last message if it's an assistant message (it will be replaced by assistantMessage with tool_calls)
            if (i === previousMessages.length - 1 && m.role === "assistant") {
              return false;
            }
            return true;
          })
          .map((m) => {
            // Preserve the full message structure including tool_calls, tool_call_id, and attachments
            const msg: Record<string, unknown> = {
              role: m.role,
              content: m.content,
            };
            // Preserve tool_calls - already in OpenAI format
            if (m.tool_calls && m.tool_calls.length > 0) {
              msg.tool_calls = m.tool_calls.map((tc) => {
                // Handle both ToolCall (function.arguments) and ToolCallInfo (args)
                const tcArgs =
                  tc.function?.arguments ||
                  (tc as unknown as { args: Record<string, unknown> }).args ||
                  {};
                const tcName =
                  tc.function?.name || (tc as unknown as { name: string }).name;
                return {
                  id: tc.id,
                  type: "function",
                  function: {
                    name: tcName,
                    arguments:
                      typeof tcArgs === "string"
                        ? tcArgs
                        : JSON.stringify(tcArgs),
                  },
                };
              });
            }
            // Also check for snake_case tool_calls (from raw messages)
            const extendedMsg = m as unknown as Record<string, unknown>;
            if (extendedMsg.tool_calls && !msg.tool_calls) {
              msg.tool_calls = extendedMsg.tool_calls;
            }
            // Preserve tool_call_id if present (for tool messages)
            if (extendedMsg.tool_call_id) {
              msg.tool_call_id = extendedMsg.tool_call_id;
            }
            // Preserve attachments if present (for vision/image messages)
            if (m.metadata?.attachments && m.metadata.attachments.length > 0) {
              msg.attachments = m.metadata.attachments;
            }
            return msg;
          }),
      ];

      // Add assistant message with tool_calls (from server)
      if (assistantMessage) {
        messagesWithResults.push(
          assistantMessage as unknown as Record<string, unknown>,
        );
      }

      // Add tool result messages (OpenAI format)
      // Also persist them to threadsState so subsequent messages include them
      for (const { id, result } of toolResults) {
        const toolResultMessage = {
          role: "tool" as const,
          tool_call_id: id,
          content: JSON.stringify(result),
        };
        messagesWithResults.push(toolResultMessage);

        // Persist tool result message to threads state
        if (currentThreadId) {
          const toolMsg: Message = {
            id: generateMessageId(),
            role: "tool",
            content: JSON.stringify(result),
            tool_call_id: id, // Direct assignment - Message type supports this field
            created_at: new Date(),
          };
          threadsDispatch({
            type: "ADD_MESSAGE_TO_THREAD",
            payload: {
              threadId: currentThreadId,
              message: toolMsg,
            },
          });
        }
      }

      // Add screenshot user message with image (for AI vision)
      // This comes AFTER tool results so AI sees the image as part of the conversation
      if (screenshotUserMessage) {
        messagesWithResults.push({
          role: "user",
          content: screenshotUserMessage.content,
          // Attachments will be converted to provider-specific format by the adapter
          attachments: screenshotUserMessage.metadata?.attachments,
        });

        // Now persist screenshot user message to thread state (AFTER tool results)
        // This ensures correct message order in thread history
        if (currentThreadId) {
          threadsDispatch({
            type: "ADD_MESSAGE_TO_THREAD",
            payload: {
              threadId: currentThreadId,
              message: screenshotUserMessage,
            },
          });
          debugLog(
            "[YourGPT] Added screenshot user message to thread (after tool results):",
            screenshotUserMessage.id,
          );
        }
      }

      // Send follow-up request to server
      // Set processing state to show "Continuing..." loader
      agentLoopDispatch({ type: "SET_PROCESSING", payload: true });

      try {
        const response = await fetch(getEndpoint(), {
          method: "POST",
          headers: buildRequestHeaders(),
          body: JSON.stringify({
            messages: messagesWithResults,
            threadId: currentThreadId,
            botId: cloud?.botId,
            config: config,
            systemPrompt: buildSystemPromptWithContexts(),
            actions: Array.from(actionsRef.current.values()).map((a) => ({
              name: a.name,
              description: a.description,
              parameters: a.parameters,
            })),
            // Only send client-side tools (server-side tools are handled by runtime)
            tools: Array.from(registeredToolsRef.current.values())
              .filter((t) => t.available !== false && t.location !== "server")
              .map((t) => ({
                name: t.name,
                description: t.description,
                inputSchema: t.inputSchema,
              })),
            // Pass streaming flag (default: true)
            streaming: streaming ?? true,
          }),
          signal: abortControllerRef.current?.signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        // Process the response using the ref
        // Use responseMessageId (which is either the new message after screenshot, or original)
        const streamHandler = handleStreamEventRef.current;
        if (streamHandler) {
          // Check content-type to determine if streaming or JSON
          const contentType = response.headers.get("content-type") || "";

          if (contentType.includes("application/json")) {
            // NON-STREAMING: Parse JSON response
            agentLoopDispatch({ type: "SET_PROCESSING", payload: false });
            const jsonResponse = await response.json();
            debugLog(
              "[YourGPT] Non-streaming JSON response (continue):",
              jsonResponse,
            );

            if (jsonResponse.error) {
              throw new Error(jsonResponse.error.message || "Unknown error");
            }

            // Update assistant message with content
            if (jsonResponse.content) {
              threadsDispatch({
                type: "UPDATE_MESSAGE_IN_THREAD",
                payload: {
                  threadId: threadsState.activeThreadId,
                  messageId: responseMessageId,
                  content: jsonResponse.content,
                },
              });
            }

            // Handle tool calls if present - emit action events for UI
            if (jsonResponse.toolCalls && jsonResponse.toolCalls.length > 0) {
              for (const tc of jsonResponse.toolCalls) {
                await streamHandler(
                  { type: "action:start", id: tc.id, name: tc.name },
                  responseMessageId,
                );
                await streamHandler(
                  {
                    type: "action:args",
                    id: tc.id,
                    args: JSON.stringify(tc.args),
                  },
                  responseMessageId,
                );
              }

              // If requiresAction, emit tool_calls event to trigger client-side execution
              if (jsonResponse.requiresAction) {
                const toolCallsForExecution = jsonResponse.toolCalls.map(
                  (tc: {
                    id: string;
                    name: string;
                    args: Record<string, unknown>;
                  }) => ({
                    id: tc.id,
                    name: tc.name,
                    args: tc.args,
                  }),
                );

                // Build assistant message with tool_calls for the event
                const assistantToolMessage = {
                  role: "assistant" as const,
                  content: jsonResponse.content || null,
                  tool_calls: jsonResponse.toolCalls.map(
                    (tc: {
                      id: string;
                      name: string;
                      args: Record<string, unknown>;
                    }) => ({
                      id: tc.id,
                      type: "function" as const,
                      function: {
                        name: tc.name,
                        arguments: JSON.stringify(tc.args),
                      },
                    }),
                  ),
                };

                await streamHandler(
                  {
                    type: "tool_calls",
                    toolCalls: toolCallsForExecution,
                    assistantMessage: assistantToolMessage,
                  },
                  responseMessageId,
                );
              }
            }

            // Handle done event
            await streamHandler(
              {
                type: "done",
                messages: jsonResponse.messages,
                requiresAction: jsonResponse.requiresAction,
              },
              responseMessageId,
            );
          } else {
            // STREAMING: Parse SSE events
            let firstEvent = true;
            for await (const event of streamSSE(response)) {
              // Clear processing state on first event (stream started)
              if (firstEvent) {
                agentLoopDispatch({ type: "SET_PROCESSING", payload: false });
                firstEvent = false;
              }
              await streamHandler(event, responseMessageId);
            }
          }
        }

        // If more tool calls were detected, continue the loop
        // We need to preserve the full message structure including tool_calls and attachments
        if (pendingToolCallsRef.current.length > 0) {
          // Build updated messages preserving the full structure
          // messagesWithResults already has the proper format with tool_calls
          const updatedMessages: Message[] = messagesWithResults.map((m) => {
            const msg: Message = {
              id: generateMessageId(),
              role: m.role as Message["role"],
              content:
                typeof m.content === "string"
                  ? m.content
                  : m.content === null
                    ? null
                    : JSON.stringify(m.content),
              created_at: new Date(),
            };
            // Preserve tool_calls if present
            if (m.tool_calls) {
              msg.tool_calls = m.tool_calls as Message["tool_calls"];
            }
            // Preserve tool_call_id if present (for tool messages)
            if (m.tool_call_id) {
              msg.tool_call_id = m.tool_call_id as string;
            }
            // Preserve attachments if present (for vision/image messages)
            if (m.attachments) {
              msg.metadata = {
                ...msg.metadata,
                attachments: m.attachments as MessageAttachment[],
              };
            }
            return msg;
          });
          await executeToolsAndContinue(updatedMessages, responseMessageId);
        }
      } catch (error) {
        // Clear processing state on error
        agentLoopDispatch({ type: "SET_PROCESSING", payload: false });
        if ((error as Error).name !== "AbortError") {
          throw error;
        }
      }
    },
    [currentThreadId, cloud, config, getEndpoint, systemPrompt, streaming],
  );

  const sendMessage = useCallback(
    async (content: string, attachments?: MessageAttachment[]) => {
      // Allow send if there's content OR attachments
      if (!content.trim() && (!attachments || attachments.length === 0)) return;

      // IMPORTANT: Save current tool executions to their respective messages BEFORE clearing
      // This ensures tool execution UI persists on historical messages
      // We map each execution to the assistant message that contains its toolCall ID
      const currentExecutions = agentLoopStateRef.current.toolExecutions;
      if (currentExecutions.length > 0 && threadsState.activeThreadId) {
        const thread = threadsState.threads.get(threadsState.activeThreadId);
        if (thread && thread.messages.length > 0) {
          // Group executions by which assistant message they belong to
          // (match execution.id with toolCalls[].id in each message)
          const executionsByMessageId = new Map<string, ToolExecution[]>();

          for (const execution of currentExecutions) {
            // Find the assistant message that has this tool call
            for (const msg of thread.messages) {
              if (msg.role === "assistant" && msg.tool_calls) {
                const hasToolCall = msg.tool_calls.some(
                  (tc) => tc.id === execution.id,
                );
                if (hasToolCall) {
                  const existing = executionsByMessageId.get(msg.id) || [];
                  existing.push(execution);
                  executionsByMessageId.set(msg.id, existing);
                  break;
                }
              }
            }
          }

          // Save executions to each respective message
          for (const [messageId, executions] of executionsByMessageId) {
            threadsDispatch({
              type: "SET_TOOL_EXECUTIONS_IN_THREAD",
              payload: {
                threadId: threadsState.activeThreadId,
                messageId,
                toolExecutions: executions,
              },
            });
          }
        }
      }

      // Clear previous tool executions and tracking ref
      agentLoopDispatch({ type: "CLEAR_EXECUTIONS" });
      addedExecutionIdsRef.current.clear();

      // Check if tools are enabled and detect intent
      if (toolsState.isEnabled && toolsConfig) {
        const intent = detectIntent(content);

        // Filter to enabled tools
        const suggestedTools = intent.suggestedTools.filter((tool) => {
          if (tool === "screenshot") return toolsConfig.screenshot;
          if (tool === "console") return toolsConfig.console;
          if (tool === "network") return toolsConfig.network;
          return false;
        });

        if (suggestedTools.length > 0) {
          const reason = generateSuggestionReason(intent);
          const approved = await requestConsent(suggestedTools, reason);

          if (approved.length > 0) {
            const context = await captureContext(approved);
            return sendMessageWithContext(content, context);
          }
        }
      }

      // Regular send without context
      const userMessage: Message = {
        id: generateMessageId(),
        role: "user",
        content: content.trim(),
        created_at: new Date(),
        metadata: attachments?.length ? { attachments } : undefined,
      };

      threadsDispatch({
        type: "ADD_MESSAGE_TO_THREAD",
        payload: {
          threadId: threadsState.activeThreadId,
          message: userMessage,
        },
      });
      chatDispatch({ type: "SET_LOADING", payload: true });
      chatDispatch({ type: "SET_ERROR", payload: null });

      const assistantMessage: Message = {
        id: generateMessageId(),
        role: "assistant",
        content: "",
        created_at: new Date(),
      };

      threadsDispatch({
        type: "ADD_MESSAGE_TO_THREAD",
        payload: {
          threadId: threadsState.activeThreadId,
          message: assistantMessage,
        },
      });
      abortControllerRef.current = new AbortController();

      try {
        const response = await fetch(getEndpoint(), {
          method: "POST",
          headers: buildRequestHeaders(),
          body: JSON.stringify(
            buildRequestBody([...currentMessages, userMessage], {
              includeAttachments: true,
            }),
          ),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        // Store current assistant message ID for tool execution
        currentAssistantMessageIdRef.current = assistantMessage.id;

        // Check content-type to determine if streaming or JSON
        const contentType = response.headers.get("content-type") || "";

        if (contentType.includes("application/json")) {
          // NON-STREAMING: Parse JSON response
          const jsonResponse = await response.json();
          debugLog("[YourGPT] Non-streaming JSON response:", jsonResponse);

          if (jsonResponse.error) {
            throw new Error(jsonResponse.error.message || "Unknown error");
          }

          // Update assistant message with content
          if (jsonResponse.content) {
            threadsDispatch({
              type: "UPDATE_MESSAGE_IN_THREAD",
              payload: {
                threadId: threadsState.activeThreadId,
                messageId: assistantMessage.id,
                content: jsonResponse.content,
              },
            });
          }

          // Handle tool calls if present - emit action events for UI
          if (jsonResponse.toolCalls && jsonResponse.toolCalls.length > 0) {
            for (const tc of jsonResponse.toolCalls) {
              handleStreamEvent(
                { type: "action:start", id: tc.id, name: tc.name },
                assistantMessage.id,
              );
              handleStreamEvent(
                {
                  type: "action:args",
                  id: tc.id,
                  args: JSON.stringify(tc.args),
                },
                assistantMessage.id,
              );
            }

            // If requiresAction, emit tool_calls event to trigger client-side execution
            if (jsonResponse.requiresAction) {
              const toolCallsForExecution = jsonResponse.toolCalls.map(
                (tc: {
                  id: string;
                  name: string;
                  args: Record<string, unknown>;
                }) => ({
                  id: tc.id,
                  name: tc.name,
                  args: tc.args,
                }),
              );

              // Build assistant message with tool_calls for the event
              const assistantToolMessage = {
                role: "assistant" as const,
                content: jsonResponse.content || null,
                tool_calls: jsonResponse.toolCalls.map(
                  (tc: {
                    id: string;
                    name: string;
                    args: Record<string, unknown>;
                  }) => ({
                    id: tc.id,
                    type: "function" as const,
                    function: {
                      name: tc.name,
                      arguments: JSON.stringify(tc.args),
                    },
                  }),
                ),
              };

              handleStreamEvent(
                {
                  type: "tool_calls",
                  toolCalls: toolCallsForExecution,
                  assistantMessage: assistantToolMessage,
                },
                assistantMessage.id,
              );
            }
          }

          // Handle done event
          handleStreamEvent(
            {
              type: "done",
              messages: jsonResponse.messages,
              requiresAction: jsonResponse.requiresAction,
            },
            assistantMessage.id,
          );
        } else {
          // STREAMING: Parse SSE events
          for await (const event of streamSSE(response)) {
            handleStreamEvent(event, assistantMessage.id);
          }
        }

        // After response ends, check if we need to execute tools (Vercel AI SDK pattern)
        if (pendingToolCallsRef.current.length > 0) {
          await executeToolsAndContinue(
            [...currentMessages, userMessage],
            assistantMessage.id,
          );
        }
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          chatDispatch({
            type: "SET_ERROR",
            payload:
              error instanceof Error ? error : new Error("Unknown error"),
          });
        }
      } finally {
        chatDispatch({ type: "SET_LOADING", payload: false });
        abortControllerRef.current = null;
        // Only clear pending state if NOT waiting for approvals
        // (tools waiting for approval need to persist in the refs)
        if (!pendingMessagesForApprovalRef.current) {
          pendingToolCallsRef.current = [];
          pendingAssistantMessageRef.current = null;
        }
        currentAssistantMessageIdRef.current = null;
      }
    },
    [
      toolsState.isEnabled,
      toolsConfig,
      requestConsent,
      captureContext,
      sendMessageWithContext,
      currentMessages,
      currentThreadId,
      cloud,
      config,
      getEndpoint,
      systemPrompt,
      buildRequestBody,
      buildRequestHeaders,
      debugLog,
      threadsState.activeThreadId,
    ],
  );

  // Handle stream events
  const handleStreamEvent = useCallback(
    async (event: StreamEvent, messageId: string) => {
      switch (event.type) {
        case "message:delta":
          threadsDispatch({
            type: "UPDATE_MESSAGE_IN_THREAD",
            payload: {
              threadId: threadsState.activeThreadId,
              messageId,
              content: event.content,
            },
          });
          break;

        case "thinking:start":
          // Thinking started - no action needed, just wait for deltas
          break;

        case "thinking:delta":
          // Accumulate thinking content
          threadsDispatch({
            type: "UPDATE_THINKING_IN_THREAD",
            payload: {
              threadId: threadsState.activeThreadId,
              messageId,
              thinking: event.content,
            },
          });
          break;

        case "thinking:end":
          // Thinking ended - no action needed
          break;

        case "source:add":
          threadsDispatch({
            type: "ADD_SOURCE_TO_THREAD",
            payload: {
              threadId: threadsState.activeThreadId,
              messageId,
              source: event.source as Source,
            },
          });
          break;

        case "action:start":
          // Track tool execution start (only if not already added)
          if (!addedExecutionIdsRef.current.has(event.id)) {
            addedExecutionIdsRef.current.add(event.id);
            agentLoopDispatch({
              type: "ADD_EXECUTION",
              payload: {
                id: event.id,
                name: event.name,
                args: {},
                status: "pending",
                timestamp: Date.now(),
                approvalStatus: "none",
              },
            });
          }
          break;

        case "action:args":
          // Update tool execution with args
          try {
            const args = JSON.parse(event.args);
            agentLoopDispatch({
              type: "UPDATE_EXECUTION",
              payload: {
                id: event.id,
                update: { args, status: "executing" },
              },
            });
          } catch {
            // Ignore parse errors
          }
          break;

        case "action:end":
          // Tool execution completed
          agentLoopDispatch({
            type: "UPDATE_EXECUTION",
            payload: {
              id: event.id,
              update: {
                status: event.error ? "error" : "completed",
                result: event.result as ToolResponse | undefined,
                error: event.error,
                duration:
                  Date.now() -
                  (agentLoopState.toolExecutions.find((e) => e.id === event.id)
                    ?.timestamp || Date.now()),
              },
            },
          });
          break;

        case "tool_calls":
          // New: Vercel AI SDK pattern - server sends tool calls for client to execute
          // Store the tool calls and assistant message for processing on "done" event
          pendingToolCallsRef.current = event.toolCalls;
          pendingAssistantMessageRef.current = event.assistantMessage;

          // Persist tool_calls on the assistant message for history preservation
          // Convert ToolCallInfo (with args) to ToolCall (with function.arguments)
          {
            const toolCallsForMessage: ToolCall[] = event.toolCalls.map(
              (tc) => ({
                id: tc.id,
                type: "function" as const,
                function: {
                  name: tc.name,
                  arguments: JSON.stringify(tc.args),
                },
              }),
            );
            threadsDispatch({
              type: "SET_TOOL_CALLS_IN_THREAD",
              payload: {
                threadId: threadsState.activeThreadId,
                messageId,
                toolCalls: toolCallsForMessage,
              },
            });
          }

          // Update existing executions with parsed args or add if not present
          // Use ref to check since React state might not have updated yet
          for (const tc of event.toolCalls) {
            if (addedExecutionIdsRef.current.has(tc.id)) {
              // Already added by action:start, just update with parsed args
              agentLoopDispatch({
                type: "UPDATE_EXECUTION",
                payload: {
                  id: tc.id,
                  update: { args: tc.args },
                },
              });
            } else {
              // Not yet added (edge case), add it now
              addedExecutionIdsRef.current.add(tc.id);
              agentLoopDispatch({
                type: "ADD_EXECUTION",
                payload: {
                  id: tc.id,
                  name: tc.name,
                  args: tc.args,
                  status: "pending",
                  timestamp: Date.now(),
                  approvalStatus: "none",
                },
              });
            }
          }
          break;

        case "loop:iteration":
          // Update loop iteration state
          agentLoopDispatch({
            type: "SET_ITERATION",
            payload: {
              iteration: event.iteration,
              maxIterations: event.maxIterations,
            },
          });
          break;

        case "loop:complete":
          // Loop completed
          if (event.maxIterationsReached) {
            agentLoopDispatch({
              type: "SET_MAX_ITERATIONS_REACHED",
              payload: true,
            });
          }
          break;

        case "error":
          chatDispatch({
            type: "SET_ERROR",
            payload: new Error(event.message),
          });
          break;

        case "done":
          // If server returned messages (from server-side tool execution),
          // replace the streaming assistant message with the proper message chain
          if (event.messages && event.messages.length > 0) {
            // Convert server messages to client Message format
            const clientMessages: Message[] = event.messages.map((m) => {
              const msg: Message = {
                id: generateMessageId(),
                role: m.role as Message["role"],
                content: m.content || null,
                created_at: new Date(),
              };
              // Keep tool_calls in OpenAI format
              if (m.tool_calls && m.tool_calls.length > 0) {
                msg.tool_calls = m.tool_calls.map((tc) => ({
                  id: tc.id,
                  type: "function" as const,
                  function: {
                    name: tc.function.name,
                    arguments: tc.function.arguments || "{}",
                  },
                }));
              }
              // Preserve tool_call_id for tool messages
              if (m.tool_call_id) {
                msg.tool_call_id = m.tool_call_id;
              }
              return msg;
            });

            // Replace the streaming message with server-returned messages
            threadsDispatch({
              type: "REPLACE_STREAMING_WITH_MESSAGES",
              payload: {
                threadId: threadsState.activeThreadId,
                streamingMessageId: messageId,
                messages: clientMessages,
              },
            });
          }
          break;
      }
    },
    [
      threadsState.activeThreadId,
      currentThreadId,
      getEndpoint,
      agentLoopState.toolExecutions,
    ],
  );

  // Store handleStreamEvent in ref for use in executeToolsAndContinue
  useEffect(() => {
    handleStreamEventRef.current = handleStreamEvent;
  }, [handleStreamEvent]);

  // Stop generation
  const stopGeneration = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  // Clear messages (clears current thread)
  const clearMessages = useCallback(() => {
    chatDispatch({ type: "CLEAR" });
    threadsDispatch({
      type: "CLEAR_THREAD",
      payload: { id: threadsState.activeThreadId },
    });
  }, [threadsState.activeThreadId]);

  // Regenerate
  const regenerate = useCallback(
    async (messageId?: string) => {
      const messages = currentMessages;
      let targetIndex = messages.length - 1;

      if (messageId) {
        targetIndex = messages.findIndex((m) => m.id === messageId);
      }

      let lastUserIndex = targetIndex;
      while (lastUserIndex >= 0 && messages[lastUserIndex].role !== "user") {
        lastUserIndex--;
      }

      if (lastUserIndex < 0) return;

      const newMessages = messages.slice(0, lastUserIndex);
      threadsDispatch({
        type: "SET_MESSAGES_IN_THREAD",
        payload: {
          threadId: threadsState.activeThreadId,
          messages: newMessages,
        },
      });

      const lastUserMessage = messages[lastUserIndex];
      if (lastUserMessage.content) {
        await sendMessage(lastUserMessage.content);
      }
    },
    [currentMessages, sendMessage, threadsState.activeThreadId],
  );

  // Set messages
  const setMessages = useCallback(
    (messages: Message[]) => {
      threadsDispatch({
        type: "SET_MESSAGES_IN_THREAD",
        payload: {
          threadId: threadsState.activeThreadId,
          messages,
        },
      });
    },
    [threadsState.activeThreadId],
  );

  // Register action
  const registerAction = useCallback((action: ActionDefinition) => {
    actionsRef.current.set(action.name, action);
    setActionsVersion((v) => v + 1);
  }, []);

  // Unregister action
  const unregisterAction = useCallback((name: string) => {
    actionsRef.current.delete(name);
    setActionsVersion((v) => v + 1);
  }, []);

  // ============================================
  // Tool Registration Functions (Agentic Loop)
  // ============================================

  // Register a tool
  const registerTool = useCallback((tool: ToolDefinition) => {
    registeredToolsRef.current.set(tool.name, tool);
    setRegisteredToolsVersion((v) => v + 1);
  }, []);

  // Unregister a tool
  const unregisterTool = useCallback((name: string) => {
    registeredToolsRef.current.delete(name);
    setRegisteredToolsVersion((v) => v + 1);
  }, []);

  // Add a tool execution record
  const addToolExecution = useCallback((execution: ToolExecution) => {
    agentLoopDispatch({ type: "ADD_EXECUTION", payload: execution });
  }, []);

  // Update a tool execution record
  const updateToolExecution = useCallback(
    (id: string, update: Partial<ToolExecution>) => {
      agentLoopDispatch({ type: "UPDATE_EXECUTION", payload: { id, update } });
    },
    [],
  );

  // Clear all tool executions
  const clearToolExecutions = useCallback(() => {
    agentLoopDispatch({ type: "CLEAR_EXECUTIONS" });
    addedExecutionIdsRef.current.clear();
  }, []);

  // ============================================
  // Tool Approval Functions (needsApproval)
  // ============================================

  /**
   * Approve a tool execution that requires approval
   * Optionally set a permission level to remember the choice
   */
  const approveToolExecution = useCallback(
    async (executionId: string, permissionLevel?: PermissionLevel) => {
      debugLog(
        "[YourGPT:Approval] approveToolExecution called:",
        executionId,
        permissionLevel,
      );
      const execution = agentLoopState.toolExecutions.find(
        (e) => e.id === executionId,
      );
      debugLog(
        "[YourGPT:Approval] Found execution:",
        execution?.name,
        execution?.approvalStatus,
      );

      // Save permission if specified
      if (execution && permissionLevel && permissionLevel !== "ask") {
        await setToolPermission(execution.name, permissionLevel);
      }

      agentLoopDispatch({
        type: "UPDATE_EXECUTION",
        payload: {
          id: executionId,
          update: {
            approvalStatus: "approved" as const,
            approvalTimestamp: Date.now(),
          },
        },
      });
      debugLog("[YourGPT:Approval] Dispatched approval update");
    },
    [agentLoopState.toolExecutions, setToolPermission],
  );

  /**
   * Reject a tool execution that requires approval
   * Optionally set a permission level to remember the choice
   */
  const rejectToolExecution = useCallback(
    async (
      executionId: string,
      reason?: string,
      permissionLevel?: PermissionLevel,
    ) => {
      const execution = agentLoopState.toolExecutions.find(
        (e) => e.id === executionId,
      );

      // Save permission if "deny_always" is specified
      if (execution && permissionLevel === "deny_always") {
        await setToolPermission(execution.name, "deny_always");
      }

      agentLoopDispatch({
        type: "UPDATE_EXECUTION",
        payload: {
          id: executionId,
          update: {
            approvalStatus: "rejected" as const,
            approvalTimestamp: Date.now(),
            status: "error" as const,
            error: reason || "User rejected this action",
          },
        },
      });
    },
    [agentLoopState.toolExecutions, setToolPermission],
  );

  // Compute pending approvals from agent loop state
  const pendingApprovals = useMemo(
    () =>
      agentLoopState.toolExecutions.filter(
        (exec) => exec.approvalStatus === "required",
      ),
    [agentLoopState.toolExecutions],
  );

  // Effect to resume tool execution when all approvals are resolved
  useEffect(() => {
    // Check if we have pending messages waiting for approval
    if (!pendingMessagesForApprovalRef.current) {
      return;
    }
    if (!pendingAssistantIdForApprovalRef.current) {
      return;
    }

    // Check if there are still pending approvals
    if (pendingApprovals.length > 0) {
      return;
    }

    // All approvals resolved - resume execution
    const messages = pendingMessagesForApprovalRef.current;
    const assistantId = pendingAssistantIdForApprovalRef.current;

    // Clear the refs
    pendingMessagesForApprovalRef.current = null;
    pendingAssistantIdForApprovalRef.current = null;

    // Resume execution
    executeToolsAndContinue(messages, assistantId);
  }, [pendingApprovals, executeToolsAndContinue]);

  // ============================================
  // Thread Management Functions
  // ============================================

  // Create a new thread
  const createThread = useCallback((title?: string): string => {
    const id = generateThreadId();
    threadsDispatch({ type: "CREATE_THREAD", payload: { id, title } });
    return id;
  }, []);

  // Switch to a different thread
  const switchThread = useCallback(
    (id: string) => {
      if (explicitThreadId) {
        throw new Error(
          "Cannot call switchThread() when threadId is provided via props.",
        );
      }
      threadsDispatch({ type: "SWITCH_THREAD", payload: { id } });
    },
    [explicitThreadId],
  );

  // Delete a thread
  const deleteThread = useCallback((id: string) => {
    threadsDispatch({ type: "DELETE_THREAD", payload: { id } });
  }, []);

  // Clear a thread's messages
  const clearThread = useCallback((id: string) => {
    threadsDispatch({ type: "CLEAR_THREAD", payload: { id } });
  }, []);

  // Update thread title
  const updateThreadTitle = useCallback((id: string, title: string) => {
    threadsDispatch({ type: "UPDATE_THREAD_TITLE", payload: { id, title } });
  }, []);

  // Set thread ID (for external control)
  const setThreadId = useCallback(
    (id: string) => {
      if (explicitThreadId) {
        throw new Error(
          "Cannot call setThreadId() when threadId is provided via props.",
        );
      }
      // If thread doesn't exist, create it
      if (!threadsState.threads.has(id)) {
        threadsDispatch({ type: "CREATE_THREAD", payload: { id } });
      } else {
        threadsDispatch({ type: "SWITCH_THREAD", payload: { id } });
      }
    },
    [explicitThreadId, threadsState.threads],
  );

  // Get thread data by ID
  const getThreadData = useCallback(
    (id: string) => {
      return threadsState.threads.get(id);
    },
    [threadsState.threads],
  );

  // Get list of threads (metadata only)
  const threadsList = useMemo((): Thread[] => {
    return Array.from(threadsState.threads.values())
      .map(({ id, title, createdAt, updatedAt }) => ({
        id,
        title,
        createdAt,
        updatedAt,
      }))
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }, [threadsState.threads]);

  // Threads context value
  const threadsContextValue = useMemo<ThreadsContextValue>(
    () => ({
      threadId: threadsState.activeThreadId,
      setThreadId,
      threads: threadsList,
      getThreadData,
      createThread,
      deleteThread,
      clearThread,
      updateThreadTitle,
      persistenceEnabled: persistence?.enabled || false,
    }),
    [
      threadsState.activeThreadId,
      setThreadId,
      threadsList,
      getThreadData,
      createThread,
      deleteThread,
      clearThread,
      updateThreadTitle,
      persistence?.enabled,
    ],
  );

  // Combined chat state (UI state + derived message data from threads)
  const combinedChatState = useMemo(
    () => ({
      messages: currentMessages,
      isLoading: chatState.isLoading,
      error: chatState.error,
      threadId: currentThreadId,
      sources: currentSources,
    }),
    [
      currentMessages,
      chatState.isLoading,
      chatState.error,
      currentThreadId,
      currentSources,
    ],
  );

  // Context value
  const contextValue = useMemo<YourGPTContextValue>(
    () => ({
      config: fullConfig,
      toolsConfig: toolsConfig || null,
      chat: combinedChatState,
      tools: toolsState,
      agentLoop: agentLoopState,
      actions: {
        sendMessage,
        sendMessageWithContext,
        stopGeneration,
        clearMessages,
        regenerate,
        setMessages,
        processAttachment,
      },
      toolsActions: {
        requestConsent: (tools, reason) => {
          requestConsent(tools, reason);
        },
        respondToConsent,
        captureContext,
        clearConsent,
      },
      registeredActions: Array.from(actionsRef.current.values()),
      registerAction,
      unregisterAction,
      // Agentic loop tool registration
      registeredTools: Array.from(registeredToolsRef.current.values()),
      registerTool,
      unregisterTool,
      addToolExecution,
      updateToolExecution,
      clearToolExecutions,
      // Tool approval handlers
      approveToolExecution,
      rejectToolExecution,
      pendingApprovals,
      // Permission management
      storedPermissions: Array.from(storedPermissions.values()),
      permissionsLoaded,
      getToolPermission,
      setToolPermission,
      clearAllPermissions,
      addContext,
      removeContext,
      contextTree,
      isPremium,
      isCloudStorageAvailable,
    }),
    [
      fullConfig,
      toolsConfig,
      combinedChatState,
      toolsState,
      agentLoopState,
      sendMessage,
      sendMessageWithContext,
      stopGeneration,
      clearMessages,
      regenerate,
      setMessages,
      requestConsent,
      respondToConsent,
      captureContext,
      clearConsent,
      registerAction,
      unregisterAction,
      actionsVersion,
      registerTool,
      unregisterTool,
      registeredToolsVersion,
      addToolExecution,
      updateToolExecution,
      clearToolExecutions,
      approveToolExecution,
      rejectToolExecution,
      pendingApprovals,
      storedPermissions,
      permissionsLoaded,
      getToolPermission,
      setToolPermission,
      clearAllPermissions,
      addContext,
      removeContext,
      contextTree,
      isPremium,
      isCloudStorageAvailable,
      processAttachment,
    ],
  );

  // Notify on messages change
  useEffect(() => {
    onMessagesChange?.(currentMessages);
  }, [currentMessages, onMessagesChange]);

  return (
    <ThreadsContext.Provider value={threadsContextValue}>
      <YourGPTContext.Provider value={contextValue}>
        {children}
      </YourGPTContext.Provider>
    </ThreadsContext.Provider>
  );
}
