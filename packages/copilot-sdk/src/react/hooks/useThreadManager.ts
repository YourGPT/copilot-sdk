/**
 * useThreadManager - React hook for thread management
 *
 * Provides thread CRUD operations with localStorage persistence by default.
 * Uses useSyncExternalStore for optimal React integration.
 */

import React, {
  useSyncExternalStore,
  useMemo,
  useCallback,
  useEffect,
} from "react";
import type { Thread, ThreadData, Message } from "../../core/types";
import type { LoadStatus } from "../../thread/interfaces";
import type {
  ThreadStorageAdapter,
  AsyncThreadStorageAdapter,
} from "../../thread/adapters";
import {
  ReactThreadManager,
  createReactThreadManager,
  type ReactThreadManagerConfig,
} from "../internal/ReactThreadManager";
import type {
  ThreadManagerCallbacks,
  CreateThreadOptions,
  UpdateThreadOptions,
} from "../../thread/ThreadManager";

/**
 * Configuration for useThreadManager hook
 */
export interface UseThreadManagerConfig extends ReactThreadManagerConfig {
  /**
   * Storage adapter for persistence
   * @default localStorage adapter
   */
  adapter?: ThreadStorageAdapter | AsyncThreadStorageAdapter;

  /**
   * Debounce delay for auto-save (ms)
   * @default 1000
   */
  saveDebounce?: number;

  /**
   * Whether to auto-load threads on mount
   * @default true
   */
  autoLoad?: boolean;

  /**
   * Whether to auto-restore the last active thread on load
   * Requires adapter to support getLastActiveThreadId/setLastActiveThreadId
   * @default true
   */
  autoRestoreLastThread?: boolean;

  /**
   * Callbacks for thread events
   */
  callbacks?: ThreadManagerCallbacks;
}

/**
 * Return type for useThreadManager hook
 */
export interface UseThreadManagerReturn {
  // ============================================
  // State
  // ============================================

  /** All threads (metadata only) */
  threads: Thread[];

  /** Currently loaded thread (with messages) */
  currentThread: ThreadData | null;

  /** Currently selected thread ID */
  currentThreadId: string | null;

  /** Whether threads are currently loading */
  isLoading: boolean;

  /** Current load status */
  loadStatus: LoadStatus;

  /** Current error */
  error: Error | undefined;

  // ============================================
  // Actions
  // ============================================

  /**
   * Create a new thread
   */
  createThread: (options?: CreateThreadOptions) => Promise<ThreadData>;

  /**
   * Switch to a different thread
   */
  switchThread: (id: string) => Promise<ThreadData | null>;

  /**
   * Update the current thread
   */
  updateCurrentThread: (updates: UpdateThreadOptions) => Promise<void>;

  /**
   * Delete a thread
   */
  deleteThread: (id: string) => Promise<void>;

  /**
   * Clear the current thread selection
   */
  clearCurrentThread: () => void;

  /**
   * Refresh threads from storage
   */
  refreshThreads: () => Promise<void>;

  /**
   * Save changes immediately (bypass debounce)
   */
  saveNow: () => Promise<void>;

  /**
   * Clear all threads
   */
  clearAllThreads: () => Promise<void>;

  /**
   * Whether there are pending changes waiting to be saved
   */
  hasPendingChanges: boolean;

  // ============================================
  // Utilities
  // ============================================

  /**
   * Get messages for the current thread (convenience getter)
   */
  messages: Message[];

  /**
   * Update messages for the current thread (convenience setter)
   */
  setMessages: (messages: Message[]) => Promise<void>;
}

// Singleton manager for when no custom config is provided
let defaultManager: ReactThreadManager | null = null;

function getDefaultManager(): ReactThreadManager {
  if (!defaultManager) {
    defaultManager = createReactThreadManager();
  }
  return defaultManager;
}

// Singleton manager for internal use (with localStorage persistence)
let internalManager: ReactThreadManager | null = null;

function getInternalManager(
  config: UseThreadManagerConfig,
): ReactThreadManager {
  if (!internalManager) {
    internalManager = createReactThreadManager(
      {
        adapter: config.adapter,
        saveDebounce: config.saveDebounce,
        autoLoad: config.autoLoad,
        autoRestoreLastThread: config.autoRestoreLastThread,
      },
      config.callbacks,
    );
  }
  return internalManager;
}

/**
 * useThreadManager - React hook for thread management
 *
 * Provides thread CRUD operations with localStorage persistence by default.
 *
 * @example Basic usage (localStorage by default)
 * ```tsx
 * function App() {
 *   const {
 *     threads,
 *     currentThread,
 *     createThread,
 *     switchThread,
 *     updateCurrentThread,
 *   } = useThreadManager();
 *
 *   return (
 *     <CopilotProvider
 *       runtimeUrl="/api/chat"
 *       threadId={currentThread?.id}
 *       initialMessages={currentThread?.messages}
 *       onMessagesChange={(msgs) => updateCurrentThread({ messages: msgs })}
 *     >
 *       <ThreadPicker
 *         value={currentThread?.id}
 *         threads={threads}
 *         onSelect={switchThread}
 *         onNewThread={() => createThread()}
 *       />
 *       <Chat />
 *     </CopilotProvider>
 *   );
 * }
 * ```
 *
 * @example With custom adapter
 * ```tsx
 * const { threads } = useThreadManager({
 *   adapter: myDatabaseAdapter,
 * });
 * ```
 *
 * @example With callbacks
 * ```tsx
 * const { threads } = useThreadManager({
 *   callbacks: {
 *     onThreadCreated: (thread) => console.log('Created:', thread.id),
 *     onError: (error) => console.error('Error:', error),
 *   },
 * });
 * ```
 */
export function useThreadManager(
  config?: UseThreadManagerConfig,
): UseThreadManagerReturn {
  // Get or create manager - use singletons for stability
  const manager = useMemo(() => {
    // Use default manager if no config provided
    if (!config) {
      return getDefaultManager();
    }

    // Use internal singleton for configs without custom adapter
    // This ensures the same manager is used across all components
    if (!config.adapter) {
      return getInternalManager(config);
    }

    // For custom adapters, create a new manager
    // (This is rare and usually for server-side persistence)
    return createReactThreadManager(
      {
        adapter: config.adapter,
        saveDebounce: config.saveDebounce,
        autoLoad: config.autoLoad,
        autoRestoreLastThread: config.autoRestoreLastThread,
      },
      config.callbacks,
    );
  }, [
    config?.adapter,
    config?.saveDebounce,
    config?.autoLoad,
    config?.autoRestoreLastThread,
    // Note: callbacks are intentionally not in deps to avoid recreating manager
  ]);

  // Subscribe to state changes using useSyncExternalStore
  // Server snapshots return stable initial values to prevent hydration mismatch
  const threads = useSyncExternalStore(
    manager.subscribe,
    manager.getThreadsSnapshot,
    manager.getThreadsServerSnapshot, // SSR - always empty array
  );

  const currentThread = useSyncExternalStore(
    manager.subscribe,
    manager.getCurrentThreadSnapshot,
    manager.getCurrentThreadServerSnapshot, // SSR - always null
  );

  const currentThreadId = useSyncExternalStore(
    manager.subscribe,
    manager.getCurrentThreadIdSnapshot,
    manager.getCurrentThreadIdServerSnapshot, // SSR - always null
  );

  const loadStatus = useSyncExternalStore(
    manager.subscribe,
    manager.getLoadStatusSnapshot,
    manager.getLoadStatusServerSnapshot, // SSR - always "idle"
  );

  const error = useSyncExternalStore(
    manager.subscribe,
    manager.getErrorSnapshot,
    manager.getErrorServerSnapshot, // SSR - always undefined
  );

  const isLoading = useSyncExternalStore(
    manager.subscribe,
    manager.getIsLoadingSnapshot,
    manager.getIsLoadingServerSnapshot, // SSR - always false
  );

  // Cleanup on unmount (only for custom adapters, NOT internal singleton)
  useEffect(() => {
    return () => {
      // Don't dispose default or internal singleton managers
      // They should persist across component mounts
      if (
        config?.adapter &&
        manager !== defaultManager &&
        manager !== internalManager
      ) {
        manager.dispose();
      }
    };
  }, [manager, config]);

  // Save pending changes before page unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (manager.hasPendingChanges) {
        // Synchronous save attempt - saveNow is async but we try anyway
        manager.saveNow().catch(() => {
          // Can't do much here, but at least we tried
        });
      }
    };

    if (typeof window !== "undefined") {
      window.addEventListener("beforeunload", handleBeforeUnload);
      return () => {
        window.removeEventListener("beforeunload", handleBeforeUnload);
      };
    }
  }, [manager]);

  // ============================================
  // Memoized Actions
  // ============================================

  const createThread = useCallback(
    (options?: CreateThreadOptions) => manager.createThread(options),
    [manager],
  );

  const switchThread = useCallback(
    (id: string) => manager.switchThread(id),
    [manager],
  );

  const updateCurrentThread = useCallback(
    (updates: UpdateThreadOptions) => manager.updateCurrentThread(updates),
    [manager],
  );

  const deleteThread = useCallback(
    (id: string) => manager.deleteThread(id),
    [manager],
  );

  const clearCurrentThread = useCallback(
    () => manager.clearCurrentThread(),
    [manager],
  );

  const refreshThreads = useCallback(() => manager.loadThreads(), [manager]);

  const saveNow = useCallback(() => manager.saveNow(), [manager]);

  const clearAllThreads = useCallback(
    () => manager.clearAllThreads(),
    [manager],
  );

  // ============================================
  // Convenience Utilities
  // ============================================

  const messages = useMemo(
    () => currentThread?.messages ?? [],
    [currentThread],
  );

  const setMessages = useCallback(
    (newMessages: Message[]) => updateCurrentThread({ messages: newMessages }),
    [updateCurrentThread],
  );

  // hasPendingChanges is a direct read (not reactive, but useful for save-on-unload)
  const hasPendingChanges = manager.hasPendingChanges;

  return {
    // State
    threads,
    currentThread,
    currentThreadId,
    isLoading,
    loadStatus,
    error,

    // Actions
    createThread,
    switchThread,
    updateCurrentThread,
    deleteThread,
    clearCurrentThread,
    refreshThreads,
    saveNow,
    clearAllThreads,

    // Utilities
    messages,
    setMessages,
    hasPendingChanges,
  };
}
