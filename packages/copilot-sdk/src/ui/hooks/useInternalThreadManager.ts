"use client";

/**
 * useInternalThreadManager - Internal hook for CopilotChat persistence
 *
 * Uses a reducer-based state machine with clear phases:
 *   idle → awaiting_server_id → creating → active
 *   active → switching → active
 *   active → idle (new thread)
 *
 * Handles both server-managed sessions (threadId from response) and
 * local-only threads (no server storage) with the same flow.
 */

import { useCallback, useEffect, useReducer, useRef } from "react";
import { useCopilot, type UIMessage } from "../../react";
import {
  useThreadManager,
  type UseThreadManagerConfig,
} from "../../react/hooks/useThreadManager";
import type {
  ThreadStorageAdapter,
  AsyncThreadStorageAdapter,
} from "../../thread/adapters";

// ── Config & Return types ────────────────────────────────────────────────────

export interface UseInternalThreadManagerConfig {
  adapter?: ThreadStorageAdapter | AsyncThreadStorageAdapter;
  saveDebounce?: number;
  autoRestoreLastThread?: boolean;
  onThreadChange?: (threadId: string | null) => void;
  enabled?: boolean;
}

export interface UseInternalThreadManagerReturn {
  threadManager: ReturnType<typeof useThreadManager>;
  handleSwitchThread: (threadId: string) => Promise<void>;
  handleNewThread: () => Promise<void>;
  /** Whether the currently-active thread is busy (submitted or streaming). */
  isBusy: boolean;
  /**
   * Set of thread IDs that currently have an in-flight request. Empty unless
   * `concurrentThreads` is enabled on the CopilotProvider. Use for per-thread
   * busy indicators in a thread picker.
   */
  busyThreadIds: ReadonlySet<string>;
}

// ── State machine ────────────────────────────────────────────────────────────

type Phase =
  | "idle" // No thread, waiting for first message
  | "awaiting_server_id" // First response complete, waiting for sdkThreadId
  | "creating" // Creating local thread
  | "active" // Thread active, syncing messages
  | "switching" // Switching to a different thread
  | "restoring"; // Auto-restoring last thread on mount

interface ThreadSyncState {
  phase: Phase;
  threadId: string | null; // Active local thread ID
  lastSnapshot: string; // Last saved message snapshot
  initialized: boolean; // Whether initial restore has run
}

type ThreadAction =
  | { type: "FIRST_RESPONSE_COMPLETE" }
  | { type: "SERVER_ID_RECEIVED"; threadId: string }
  | { type: "CREATE_WITH_LOCAL_ID" }
  | { type: "THREAD_CREATED"; threadId: string; snapshot: string }
  | { type: "MESSAGES_SAVED"; snapshot: string }
  | { type: "START_SWITCH" }
  | { type: "SWITCH_COMPLETE"; threadId: string; snapshot: string }
  | { type: "NEW_THREAD" }
  | { type: "RESTORE_START" }
  | { type: "RESTORE_COMPLETE"; threadId: string; snapshot: string }
  | { type: "SKIP_RESTORE" };

const INITIAL_STATE: ThreadSyncState = {
  phase: "idle",
  threadId: null,
  lastSnapshot: "",
  initialized: false,
};

function threadReducer(
  state: ThreadSyncState,
  action: ThreadAction,
): ThreadSyncState {
  switch (action.type) {
    case "FIRST_RESPONSE_COMPLETE":
      if (state.phase !== "idle") return state;
      // Mark initialized so auto-restore doesn't interfere when
      // createThread() later updates currentThread in the manager.
      return { ...state, phase: "awaiting_server_id", initialized: true };

    case "SERVER_ID_RECEIVED":
      if (state.phase !== "awaiting_server_id") return state;
      return { ...state, phase: "creating" };

    case "CREATE_WITH_LOCAL_ID":
      if (state.phase !== "awaiting_server_id") return state;
      return { ...state, phase: "creating" };

    case "THREAD_CREATED":
      return {
        ...state,
        phase: "active",
        threadId: action.threadId,
        lastSnapshot: action.snapshot,
        initialized: true,
      };

    case "MESSAGES_SAVED":
      if (state.phase !== "active") return state;
      return { ...state, lastSnapshot: action.snapshot };

    case "START_SWITCH":
      if (state.phase !== "active" && state.phase !== "idle") return state;
      return { ...state, phase: "switching" };

    case "SWITCH_COMPLETE":
      return {
        ...state,
        phase: "active",
        threadId: action.threadId,
        lastSnapshot: action.snapshot,
      };

    case "NEW_THREAD":
      return {
        ...INITIAL_STATE,
        initialized: true,
      };

    case "RESTORE_START":
      if (state.initialized) return state;
      if (state.phase === "creating" || state.phase === "awaiting_server_id")
        return state;
      return { ...state, phase: "restoring" };

    case "RESTORE_COMPLETE":
      return {
        ...state,
        phase: "active",
        threadId: action.threadId,
        lastSnapshot: action.snapshot,
        initialized: true,
      };

    case "SKIP_RESTORE":
      return { ...state, initialized: true };

    default:
      return state;
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getMessageSnapshot(msgs: UIMessage[]): string {
  return msgs
    .map((m) => {
      const preview = (m.content ?? "").slice(0, 20);
      return `${m.id}:${preview}:${m.content?.length ?? 0}`;
    })
    .join("|");
}

function convertToCore(msgs: UIMessage[]) {
  return msgs.map((m) => ({
    id: m.id,
    role: m.role,
    content: m.content,
    created_at: m.createdAt,
    tool_calls: m.toolCalls,
    tool_call_id: m.toolCallId,
    parent_id: m.parentId,
    children_ids: m.childrenIds,
    metadata: {
      ...m.metadata,
      attachments: m.attachments,
      thinking: m.thinking,
    },
  }));
}

function coreToUI(m: any): UIMessage {
  return {
    id: m.id,
    role: m.role,
    content: m.content ?? "",
    createdAt: m.created_at ?? new Date(),
    toolCalls: m.tool_calls,
    toolCallId: m.tool_call_id,
    parentId: m.parent_id,
    childrenIds: m.children_ids,
    attachments: m.metadata?.attachments,
    thinking: m.metadata?.thinking as string | undefined,
    metadata: m.metadata,
  };
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useInternalThreadManager(
  config: UseInternalThreadManagerConfig = {},
): UseInternalThreadManagerReturn {
  const {
    adapter,
    saveDebounce = 1000,
    autoRestoreLastThread = true,
    onThreadChange,
    enabled = true,
  } = config;

  const [state, dispatch] = useReducer(threadReducer, INITIAL_STATE);
  const isLoadingRef = useRef(false);

  // Thread manager (handles localStorage / server adapter)
  const threadManager = useThreadManager({
    adapter,
    saveDebounce,
    autoRestoreLastThread,
  });
  const {
    currentThread,
    currentThreadId,
    createThread,
    switchThread,
    updateCurrentThread,
    clearCurrentThread,
  } = threadManager;

  // Copilot context
  const {
    messages,
    setMessages,
    status,
    isLoading,
    getAllMessages,
    switchBranch,
    threadId: sdkThreadId,
    setActiveThread,
    concurrentThreads,
    busyThreadIds,
    assignLocalThreadId,
    sessionStatus,
  } = useCopilot();

  // ── Auto-restore on mount ──────────────────────────────────────────────

  useEffect(() => {
    if (!enabled || state.initialized || !currentThread) return;

    dispatch({ type: "RESTORE_START" });
    isLoadingRef.current = true;

    if (currentThread.messages && currentThread.messages.length > 0) {
      const uiMessages = currentThread.messages.map(coreToUI);
      const snapshot = getMessageSnapshot(uiMessages);
      if (concurrentThreads) {
        // Re-key the active instance to the restored thread id AND hydrate
        // messages. Without this, subsequent sends would create a brand new
        // session (since the instance's threadId wasn't set), and the picker
        // row for the restored thread would never appear in busyThreadIds.
        setActiveThread(currentThread.id, {
          hydrateMessages: uiMessages,
          hydrateActiveLeafId: currentThread.activeLeafId,
        });
      } else {
        setMessages(uiMessages);
        if (currentThread.activeLeafId)
          switchBranch(currentThread.activeLeafId);
      }
      onThreadChange?.(currentThread.id);
      dispatch({
        type: "RESTORE_COMPLETE",
        threadId: currentThread.id,
        snapshot,
      });
    } else {
      if (concurrentThreads) {
        setActiveThread(currentThread.id);
      }
      onThreadChange?.(currentThread.id);
      dispatch({
        type: "RESTORE_COMPLETE",
        threadId: currentThread.id,
        snapshot: "",
      });
    }

    requestAnimationFrame(() => {
      isLoadingRef.current = false;
    });
  }, [
    enabled,
    currentThread,
    state.initialized,
    setMessages,
    switchBranch,
    onThreadChange,
    concurrentThreads,
    setActiveThread,
  ]);

  // Mark initialized if no thread to restore
  useEffect(() => {
    if (!enabled) {
      dispatch({ type: "SKIP_RESTORE" });
      return;
    }
    // If autoRestore is off or no thread loaded after mount, skip
    if (!autoRestoreLastThread && !state.initialized) {
      dispatch({ type: "SKIP_RESTORE" });
    }
  }, [enabled, autoRestoreLastThread, state.initialized]);

  // ── Phase: idle → awaiting_server_id ───────────────────────────────────
  //
  // Single-thread mode: wait for the response to finish (status ready) before
  // creating the thread record, so the record captures the final messages.
  //
  // Multi-thread mode: fire as soon as the first send starts so the thread
  // becomes visible in the picker (with a spinner) mid-generation. If the
  // backend supplies its session id early — either because yourgptConfig /
  // onCreateSession resolved pre-stream, or because the server emits
  // `thread:created` at the top of the stream — we wait for that id and use
  // it as the thread id, so UI and backend stay in lockstep (preserving the
  // pre-multi-thread contract where `useCopilot().threadId` === backend
  // session id). Only when NO early id is available do we mint a local one.
  //
  // `sessionStatus === "creating"` means a session creator is in flight;
  // holding back for that keeps yourgptConfig / onCreateSession consumers on
  // their server-assigned id instead of a local uuid.
  useEffect(() => {
    if (!enabled) return;
    if (state.phase !== "idle") return;
    if (isLoadingRef.current) return;
    if (messages.length === 0) return;
    if (currentThreadId) return; // Already have a thread

    const streaming = status === "streaming" || status === "submitted";
    if (streaming && !concurrentThreads) return; // legacy: wait for ready

    // Multi-thread: if a pre-stream session creator is still running, defer
    // so we can use its id. If it already resolved (sessionStatus moved to
    // "ready") and sdkThreadId is set, proceed immediately and use the id.
    // If there's no session creator at all, sessionStatus stays "idle" and
    // we proceed without waiting.
    if (concurrentThreads && sessionStatus === "creating" && !sdkThreadId) {
      return;
    }

    dispatch({ type: "FIRST_RESPONSE_COMPLETE" });
  }, [
    enabled,
    state.phase,
    status,
    messages.length,
    currentThreadId,
    concurrentThreads,
    sdkThreadId,
    sessionStatus,
  ]);

  // ── Phase: awaiting_server_id → creating ───────────────────────────────

  useEffect(() => {
    if (state.phase !== "awaiting_server_id") return;

    if (sdkThreadId) {
      // Server provided a threadId — use it
      dispatch({ type: "SERVER_ID_RECEIVED", threadId: sdkThreadId });
    } else {
      // No server ID available — create thread with a local ID.
      dispatch({ type: "CREATE_WITH_LOCAL_ID" });
    }
  }, [state.phase, sdkThreadId]);

  // ── Phase: creating → active ───────────────────────────────────────────

  useEffect(() => {
    if (state.phase !== "creating") return;

    const allUIMessages = getAllMessages();
    const coreMessages = convertToCore(
      allUIMessages.length > 0 ? allUIMessages : messages,
    );
    const activeLeafId = messages[messages.length - 1]?.id;
    const snapshot = getMessageSnapshot(messages);

    const usingLocalId = !sdkThreadId;

    createThread({
      id: sdkThreadId ?? undefined,
      messages: coreMessages,
      activeLeafId,
    }).then((thread) => {
      // Multi-thread mode without a server-assigned id yet: bind the pending
      // chat instance to this manager-generated local id so the thread shows
      // up in busyThreadIds / the picker while it streams.
      if (concurrentThreads && usingLocalId) {
        assignLocalThreadId(thread.id);
      }
      dispatch({ type: "THREAD_CREATED", threadId: thread.id, snapshot });
      onThreadChange?.(thread.id);
    });
  }, [state.phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Phase: active — sync messages on change ────────────────────────────

  useEffect(() => {
    if (!enabled) return;
    if (state.phase !== "active") return;
    if (isLoadingRef.current) return;
    if (status === "streaming" || status === "submitted") return;
    if (messages.length === 0) return;

    const snapshot = getMessageSnapshot(messages);
    if (snapshot === state.lastSnapshot) return;

    // Verify we're saving to the right thread
    if (state.threadId && state.threadId !== currentThreadId) return;

    const allUIMessages = getAllMessages();
    const coreMessages = convertToCore(
      allUIMessages.length > 0 ? allUIMessages : messages,
    );
    const activeLeafId = messages[messages.length - 1]?.id;

    updateCurrentThread({ messages: coreMessages, activeLeafId });
    dispatch({ type: "MESSAGES_SAVED", snapshot });
  }, [
    enabled,
    state.phase,
    state.lastSnapshot,
    state.threadId,
    messages,
    status,
    currentThreadId,
    updateCurrentThread,
    getAllMessages,
  ]);

  // ── Switch thread ──────────────────────────────────────────────────────

  const handleSwitchThread = useCallback(
    async (threadId: string) => {
      dispatch({ type: "START_SWITCH" });
      isLoadingRef.current = true;

      const thread = await switchThread(threadId);
      const uiMessages = thread?.messages ? thread.messages.map(coreToUI) : [];
      const snapshot = thread?.messages ? getMessageSnapshot(uiMessages) : "";

      if (concurrentThreads) {
        // Multi-thread mode: delegate to the provider, which swaps the active
        // chat instance. The provider hydrates messages only if the target
        // instance is fresh; an existing (possibly streaming) instance is
        // left alone so its in-flight stream is preserved.
        setActiveThread(threadId, {
          hydrateMessages: uiMessages,
          hydrateActiveLeafId: thread?.activeLeafId,
        });
      } else {
        // Single-thread mode: write the loaded messages into the shared chat
        if (thread?.messages) {
          setMessages(uiMessages);
          if (thread.activeLeafId) switchBranch(thread.activeLeafId);
        } else {
          setMessages([]);
        }
      }
      onThreadChange?.(threadId);
      dispatch({ type: "SWITCH_COMPLETE", threadId, snapshot });

      requestAnimationFrame(() => {
        isLoadingRef.current = false;
      });
    },
    [
      switchThread,
      setMessages,
      switchBranch,
      onThreadChange,
      concurrentThreads,
      setActiveThread,
    ],
  );

  // ── New thread ─────────────────────────────────────────────────────────

  const handleNewThread = useCallback(async () => {
    isLoadingRef.current = true;

    clearCurrentThread();
    // In multi-thread mode, skip setMessages([]) — it would clobber the
    // currently-active instance's messages (possibly mid-stream). The
    // provider's switchActiveInstance mints a fresh, empty pending slot.
    if (!concurrentThreads) {
      setMessages([]);
    }
    setActiveThread(null); // Clear SDK session so next message creates a new one
    onThreadChange?.(null);
    dispatch({ type: "NEW_THREAD" });

    requestAnimationFrame(() => {
      isLoadingRef.current = false;
    });
  }, [
    clearCurrentThread,
    setMessages,
    setActiveThread,
    onThreadChange,
    concurrentThreads,
  ]);

  // ── Return ─────────────────────────────────────────────────────────────

  // In concurrent-threads mode, the user must be able to switch away from a
  // streaming thread — per-thread busy state is surfaced via `busyThreadIds`
  // instead. In single-thread mode, streaming locks picker & new-chat button.
  const isBusy =
    !concurrentThreads &&
    (isLoading || status === "streaming" || status === "submitted");

  return {
    threadManager,
    handleSwitchThread,
    handleNewThread,
    isBusy,
    busyThreadIds,
  };
}
