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
  ContextUsage,
} from "../../core";

import type { MCPServerConfig } from "../../mcp/types";
import type { Resolvable } from "../../core/utils/resolvable";
import { createLogger } from "../../core/utils/logger";

import type {
  UIMessage,
  ToolExecution,
  StreamChunk,
  YourGPTConfig,
} from "../../chat";

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
import type { MessageHistoryConfig } from "../message-history/types";
import { SkillProvider } from "../skill/SkillProvider";
import type { SkillDefinition } from "../../skill-system/types";

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

      // Apply summary-buffer windowing to history, keeping UIMessage format.
      //
      // WHY NOT buildSummaryBufferContext here:
      // buildSummaryBufferContext returns LLMMessage[] (snake_case: tool_calls,
      // tool_call_id). The optimizer's transformMessages() only reads camelCase
      // (toolCalls, toolCallId), so mixing LLMMessage into this array causes it
      // to silently strip tool call data → "Missing call_id" API errors.
      // The optimizer must own the UIMessage → RequestMessage conversion.
      const cs = compactionStateRef.current;
      const recentBuffer = cfg.recentBuffer ?? 10;

      // Identify compaction marker messages (UI-only, already represented by rollingSummary)
      const isCompactionMsg = (m: UIMessage) =>
        m.metadata?.["type"] === "compaction-marker";

      const windowedHistory: UIMessage[] = [];

      // 1. Working memory (always first)
      if (cs.workingMemory.length > 0) {
        windowedHistory.push({
          id: "working-memory",
          role: "system",
          content: `[Working memory — always active]\n${cs.workingMemory.join("\n")}`,
          createdAt: new Date(),
        } as UIMessage);
      }

      // 2. Rolling summary replaces older history
      if (cs.rollingSummary) {
        windowedHistory.push({
          id: "rolling-summary",
          role: "system",
          content: `[Previous conversation summary]\n${cs.rollingSummary}`,
          createdAt: new Date(),
        } as UIMessage);
      }

      // 3. Non-compaction system messages (e.g. injected context)
      const systemMsgs = historyMessages.filter(
        (m) => m.role === "system" && !isCompactionMsg(m),
      );
      windowedHistory.push(...systemMsgs);

      // 4. Recent conversation messages (windowed to recentBuffer)
      const conversationMsgs = historyMessages.filter(
        (m) => m.role !== "system",
      );
      const recentStart = Math.max(0, conversationMsgs.length - recentBuffer);
      windowedHistory.push(...conversationMsgs.slice(recentStart));

      return [...windowedHistory, ...currentTurn];
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
  /**
   * Called once before the first message on a new thread to create a session.
   * The returned value IS the thread ID — session and thread are the same identity.
   * Only called when `threadId` is not set. If `threadId` is provided, this is skipped.
   * Takes priority over `yourgptConfig`.
   *
   * @example
   * ```tsx
   * onCreateSession={async () => {
   *   const res = await fetch('/api/sessions', { method: 'POST', headers })
   *   return (await res.json()).id
   * }}
   * ```
   */
  onCreateSession?: () => string | Promise<string>;
  /**
   * Called when a new session/thread ID is assigned (new thread created).
   * Use this to persist the session ID in your storage layer.
   */
  onThreadChange?: (id: string) => void;
  /**
   * YourGPT config — enables automatic session creation with zero boilerplate.
   * The SDK calls YourGPT's createSession API before the first message and
   * uses the returned session_uid as `threadId`.
   *
   * @example
   * ```tsx
   * yourgptConfig={{ apiKey: "your-api-key", widgetUid: widgetUid }}
   * ```
   */
  yourgptConfig?: YourGPTConfig;
  /** Initial messages to populate the chat */
  initialMessages?: UIMessage[];
  /** Callback when messages change */
  onMessagesChange?: (messages: Message[]) => void;
  /** Callback when an error occurs */
  onError?: (error: Error) => void;
  /**
   * Custom error message extractor for non-2xx API responses.
   * Receives the HTTP status and parsed response body.
   * Return a string to override the default message, or null to use the default.
   *
   * @example
   * parseError: (status, body) => body?.errors?.[0]?.message ?? body?.detail ?? null
   */
  parseError?: (status: number, body: unknown) => string | null | undefined;
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
  /**
   * Convenience prop to pre-register inline skills.
   * Wraps children with <SkillProvider skills={skills}>.
   * Only inline skills (source.type === "inline") are supported client-side.
   */
  skills?: SkillDefinition[];
  /**
   * Allow multiple threads to stream concurrently. When enabled, switching away
   * from a thread that is still generating does NOT cancel its request — it
   * continues in the background. You can also start a new send on a different
   * thread while another is still streaming.
   *
   * When enabled:
   *   - `useCopilot().messages/status/error` always reflect the ACTIVE thread.
   *   - A new `busyThreadIds` set reflects every thread currently streaming.
   *   - The provider maintains one `ReactChatWithTools` instance per thread.
   *
   * When `onCreateSession` is provided, it may be called concurrently for
   * different threads — ensure each call produces a distinct session id.
   *
   * @default false
   */
  concurrentThreads?: boolean;
}

// ============================================
// MessageMetaStore — reactive per-message key-value store
// ============================================

export type StreamChunkWithMessageId = StreamChunk & { messageId?: string };
export type StreamEventHandler = (chunk: StreamChunkWithMessageId) => void;

/**
 * Reactive store for custom per-message metadata.
 * Powers useMessageMeta() — consumers write any shape they want,
 * all components reading the same messageId react automatically.
 */
export class MessageMetaStore {
  private store = new Map<string, Record<string, unknown>>();
  private listeners = new Set<() => void>();
  // Stable empty object — returned for unknown messageIds so useSyncExternalStore
  // sees the same reference and doesn't trigger infinite re-renders.
  private static readonly EMPTY: Record<string, unknown> = {};

  subscribe = (cb: () => void): (() => void) => {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  };

  getSnapshot = (): Map<string, Record<string, unknown>> => this.store;

  getMeta = (messageId: string): Record<string, unknown> =>
    this.store.get(messageId) ?? MessageMetaStore.EMPTY;

  setMeta = (messageId: string, meta: Record<string, unknown>): void => {
    this.store.set(messageId, meta);
    this.listeners.forEach((cb) => cb());
  };

  updateMeta = (
    messageId: string,
    updater: (prev: Record<string, unknown>) => Record<string, unknown>,
  ): void => {
    const prev = this.store.get(messageId) ?? {};
    this.store.set(messageId, updater(prev));
    this.listeners.forEach((cb) => cb());
  };

  clear = (): void => {
    this.store.clear();
    this.listeners.forEach((cb) => cb());
  };
}

export interface CopilotContextValue {
  // Chat state
  messages: UIMessage[];
  status: "ready" | "submitted" | "streaming" | "error";
  error: Error | null;
  isLoading: boolean;
  /** True from when stop() is called until the next sendMessage(). */
  wasStopped: boolean;

  // Chat actions
  sendMessage: (
    content: string,
    attachments?: MessageAttachment[],
  ) => Promise<void>;
  stop: () => void;
  clearMessages: () => void;
  setMessages: (messages: UIMessage[]) => void;
  regenerate: (messageId?: string) => Promise<void>;

  // Branching actions
  switchBranch: (messageId: string) => void;
  getBranchInfo: (
    messageId: string,
  ) => import("../../chat/branching").BranchInfo | null;
  editMessage: (messageId: string, newContent: string) => Promise<void>;
  hasBranches: boolean;
  /** Get ALL messages across all branches (for persistence). Visible path only when no branches. */
  getAllMessages: () => UIMessage[];

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

  // Context stats (reactive — updates when useAIContext adds/removes context)
  /** Total characters currently registered in the AI context tree (system prompt contribution). */
  contextChars: number;
  /**
   * Live prompt context usage snapshot — updated on every message send.
   * Includes token counts and percentages for systemPrompt, history, toolResults, tools buckets.
   * null until the first message is sent.
   */
  contextUsage: ContextUsage | null;

  // Skills (for SkillProvider — sends inline skills to server on every request)
  setInlineSkills: (
    skills: Array<{
      name: string;
      description: string;
      content: string;
      strategy?: string;
    }>,
  ) => void;

  // Agent loop iteration (increments each time the AI calls a tool batch; resets on sendMessage)
  agentIteration: number;

  // Config
  threadId?: string;
  /**
   * Switch to a different thread (or start a new one).
   * Pass the session/thread ID from persistence to reuse it (no new session call),
   * or null to start a fresh thread (new session created on first sendMessage).
   *
   * When `concurrentThreads` is enabled on the provider, `opts.hydrateMessages`
   * is applied when the target instance is being created fresh (not yet
   * streaming). It is ignored if the instance already exists (which would
   * mean a stream is in-flight or completed) to avoid clobbering state.
   */
  setActiveThread: (
    id: string | null,
    opts?: { hydrateMessages?: UIMessage[]; hydrateActiveLeafId?: string },
  ) => void;
  /**
   * Force a new session to be created on the next sendMessage.
   * Call when the current session has expired or credits are exhausted.
   */
  renewSession: () => void;
  /** Current session creation status */
  sessionStatus: "idle" | "creating" | "ready" | "error";
  /**
   * Runtime URL configuration.
   * Can be a static string or getter function (matches what was passed to provider).
   */
  runtimeUrl: Resolvable<string>;
  toolsConfig?: ToolsConfig;

  // ── Headless primitives ──────────────────────────────────────────────────

  /**
   * Subscribe to raw stream chunks as they arrive.
   * Returns an unsubscribe function. Use useCopilotEvent() for the hook API.
   *
   * @example
   * ```ts
   * const unsub = subscribeToStreamEvents((chunk) => {
   *   if (chunk.type === 'thinking:delta') { ... }
   * })
   * return unsub // cleanup
   * ```
   */
  subscribeToStreamEvents: (handler: StreamEventHandler) => () => void;

  /**
   * Reactive per-message metadata store.
   * Use useMessageMeta(messageId) for the hook API.
   */
  messageMeta: MessageMetaStore;

  /**
   * Whether concurrent-thread streaming is enabled (via the `concurrentThreads`
   * prop on CopilotProvider). When false, the provider uses a single chat
   * instance and inactive threads cannot stream. When true, each thread has
   * its own instance and streams in the background on switch.
   */
  concurrentThreads: boolean;

  /**
   * The set of thread IDs that currently have an in-flight request
   * (status "submitted" or "streaming"). Always empty when `concurrentThreads`
   * is false. UI can use this to render per-thread busy indicators in a
   * thread picker.
   */
  busyThreadIds: ReadonlySet<string>;

  /**
   * Dispose the chat instance backing a given thread ID and remove it from
   * the registry. Aborts its in-flight stream if any. Call this when a
   * thread is deleted so its background stream doesn't keep running.
   * No-op when `concurrentThreads` is false.
   */
  disposeThreadInstance: (threadId: string) => void;

  /**
   * Commit a locally-generated thread id to the currently-active pending
   * chat instance. Used by persistence hooks (e.g. useInternalThreadManager)
   * to make a just-started thread visible in the picker immediately, without
   * waiting for the server to assign its session id. No-op when
   * `concurrentThreads` is false or the active instance is not a pending slot.
   */
  assignLocalThreadId: (localId: string) => void;
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

export function CopilotProvider(props: CopilotProviderProps) {
  const {
    children,
    runtimeUrl,
    systemPrompt,
    tools: toolsConfig,
    threadId,
    onCreateSession,
    onThreadChange,
    yourgptConfig,
    initialMessages,
    onMessagesChange,
    onError,
    parseError,
    streaming,
    headers,
    body,
    debug = false,
    maxIterations,
    maxIterationsMessage,
    mcpServers,
    optimization,
    messageHistory,
    skills,
    concurrentThreads = false,
  } = props;
  const isThreadIdControlled = Object.prototype.hasOwnProperty.call(
    props,
    "threadId",
  );

  // ── Headless primitives ──────────────────────────────────────────────────

  // Stream event listeners — Set of handlers subscribed via useCopilotEvent()
  const streamListenersRef = useRef<Set<StreamEventHandler>>(new Set());

  const subscribeToStreamEvents = useCallback(
    (handler: StreamEventHandler): (() => void) => {
      streamListenersRef.current.add(handler);
      return () => streamListenersRef.current.delete(handler);
    },
    [],
  );

  // Per-message metadata store — stable instance, never re-created
  const messageMetaStoreRef = useRef<MessageMetaStore>(new MessageMetaStore());

  // Debug logger — scoped to "provider" namespace
  const debugLog = useCallback(
    (action: string, data?: unknown) => {
      createLogger("provider", () => debug ?? false)(action, data);
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
  const [sessionStatus, setSessionStatus] = useState<
    "idle" | "creating" | "ready" | "error"
  >(() => (threadId ? "ready" : "idle"));
  const [agentIteration, setAgentIteration] = useState(0);
  // Track the ACTUAL thread/session ID assigned by the chat instance.
  // This is different from the `threadId` prop — it updates reactively when
  // onCreateSession fires and a new session ID is assigned.
  const [actualThreadId, setActualThreadId] = useState<string | undefined>(
    threadId,
  );
  const lastControlledThreadIdRef = useRef<{
    controlled: boolean;
    value: string | undefined;
  }>({
    controlled: isThreadIdControlled,
    value: threadId,
  });

  // ============================================
  // ChatWithTools Instance Registry
  // ============================================
  //
  // In single-thread mode (`concurrentThreads === false`, default), there is
  // exactly one ReactChatWithTools instance stored in the registry under the
  // key SINGLE_INSTANCE_KEY. Behavior matches pre-registry semantics.
  //
  // In multi-thread mode (`concurrentThreads === true`), one instance per
  // thread id is stored in the registry. A "__pending_<n>__" slot is used for
  // new-thread sends whose server id hasn't been assigned yet; that slot is
  // re-keyed to the real id when onThreadChange fires on that instance.

  const SINGLE_INSTANCE_KEY = "__single__";

  // chatRef.current always points to the active instance; other instances (if
  // any) are stored in instancesRef. Using `chatRef.current` everywhere below
  // keeps the existing code path unchanged for the single-thread case.
  const chatRef = useRef<ReactChatWithTools | null>(null);
  const instancesRef = useRef<Map<string, ReactChatWithTools>>(new Map());
  const activeInstanceKeyRef = useRef<string>(SINGLE_INSTANCE_KEY);
  const pendingCounterRef = useRef(0);

  // Provider-level shared state that every instance inherits at creation.
  // useTool / setInlineSkills / setContext fan out to every live instance so
  // the registry is consistent across threads. New instances created later
  // (e.g. when a user starts a new thread) are seeded from these refs.
  const sharedToolsRef = useRef<
    Map<string, { tool: ToolDefinition; refCount: number }>
  >(new Map());
  const sharedSkillsRef = useRef<
    Array<{
      name: string;
      description: string;
      content: string;
      strategy?: string;
    }>
  >([]);
  const sharedSystemContextRef = useRef<string>("");

  // React subscribers (from useSyncExternalStore) registered on a stable
  // wrapper. Each created instance pipes its `subscribe` callbacks through
  // this set so swapping the active instance doesn't tear React state.
  const subscribersRef = useRef<Set<() => void>>(new Set());
  const stableSubscribe = useMemo(
    () => (cb: () => void) => {
      subscribersRef.current.add(cb);
      return () => {
        subscribersRef.current.delete(cb);
      };
    },
    [],
  );

  // Reactive set of thread ids with an in-flight request. Empty in
  // single-thread mode.
  const [busyThreadIds, setBusyThreadIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );

  const recomputeBusyThreadIds = useCallback(() => {
    if (!concurrentThreads) return;
    const next = new Set<string>();
    for (const [key, inst] of instancesRef.current) {
      // Skip internal / pre-session keys — they aren't real thread ids.
      if (key === SINGLE_INSTANCE_KEY) continue;
      if (key.startsWith("__pending_")) continue;
      const s = inst.status;
      if (s === "streaming" || s === "submitted") next.add(key);
    }
    setBusyThreadIds((prev) => {
      if (prev.size === next.size) {
        let same = true;
        for (const id of next) {
          if (!prev.has(id)) {
            same = false;
            break;
          }
        }
        if (same) return prev;
      }
      return next;
    });
  }, [concurrentThreads]);

  const notifyStateChange = useCallback(() => {
    for (const cb of subscribersRef.current) cb();
    recomputeBusyThreadIds();
  }, [recomputeBusyThreadIds]);

  // Keep latest prop/callback values in refs so the imperative factory doesn't
  // need a useCallback dep list the size of the universe.
  const configRef = useRef({
    runtimeUrl,
    systemPrompt,
    threadId,
    onCreateSession,
    yourgptConfig,
    initialMessages,
    streaming,
    headers,
    body,
    parseError,
    debug,
    maxIterations,
    maxIterationsMessage,
    optimization,
  });
  configRef.current = {
    runtimeUrl,
    systemPrompt,
    threadId,
    onCreateSession,
    yourgptConfig,
    initialMessages,
    streaming,
    headers,
    body,
    parseError,
    debug,
    maxIterations,
    maxIterationsMessage,
    optimization,
  };
  const callbacksRef = useRef({ onError, onThreadChange });
  callbacksRef.current = { onError, onThreadChange };

  // Handle a thread-id assignment from a chat instance (fires after
  // onCreateSession resolves or when the server emits thread:created).
  // Resolves the current key by instance identity (captured string keys in
  // closures would go stale after a re-key), re-keys pending / internal
  // slots to the real thread id, and only propagates to top-level state if
  // the firing instance is the active one.
  //
  // Multi-thread-only guard: when `concurrentThreads` is enabled AND the
  // current key is already a non-internal (committed) id, SKIP the re-key.
  // This preserves the stable UI thread id that was assigned locally via
  // assignLocalThreadId before streaming started — the server's id is kept
  // internally on chat.config.threadId for backend communication, but the
  // registry / picker keeps the local id so the row stays stable without
  // flicker and so deletion / switching keeps working.
  //
  // In single-thread mode this guard does NOT apply: every server id change
  // (including the one after renewSession()) re-keys the registry and
  // updates actualThreadId / the user's onThreadChange prop, matching
  // pre-multi-thread behavior.
  const handleInstanceThreadAssigned = useCallback(
    (inst: ReactChatWithTools, newId: string) => {
      let oldKey: string | undefined;
      for (const [k, v] of instancesRef.current) {
        if (v === inst) {
          oldKey = k;
          break;
        }
      }
      if (oldKey === undefined) return;

      const isInternalKey =
        oldKey === SINGLE_INSTANCE_KEY || oldKey.startsWith("__pending_");
      // In single-thread mode, always re-key and propagate. In multi-thread
      // mode, only re-key when we're leaving an internal slot; a committed
      // id is preserved for UI stability.
      const shouldRekey = !concurrentThreads || isInternalKey;

      if (shouldRekey && oldKey !== newId && !instancesRef.current.has(newId)) {
        instancesRef.current.delete(oldKey);
        instancesRef.current.set(newId, inst);
        if (activeInstanceKeyRef.current === oldKey) {
          activeInstanceKeyRef.current = newId;
        }
        if (inst === chatRef.current) {
          debugLog("Thread/session ID assigned:", newId);
          setActualThreadId(newId);
          callbacksRef.current.onThreadChange?.(newId);
        }
      }
      // Multi-thread + non-internal oldKey: do nothing UI-facing.
      // chat.config.threadId was already updated by AbstractChat to `newId`
      // so future requests hit the server's session; we just don't propagate
      // to React state or the registry key.
      recomputeBusyThreadIds();
    },
    [concurrentThreads, debugLog, recomputeBusyThreadIds],
  );

  // Create a new chat instance and register it under `key`. Wires all
  // callbacks so per-instance events are gated on the active-instance check.
  const createInstance = useCallback(
    (key: string, opts?: { initialMessages?: UIMessage[] }) => {
      const cfg = configRef.current;
      // For keys that look like real thread ids (not pending, not single),
      // pass the key as the initial threadId so no new session is created.
      // For pending / single keys, fall through to the controlled threadId prop.
      const initialThreadId =
        key === SINGLE_INSTANCE_KEY || key.startsWith("__pending_")
          ? cfg.threadId
          : key;
      // Surrogate holder so the getThreadId closure can read back the
      // instance's registry key without searching the whole map every tool
      // call. It's updated in-place whenever the key changes (pending →
      // local id, or during handleInstanceThreadAssigned).
      const inst = new ReactChatWithTools(
        {
          runtimeUrl: cfg.runtimeUrl,
          systemPrompt: cfg.systemPrompt,
          threadId: initialThreadId,
          onCreateSession: cfg.onCreateSession,
          yourgptConfig: cfg.yourgptConfig,
          initialMessages: opts?.initialMessages ?? cfg.initialMessages,
          streaming: cfg.streaming,
          headers: cfg.headers,
          body: cfg.body,
          parseError: cfg.parseError,
          debug: cfg.debug,
          maxIterations: cfg.maxIterations,
          maxIterationsMessage: cfg.maxIterationsMessage,
          optimization: cfg.optimization,
          // Expose the registry key (usually the UI thread id after
          // assignLocalThreadId runs) to tool handlers, NOT chat.config.threadId.
          // For extensions that key per-thread state on context.threadId (e.g.
          // browser-tab pinning), this guarantees a stable id — even while the
          // backend session id is still being resolved. Internal keys
          // (__single__, __pending_*) return undefined so handlers can treat
          // them as "not yet committed".
          getThreadId: () => {
            for (const [k, v] of instancesRef.current) {
              if (v === inst) {
                if (k === SINGLE_INSTANCE_KEY || k.startsWith("__pending_")) {
                  return undefined;
                }
                return k;
              }
            }
            return undefined;
          },
        },
        {
          onToolExecutionsChange: (executions) => {
            debugLog("Tool executions changed:", executions.length);
            // Gate by instance identity — the captured `key` string would go
            // stale after handleInstanceThreadAssigned re-keys the instance.
            if (inst === chatRef.current) {
              setToolExecutions(executions);
              setAgentIteration(inst.iteration ?? 0);
            }
          },
          onApprovalRequired: (execution) => {
            debugLog("Tool approval required:", execution.name);
          },
          onContextUsageChange: (usage) => {
            if (inst === chatRef.current) {
              setContextUsage(usage);
            }
          },
          onError: (error) => {
            if (error && inst === chatRef.current) {
              callbacksRef.current.onError?.(error);
            }
          },
          onThreadChange: (id) => {
            handleInstanceThreadAssigned(inst, id);
          },
          onSessionStatusChange: (status) => {
            debugLog("Session status:", status);
            if (inst === chatRef.current) {
              setSessionStatus(status);
            }
          },
          onStreamChunk: (chunk) => {
            if (streamListenersRef.current.size > 0) {
              for (const handler of streamListenersRef.current) {
                handler(chunk);
              }
            }
          },
        },
      );
      // Seed the new instance with provider-level shared state (tools,
      // skills, system-level context). Without this, instances created later
      // — e.g. when the user starts a new thread — start out with no tools,
      // so the LLM can't use them even though useTool hooks were set up.
      for (const { tool } of sharedToolsRef.current.values()) {
        inst.registerTool(tool);
      }
      if (sharedSkillsRef.current.length > 0) {
        inst.setInlineSkills(sharedSkillsRef.current);
      }
      if (sharedSystemContextRef.current) {
        inst.setContext(sharedSystemContextRef.current);
      }

      // Wire the instance's state changes into our unified subscriber set so
      // every useSyncExternalStore call on stableSubscribe reacts.
      inst.subscribe(notifyStateChange);
      instancesRef.current.set(key, inst);
      return inst;
    },
    [debugLog, handleInstanceThreadAssigned, notifyStateChange],
  );

  // Initialize the first instance on first render. If disposed (React
  // StrictMode), revive every instance and re-wire our notification
  // subscriber: ReactChatState.dispose() clears subscribers, and revive() is
  // a no-op for them. Without re-subscribing here, state changes from a
  // streaming instance never reach React, so the UI stays frozen until
  // something else (like clicking Stop) forces a render.
  if (chatRef.current !== null && chatRef.current.disposed) {
    for (const inst of instancesRef.current.values()) {
      inst.revive();
      inst.subscribe(notifyStateChange);
    }
    debugLog("Revived disposed instance(s) (React StrictMode)");
  }

  if (chatRef.current === null) {
    const initialKey =
      concurrentThreads && threadId ? threadId : SINGLE_INSTANCE_KEY;
    activeInstanceKeyRef.current = initialKey;
    chatRef.current = createInstance(initialKey);
  }

  // Swap the active instance to a different thread. In single-thread mode,
  // falls back to legacy setActiveThread behavior on the single instance.
  // In multi-thread mode, finds or creates the instance for `key` (or
  // optionally hydrates it with the given messages if fresh) and swaps the
  // active pointer; the in-flight stream of the previously-active instance
  // keeps running in the background.
  const switchActiveInstance = useCallback(
    (
      key: string | null,
      opts?: { hydrateMessages?: UIMessage[]; hydrateActiveLeafId?: string },
    ) => {
      if (!concurrentThreads) {
        chatRef.current?.setActiveThread(key);
        return;
      }
      // Resolve the target key. Null means "start a new thread" — reuse the
      // current fresh-empty slot if we're already sitting on one, otherwise
      // mint a new pending slot. A specific string is used as-is.
      let targetKey: string;
      if (key == null) {
        const currentKey = activeInstanceKeyRef.current;
        const currentInst = instancesRef.current.get(currentKey);
        const isCurrentFreshEmpty =
          currentInst !== undefined &&
          currentInst.messages.length === 0 &&
          (currentKey === SINGLE_INSTANCE_KEY ||
            currentKey.startsWith("__pending_"));
        if (isCurrentFreshEmpty) {
          return;
        }
        targetKey = `__pending_${++pendingCounterRef.current}__`;
      } else {
        targetKey = key;
      }

      let inst = instancesRef.current.get(targetKey);
      const wasFresh = !inst;
      if (!inst) {
        // If the currently-active instance is an empty internal-keyed slot
        // (__single__ or __pending_<n>__), promote it to the target id
        // instead of creating a new instance. This happens during auto-restore
        // when the app loads with a persisted thread: the initial active
        // instance at SINGLE_INSTANCE_KEY gets promoted to the restored id
        // so sends use the correct session and busyThreadIds tracks it.
        const currentKey = activeInstanceKeyRef.current;
        const currentInst = instancesRef.current.get(currentKey);
        const currentIsPromotableSlot =
          currentInst !== undefined &&
          currentInst.messages.length === 0 &&
          (currentKey === SINGLE_INSTANCE_KEY ||
            currentKey.startsWith("__pending_"));
        if (currentIsPromotableSlot) {
          instancesRef.current.delete(currentKey);
          instancesRef.current.set(targetKey, currentInst!);
          currentInst!.setActiveThread(targetKey);
          inst = currentInst;
          if (opts?.hydrateMessages) {
            inst!.setMessages(opts.hydrateMessages);
          }
          if (opts?.hydrateActiveLeafId) {
            inst!.switchBranch(opts.hydrateActiveLeafId);
          }
        } else {
          inst = createInstance(targetKey, {
            initialMessages: opts?.hydrateMessages,
          });
          if (opts?.hydrateActiveLeafId) {
            inst.switchBranch(opts.hydrateActiveLeafId);
          }
        }
      } else if (
        wasFresh &&
        opts?.hydrateMessages &&
        inst.messages.length === 0
      ) {
        inst.setMessages(opts.hydrateMessages);
        if (opts.hydrateActiveLeafId)
          inst.switchBranch(opts.hydrateActiveLeafId);
      }
      if (activeInstanceKeyRef.current === targetKey) return;
      activeInstanceKeyRef.current = targetKey;
      chatRef.current = inst!;
      if (
        targetKey === SINGLE_INSTANCE_KEY ||
        targetKey.startsWith("__pending_")
      ) {
        setActualThreadId(undefined);
      } else {
        setActualThreadId(targetKey);
      }
      setSessionStatus(inst!.getSessionStatus());
      setToolExecutions(inst!.toolExecutions);
      setAgentIteration(inst!.iteration);
      notifyStateChange();
      debugLog("Active instance switched", { key: targetKey });
    },
    [concurrentThreads, createInstance, debugLog, notifyStateChange],
  );

  // ============================================
  // System Prompt Reactivity
  // ============================================

  // Watch for systemPrompt prop changes and update every instance. In
  // single-thread mode this is just the one instance; in multi-thread mode
  // we fan out so background and newly-created instances stay consistent.
  useEffect(() => {
    if (systemPrompt === undefined) return;
    for (const inst of instancesRef.current.values()) {
      inst.setSystemPrompt(systemPrompt);
    }
    debugLog("System prompt updated from prop");
  }, [systemPrompt, debugLog]);

  // ============================================
  // Headers & Body Reactivity
  // ============================================

  useEffect(() => {
    if (headers === undefined) return;
    for (const inst of instancesRef.current.values()) {
      inst.setHeaders(headers);
    }
    debugLog("Headers config updated from prop");
  }, [headers, debugLog]);

  useEffect(() => {
    if (body === undefined) return;
    for (const inst of instancesRef.current.values()) {
      inst.setBody(body);
    }
    debugLog("Body config updated from prop");
  }, [body, debugLog]);

  useEffect(() => {
    if (runtimeUrl === undefined) return;
    for (const inst of instancesRef.current.values()) {
      inst.setUrl(runtimeUrl);
    }
    debugLog("URL config updated from prop");
  }, [runtimeUrl, debugLog]);

  // Keep the chat instance aligned with controlled threadId prop changes.
  useEffect(() => {
    const prev = lastControlledThreadIdRef.current;
    const controlChanged = prev.controlled !== isThreadIdControlled;
    const valueChanged = prev.value !== threadId;

    if (!controlChanged && !valueChanged) {
      return;
    }

    lastControlledThreadIdRef.current = {
      controlled: isThreadIdControlled,
      value: threadId,
    };

    if (!isThreadIdControlled) {
      return;
    }

    if (concurrentThreads) {
      switchActiveInstance(threadId ?? null);
    } else {
      chatRef.current?.setActiveThread(threadId ?? null);
      setActualThreadId(threadId);
      setSessionStatus(threadId ? "ready" : "idle");
    }
    debugLog("Thread/session synced from prop", { threadId });
  }, [
    debugLog,
    isThreadIdControlled,
    threadId,
    concurrentThreads,
    switchActiveInstance,
  ]);

  // Stable snapshot callbacks for useSyncExternalStore
  // getServerSnapshot must return a cached/stable value to avoid infinite loops
  const EMPTY_MESSAGES = useRef<UIMessage[]>([]);
  const getMessagesSnapshot = useCallback(() => chatRef.current!.messages, []);
  const getServerMessagesSnapshot = useCallback(
    () => EMPTY_MESSAGES.current,
    [],
  );
  const getStatusSnapshot = useCallback(() => chatRef.current!.status, []);
  const getErrorSnapshot = useCallback(() => chatRef.current!.error, []);

  // Subscribe to chat state with useSyncExternalStore via the stable wrapper
  // so that swapping the active instance in multi-thread mode doesn't tear
  // subscriptions.
  const messages = useSyncExternalStore(
    stableSubscribe,
    getMessagesSnapshot,
    getServerMessagesSnapshot,
  );

  const status = useSyncExternalStore(
    stableSubscribe,
    getStatusSnapshot,
    () => "ready" as const,
  );

  const errorFromChat = useSyncExternalStore(
    stableSubscribe,
    getErrorSnapshot,
    () => undefined,
  );
  const error = errorFromChat ?? null;

  const isLoading = status === "streaming" || status === "submitted";

  // ============================================
  // Actions
  // ============================================

  const setActiveThread = useCallback(
    (
      id: string | null,
      opts?: { hydrateMessages?: UIMessage[]; hydrateActiveLeafId?: string },
    ) => {
      if (concurrentThreads) {
        switchActiveInstance(id, opts);
      } else {
        chatRef.current?.setActiveThread(id);
        // Sync React state: known ID → expose it; null (new thread) → clear until onThreadChange fires
        setActualThreadId(id ?? undefined);
      }
    },
    [concurrentThreads, switchActiveInstance],
  );

  const disposeThreadInstance = useCallback(
    (id: string) => {
      if (!concurrentThreads) return;
      const inst = instancesRef.current.get(id);
      if (!inst) return;
      inst.dispose();
      instancesRef.current.delete(id);
      if (activeInstanceKeyRef.current === id) {
        // Deleted the active instance — switchActiveInstance(null) will mint
        // a fresh pending slot and swap to it.
        switchActiveInstance(null);
      } else {
        recomputeBusyThreadIds();
      }
    },
    [concurrentThreads, switchActiveInstance, recomputeBusyThreadIds],
  );

  // Re-key the active pending instance to a caller-supplied local thread id
  // so the thread becomes visible in the picker WHILE it's still streaming,
  // without waiting for the server to emit `thread:created`.
  //
  // Why this exists: some backends only include the real session id in the
  // final `done` chunk. Without this, a newly-started thread would not show
  // up in the picker until the stream ended. With this, useInternalThreadManager
  // mints a local id as soon as the first send starts, creates the thread
  // in the manager, and calls assignLocalThreadId to bind the pending instance
  // to that id. busyThreadIds then includes the local id and the picker shows
  // a live row with a spinner.
  //
  // Side note on the backend session id: we do NOT call chat.setActiveThread
  // here, so chat.config.threadId stays undefined and the server creates its
  // own session as usual. When the server emits its session id (via
  // thread:created or done), AbstractChat updates chat.config.threadId
  // internally so subsequent sends on this thread reuse that server session.
  // The registry key and the picker thread id stay the local id for stability.
  const assignLocalThreadId = useCallback(
    (localId: string) => {
      if (!concurrentThreads) return;
      if (!localId) return;
      const currentKey = activeInstanceKeyRef.current;
      if (currentKey === localId) return;
      const currentInst = instancesRef.current.get(currentKey);
      if (!currentInst) return;
      const isInternalSlot =
        currentKey === SINGLE_INSTANCE_KEY ||
        currentKey.startsWith("__pending_");
      if (!isInternalSlot) return;
      // Someone else already owns this key — bail rather than clobber it.
      if (instancesRef.current.has(localId)) return;

      instancesRef.current.delete(currentKey);
      instancesRef.current.set(localId, currentInst);
      activeInstanceKeyRef.current = localId;
      if (currentInst === chatRef.current) {
        setActualThreadId(localId);
        callbacksRef.current.onThreadChange?.(localId);
      }
      recomputeBusyThreadIds();
      debugLog("Assigned local thread id", { localId });
    },
    [concurrentThreads, debugLog, recomputeBusyThreadIds],
  );

  const renewSession = useCallback(() => {
    chatRef.current?.renewSession();
    setActualThreadId(undefined);
    setSessionStatus("idle");
  }, []);

  const registerTool = useCallback((tool: ToolDefinition) => {
    // Track at the provider level so new instances created later (e.g. on
    // thread switch / new thread) can inherit the same tool set. Ref-count
    // so StrictMode's register → unregister → register cycle is a no-op.
    const existing = sharedToolsRef.current.get(tool.name);
    if (existing) {
      existing.tool = tool;
      existing.refCount++;
    } else {
      sharedToolsRef.current.set(tool.name, { tool, refCount: 1 });
    }
    // Fan out to every live instance — the active one AND any background
    // instances — so every thread can use the tool.
    for (const inst of instancesRef.current.values()) {
      inst.registerTool(tool);
    }
  }, []);

  const unregisterTool = useCallback((name: string) => {
    const entry = sharedToolsRef.current.get(name);
    if (!entry) return;
    entry.refCount = Math.max(0, entry.refCount - 1);
    for (const inst of instancesRef.current.values()) {
      inst.unregisterTool(name);
    }
    if (entry.refCount === 0) {
      sharedToolsRef.current.delete(name);
    }
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

  const registeredTools = useMemo(
    () => chatRef.current?.tools ?? [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [toolExecutions], // re-derive when tool executions change (tools change alongside)
  );
  const pendingApprovals = useMemo(
    () => toolExecutions.filter((e) => e.approvalStatus === "required"),
    [toolExecutions],
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
  const [contextChars, setContextChars] = useState(0);
  const [contextUsage, setContextUsage] = useState<ContextUsage | null>(null);

  // Note: addContext / removeContext update ONLY the active instance.
  //
  // AI context (useAIContext) is often derived from the user's current state
  // — e.g. "current_page" reflects whichever browser tab the user is on. If
  // we fanned out to every instance, switching browser tabs would overwrite
  // the context of a thread that was mid-task, which derails the AI (it may
  // abandon the work it was doing because the "current page" suddenly
  // changed out from under it).
  //
  // Background threads keep the context snapshot that was in place when
  // their instance was created (via createInstance's seeding from
  // sharedSystemContextRef). New instances created later still get the
  // latest context at creation time. sharedSystemContextRef tracks the
  // latest so new instances are seeded correctly.
  const addContext = useCallback(
    (context: string, parentId?: string): string => {
      const id = `ctx-${++contextIdCounter.current}`;
      contextTreeRef.current = addNode(
        contextTreeRef.current,
        { id, value: context, parentId },
        parentId,
      );
      const contextString = printTree(contextTreeRef.current);
      sharedSystemContextRef.current = contextString;
      chatRef.current?.setContext(contextString);
      setContextChars(contextString.length);
      debugLog("Context added:", id);
      return id;
    },
    [debugLog],
  );

  const removeContext = useCallback(
    (id: string): void => {
      contextTreeRef.current = removeNode(contextTreeRef.current, id);
      const contextString = printTree(contextTreeRef.current);
      sharedSystemContextRef.current = contextString;
      chatRef.current?.setContext(contextString);
      setContextChars(contextString.length);
      debugLog("Context removed:", id);
    },
    [debugLog],
  );

  // ============================================
  // System Prompt
  // ============================================

  const setSystemPrompt = useCallback(
    (prompt: string): void => {
      for (const inst of instancesRef.current.values()) {
        inst.setSystemPrompt(prompt);
      }
      debugLog("System prompt updated via function");
    },
    [debugLog],
  );

  const setInlineSkills = useCallback(
    (
      skills: Array<{
        name: string;
        description: string;
        content: string;
        strategy?: string;
      }>,
    ): void => {
      sharedSkillsRef.current = skills;
      for (const inst of instancesRef.current.values()) {
        inst.setInlineSkills(skills);
      }
      debugLog("Inline skills updated", { count: skills.length });
    },
    [debugLog],
  );

  // ============================================
  // Chat Actions
  // ============================================

  const sendMessage = useCallback(
    async (content: string, attachments?: MessageAttachment[]) => {
      debugLog("Sending message:", content);
      setAgentIteration(0); // reset before each new user message
      setWasStopped(false); // reset for new run
      await chatRef.current?.sendMessage(content, attachments);
    },
    [debugLog],
  );

  const [wasStopped, setWasStopped] = useState(false);

  const stop = useCallback(() => {
    setWasStopped(true);
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

  const switchBranch = useCallback((messageId: string) => {
    chatRef.current?.switchBranch(messageId);
  }, []);

  const getBranchInfo = useCallback(
    (messageId: string) => chatRef.current?.getBranchInfo(messageId) ?? null,
    [],
  );

  const editMessage = useCallback(
    async (messageId: string, newContent: string) => {
      await chatRef.current?.sendMessage(newContent, undefined, {
        editMessageId: messageId,
      });
    },
    [],
  );

  const getHasBranchesSnapshot = useCallback(
    () => chatRef.current!.hasBranches,
    [],
  );
  const hasBranches = useSyncExternalStore(
    stableSubscribe,
    getHasBranchesSnapshot,
    () => false,
  );

  const getAllMessages = useCallback(
    () => chatRef.current?.getAllMessages?.() ?? [],
    [],
  );

  // ============================================
  // Callbacks
  // ============================================

  // Notify external callbacks
  useEffect(() => {
    if (onMessagesChange && messages.length > 0) {
      // Use getAllMessages() to persist all branches, not just the visible path
      const allUIMessages = chatRef.current?.getAllMessages?.() ?? messages;
      const coreMessages: Message[] = allUIMessages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        created_at: m.createdAt,
        tool_calls: m.toolCalls,
        tool_call_id: m.toolCallId,
        parent_id: m.parentId,
        children_ids: m.childrenIds,
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

  // Cleanup — dispose every registered instance so all in-flight streams are
  // aborted on unmount (including background ones in multi-thread mode).
  useEffect(() => {
    return () => {
      for (const inst of instancesRef.current.values()) {
        inst.dispose();
      }
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
      wasStopped,

      // Chat actions
      sendMessage,
      stop,
      clearMessages,
      setMessages,
      regenerate,

      // Branching
      switchBranch,
      getBranchInfo,
      editMessage,
      hasBranches,
      getAllMessages,

      // Tool execution
      registerTool,
      unregisterTool,
      registeredTools,
      toolExecutions,
      pendingApprovals,
      approveToolExecution,
      rejectToolExecution,
      agentIteration,

      // Actions
      registerAction,
      unregisterAction,
      registeredActions,

      // AI Context
      addContext,
      removeContext,
      contextChars,
      contextUsage,

      // System Prompt
      setSystemPrompt,

      // Skills
      setInlineSkills,

      // Config
      threadId: actualThreadId,
      setActiveThread,
      renewSession,
      sessionStatus,
      runtimeUrl,
      toolsConfig,

      // Headless primitives
      subscribeToStreamEvents,
      messageMeta: messageMetaStoreRef.current,

      // Multi-thread streaming
      concurrentThreads,
      busyThreadIds,
      disposeThreadInstance,
      assignLocalThreadId,
    }),
    [
      messages,
      status,
      error,
      isLoading,
      wasStopped,
      sendMessage,
      stop,
      clearMessages,
      setMessages,
      regenerate,
      switchBranch,
      getBranchInfo,
      editMessage,
      hasBranches,
      getAllMessages,
      registerTool,
      unregisterTool,
      registeredTools,
      toolExecutions,
      pendingApprovals,
      approveToolExecution,
      rejectToolExecution,
      agentIteration,
      registerAction,
      unregisterAction,
      registeredActions,
      addContext,
      removeContext,
      contextChars,
      contextUsage,
      setSystemPrompt,
      setInlineSkills,
      actualThreadId,
      setActiveThread,
      renewSession,
      sessionStatus,
      runtimeUrl,
      toolsConfig,
      concurrentThreads,
      busyThreadIds,
      disposeThreadInstance,
      assignLocalThreadId,
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
        {skills ? (
          <SkillProvider skills={skills}>{children}</SkillProvider>
        ) : (
          children
        )}
      </CopilotContext.Provider>
    </MessageHistoryContext.Provider>
  );
}
