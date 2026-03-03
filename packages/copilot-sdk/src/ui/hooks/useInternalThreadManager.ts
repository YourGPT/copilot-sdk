"use client";

/**
 * useInternalThreadManager - Internal hook for CopilotChat persistence
 *
 * Encapsulates all thread management logic:
 * - Message format conversion (UIMessage ↔ Message)
 * - Auto-save on streaming complete
 * - Auto-restore last thread on mount
 * - Thread switch/create handlers
 * - Refs to prevent duplicate saves
 *
 * This is an internal hook used by CopilotChat when persistence is enabled.
 */

import { useCallback, useEffect, useRef } from "react";
import { useCopilot, type UIMessage } from "../../react";
import {
  useThreadManager,
  type UseThreadManagerConfig,
} from "../../react/hooks/useThreadManager";
import type {
  ThreadStorageAdapter,
  AsyncThreadStorageAdapter,
} from "../../thread/adapters";

export interface UseInternalThreadManagerConfig {
  /** Storage adapter for persistence */
  adapter?: ThreadStorageAdapter | AsyncThreadStorageAdapter;
  /** Debounce delay for auto-save (ms) */
  saveDebounce?: number;
  /** Whether to auto-restore the last active thread */
  autoRestoreLastThread?: boolean;
  /** Callback when thread changes */
  onThreadChange?: (threadId: string | null) => void;
}

export interface UseInternalThreadManagerReturn {
  /** Thread manager state and actions */
  threadManager: ReturnType<typeof useThreadManager>;
  /** Handler for switching threads */
  handleSwitchThread: (threadId: string) => Promise<void>;
  /** Handler for creating new threads */
  handleNewThread: () => Promise<void>;
  /** Whether thread operations should be disabled (during streaming) */
  isBusy: boolean;
}

/**
 * Internal thread manager hook for CopilotChat
 *
 * This hook manages the synchronization between CopilotProvider's messages
 * and the thread storage system.
 */
export function useInternalThreadManager(
  config: UseInternalThreadManagerConfig = {},
): UseInternalThreadManagerReturn {
  const {
    adapter,
    saveDebounce = 1000,
    autoRestoreLastThread = true,
    onThreadChange,
  } = config;

  // Thread management
  const threadManagerConfig: UseThreadManagerConfig = {
    adapter,
    saveDebounce,
    autoRestoreLastThread,
  };

  const threadManager = useThreadManager(threadManagerConfig);
  const {
    currentThread,
    currentThreadId,
    createThread,
    switchThread,
    updateCurrentThread,
    clearCurrentThread,
    refreshThreads,
  } = threadManager;

  // Get copilot context for setMessages and status
  const { messages, setMessages, status, isLoading } = useCopilot();

  // Track if we're in the middle of loading messages from a thread switch
  const isLoadingMessagesRef = useRef(false);
  // Track the thread ID we're saving to (to prevent saving to wrong thread)
  const savingToThreadRef = useRef<string | null>(null);
  // Track last saved message snapshot (IDs + content hash) to prevent duplicate saves
  const lastSavedSnapshotRef = useRef<string>("");
  // Track if initial load has happened (for auto-restore)
  const hasInitializedRef = useRef(false);

  // Generate a snapshot key from messages for comparison
  // Uses ID + content hash to detect actual changes
  const getMessageSnapshot = useCallback((msgs: typeof messages) => {
    return msgs
      .map((m) => {
        // Simple hash: first 20 chars + length for uniqueness without full comparison
        const contentPreview = (m.content ?? "").slice(0, 20);
        return `${m.id}:${contentPreview}:${m.content?.length ?? 0}`;
      })
      .join("|");
  }, []);

  // Convert UIMessage to core Message format
  const convertToCore = useCallback((msgs: typeof messages) => {
    return msgs.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      created_at: m.createdAt,
      tool_calls: m.toolCalls,
      tool_call_id: m.toolCallId,
      // Preserve full metadata including citations, toolExecutions, etc.
      metadata: {
        ...m.metadata,
        attachments: m.attachments,
        thinking: m.thinking,
      },
    }));
  }, []);

  // Handle thread switch - load saved messages
  const handleSwitchThread = useCallback(
    async (threadId: string) => {
      isLoadingMessagesRef.current = true;

      const thread = await switchThread(threadId);
      if (thread?.messages) {
        const uiMessages: UIMessage[] = thread.messages.map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content ?? "",
          createdAt: m.created_at ?? new Date(),
          toolCalls: m.tool_calls,
          toolCallId: m.tool_call_id,
          attachments: m.metadata?.attachments,
        }));
        lastSavedSnapshotRef.current = getMessageSnapshot(uiMessages);
        savingToThreadRef.current = threadId;
        setMessages(uiMessages);
      } else {
        lastSavedSnapshotRef.current = "";
        savingToThreadRef.current = threadId;
        setMessages([]);
      }

      // Notify thread change
      onThreadChange?.(threadId);

      // Reset loading flag after React processes the state update
      requestAnimationFrame(() => {
        isLoadingMessagesRef.current = false;
      });
    },
    [switchThread, setMessages, getMessageSnapshot, onThreadChange],
  );

  // Handle new thread - just clear messages, thread is created lazily on first message
  const handleNewThread = useCallback(async () => {
    isLoadingMessagesRef.current = true;

    // Don't create thread yet - it will be created automatically when first message is sent
    // This prevents empty threads from being created
    clearCurrentThread();
    lastSavedSnapshotRef.current = "";
    savingToThreadRef.current = null;
    setMessages([]);

    // Notify thread change (null = new unsaved thread)
    onThreadChange?.(null);

    requestAnimationFrame(() => {
      isLoadingMessagesRef.current = false;
    });
  }, [clearCurrentThread, setMessages, onThreadChange]);

  // Auto-restore: load messages when thread is restored from storage
  useEffect(() => {
    // Skip if no adapter (persistence not enabled)
    if (!adapter) {
      return;
    }

    // Skip if already initialized or no thread restored yet
    if (hasInitializedRef.current || !currentThread) {
      return;
    }

    // Mark as initialized
    hasInitializedRef.current = true;

    // Load messages from the restored thread
    isLoadingMessagesRef.current = true;
    if (currentThread.messages && currentThread.messages.length > 0) {
      const uiMessages: UIMessage[] = currentThread.messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content ?? "",
        createdAt: m.created_at ?? new Date(),
        toolCalls: m.tool_calls,
        toolCallId: m.tool_call_id,
        attachments: m.metadata?.attachments,
        thinking: m.metadata?.thinking as string | undefined,
        // Preserve full metadata including citations, toolExecutions, etc.
        metadata: m.metadata,
      }));
      lastSavedSnapshotRef.current = getMessageSnapshot(uiMessages);
      savingToThreadRef.current = currentThread.id;
      setMessages(uiMessages);
    } else {
      lastSavedSnapshotRef.current = "";
      savingToThreadRef.current = currentThread.id;
    }

    // Notify thread change
    onThreadChange?.(currentThread.id);

    requestAnimationFrame(() => {
      isLoadingMessagesRef.current = false;
    });
  }, [adapter, currentThread, setMessages, getMessageSnapshot, onThreadChange]);

  // Sync messages to storage when streaming completes
  useEffect(() => {
    // Skip if no adapter (persistence not enabled) - don't sync/create threads
    if (!adapter) {
      return;
    }

    // Skip if we're loading messages from a thread switch
    if (isLoadingMessagesRef.current) {
      return;
    }

    // Skip if still streaming - wait for completion
    if (status === "streaming" || status === "submitted") {
      return;
    }

    // Skip if no messages
    if (messages.length === 0) {
      return;
    }

    // Check if messages actually changed
    const currentSnapshot = getMessageSnapshot(messages);
    if (currentSnapshot === lastSavedSnapshotRef.current) {
      return;
    }

    const coreMessages = convertToCore(messages);

    // If no thread exists, create one with these messages
    if (!currentThreadId && !savingToThreadRef.current) {
      // Set ref immediately to prevent race condition with rapid messages
      savingToThreadRef.current = "creating";
      createThread({ messages: coreMessages }).then((thread) => {
        lastSavedSnapshotRef.current = currentSnapshot;
        savingToThreadRef.current = thread.id;
        onThreadChange?.(thread.id);
      });
      return;
    }

    // Make sure we're saving to the correct thread
    if (
      savingToThreadRef.current &&
      savingToThreadRef.current !== currentThreadId
    ) {
      return;
    }

    // Update existing thread
    updateCurrentThread({ messages: coreMessages });
    lastSavedSnapshotRef.current = currentSnapshot;
  }, [
    adapter,
    messages,
    currentThreadId,
    status,
    updateCurrentThread,
    createThread,
    refreshThreads,
    getMessageSnapshot,
    convertToCore,
    onThreadChange,
  ]);

  // Check if chat is busy (disable thread switching during streaming)
  const isBusy = isLoading || status === "streaming" || status === "submitted";

  return {
    threadManager,
    handleSwitchThread,
    handleNewThread,
    isBusy,
  };
}
