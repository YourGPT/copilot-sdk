/**
 * ThreadManager - Framework-agnostic Thread Management
 *
 * Manages thread state and persistence with pluggable storage adapters.
 * Similar pattern to AbstractChat for framework agnosticism.
 */

import type { Thread, ThreadData, Message } from "../core/types";
import type { ThreadManagerState, LoadStatus } from "./interfaces";
import { SimpleThreadManagerState } from "./interfaces";
import type {
  ThreadStorageAdapter,
  AsyncThreadStorageAdapter,
} from "./adapters";
import { localStorageAdapter } from "./adapters";

/**
 * Generate a unique thread ID
 */
function generateThreadId(): string {
  return `thread_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Generate a thread title from message content
 */
function generateThreadTitle(content: string): string {
  const trimmed = content.trim();
  if (trimmed.length <= 50) return trimmed;
  return trimmed.substring(0, 47) + "...";
}

/**
 * Generate a preview from message content
 */
function generatePreview(content: string): string {
  const trimmed = content.trim();
  if (trimmed.length <= 100) return trimmed;
  return trimmed.substring(0, 97) + "...";
}

/**
 * Configuration for ThreadManager
 */
export interface ThreadManagerConfig {
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
   * Whether to auto-load threads on initialization
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
   * Custom state implementation (for framework adapters)
   * @default SimpleThreadManagerState
   */
  state?: ThreadManagerState;
}

/**
 * Callbacks for ThreadManager events
 */
export interface ThreadManagerCallbacks {
  /** Called when threads are loaded */
  onThreadsLoaded?: (threads: Thread[]) => void;
  /** Called when a thread is created */
  onThreadCreated?: (thread: ThreadData) => void;
  /** Called when a thread is switched */
  onThreadSwitched?: (thread: ThreadData | null) => void;
  /** Called when a thread is updated */
  onThreadUpdated?: (thread: ThreadData) => void;
  /** Called when a thread is deleted */
  onThreadDeleted?: (threadId: string) => void;
  /** Called when an error occurs */
  onError?: (error: Error) => void;
}

/**
 * Options for creating a new thread
 */
export interface CreateThreadOptions {
  /** Custom thread ID (auto-generated if not provided) */
  id?: string;
  /** Thread title */
  title?: string;
  /** Initial messages */
  messages?: Message[];
  /** Active leaf message ID — preserves branch selection across reloads */
  activeLeafId?: string;
}

/**
 * Options for updating a thread
 */
export interface UpdateThreadOptions {
  /** Update title */
  title?: string;
  /** Update messages */
  messages?: Message[];
  /** Custom metadata updates */
  [key: string]: unknown;
}

/**
 * ThreadManager - Manages thread state and persistence
 *
 * @example Basic usage with localStorage (default)
 * ```typescript
 * const manager = new ThreadManager();
 * await manager.loadThreads();
 *
 * const thread = await manager.createThread();
 * console.log(manager.threads);
 * ```
 *
 * @example With custom adapter
 * ```typescript
 * const manager = new ThreadManager({
 *   adapter: myDatabaseAdapter,
 * });
 * ```
 */
export class ThreadManager {
  protected state: ThreadManagerState;
  protected adapter: ThreadStorageAdapter | AsyncThreadStorageAdapter;
  protected callbacks: ThreadManagerCallbacks;
  protected saveDebounce: number;
  protected autoLoad: boolean;
  protected autoRestoreLastThread: boolean;

  // Debounce timer for auto-save
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  // Full thread data cache (for localStorage adapter)
  private threadsData: Map<string, ThreadData> = new Map();
  // Initialization promise
  private initPromise: Promise<void> | null = null;

  constructor(
    config: ThreadManagerConfig = {},
    callbacks: ThreadManagerCallbacks = {},
  ) {
    this.state = config.state ?? new SimpleThreadManagerState();
    this.adapter = config.adapter ?? localStorageAdapter;
    this.callbacks = callbacks;
    this.saveDebounce = config.saveDebounce ?? 1000;
    this.autoLoad = config.autoLoad ?? true;
    this.autoRestoreLastThread = config.autoRestoreLastThread ?? true;

    // Auto-load on initialization if enabled
    if (this.autoLoad) {
      this.initPromise = this.loadThreads().catch((err) => {
        console.warn("[ThreadManager] Auto-load failed:", err);
      });
    }
  }

  // ============================================
  // Getters
  // ============================================

  /** All threads (metadata) */
  get threads(): Thread[] {
    return this.state.threads;
  }

  /** Currently selected thread ID */
  get currentThreadId(): string | null {
    return this.state.currentThreadId;
  }

  /** Currently loaded thread (with messages) */
  get currentThread(): ThreadData | null {
    return this.state.currentThread;
  }

  /** Whether threads are currently loading */
  get isLoading(): boolean {
    return this.state.loadStatus === "loading";
  }

  /** Current load status */
  get loadStatus(): LoadStatus {
    return this.state.loadStatus;
  }

  /** Current error */
  get error(): Error | undefined {
    return this.state.error;
  }

  /** Whether there are pending changes waiting to be saved */
  get hasPendingChanges(): boolean {
    return this.saveTimer !== null;
  }

  // ============================================
  // Public Methods
  // ============================================

  /**
   * Load all threads from storage
   */
  async loadThreads(): Promise<void> {
    this.state.setLoadStatus("loading");
    this.state.setError(undefined);

    try {
      const threadsData = await this.adapter.load();

      // Store full data in cache
      this.threadsData.clear();
      for (const thread of threadsData) {
        this.threadsData.set(thread.id, thread);
      }

      // Extract metadata for state
      const threads: Thread[] = threadsData.map((t) => ({
        id: t.id,
        title: t.title,
        preview:
          t.preview ??
          (t.messages[0]?.content
            ? generatePreview(
                typeof t.messages[0].content === "string"
                  ? t.messages[0].content
                  : "",
              )
            : undefined),
        messageCount: t.messageCount ?? t.messages.length,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
      }));

      // Sort by updatedAt (most recent first)
      threads.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

      this.state.setThreads(threads);
      this.state.setLoadStatus("loaded");
      this.callbacks.onThreadsLoaded?.(threads);

      // Auto-restore last active thread if enabled and adapter supports it
      if (this.autoRestoreLastThread && this.adapter.getLastActiveThreadId) {
        const lastActiveId = await this.adapter.getLastActiveThreadId();
        if (lastActiveId && this.threadsData.has(lastActiveId)) {
          // Switch to last active thread (don't await to avoid blocking)
          this.switchThread(lastActiveId).catch((err) => {
            console.warn(
              "[ThreadManager] Failed to restore last active thread:",
              err,
            );
          });
        }
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      this.state.setError(error);
      this.state.setLoadStatus("error");
      this.callbacks.onError?.(error);
      throw error;
    }
  }

  /**
   * Wait for initialization to complete
   */
  async waitForInit(): Promise<void> {
    if (this.initPromise) {
      await this.initPromise;
    }
  }

  /**
   * Create a new thread
   */
  async createThread(options?: CreateThreadOptions): Promise<ThreadData> {
    const now = new Date();
    const id = options?.id ?? generateThreadId();

    // Auto-generate title from first user message if not provided
    let title = options?.title;
    if (!title && options?.messages) {
      const firstUserMsg = options.messages.find((m) => m.role === "user");
      if (firstUserMsg?.content) {
        title = generateThreadTitle(
          typeof firstUserMsg.content === "string" ? firstUserMsg.content : "",
        );
      }
    }

    const thread: ThreadData = {
      id,
      title,
      messages: options?.messages ?? [],
      sources: [],
      createdAt: now,
      updatedAt: now,
      preview: options?.messages?.[0]?.content
        ? generatePreview(
            typeof options.messages[0].content === "string"
              ? options.messages[0].content
              : "",
          )
        : undefined,
      messageCount: options?.messages?.length ?? 0,
      activeLeafId: options?.activeLeafId,
    };

    // Use optimized create if available
    const asyncAdapter = this.adapter as AsyncThreadStorageAdapter;
    if (asyncAdapter.createThread) {
      try {
        const created = await asyncAdapter.createThread(thread);
        this.threadsData.set(created.id, created);
        this.state.addThread(created);
        this.state.setCurrentThread(created);
        this.callbacks.onThreadCreated?.(created);
        // Save as last active thread
        this.saveLastActiveThread(created.id);
        return created;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        this.state.setError(error);
        this.callbacks.onError?.(error);
        throw error;
      }
    }

    // Fallback to full save
    this.threadsData.set(id, thread);
    this.state.addThread(thread);
    this.state.setCurrentThread(thread);
    this.scheduleSave();
    this.callbacks.onThreadCreated?.(thread);
    // Save as last active thread
    this.saveLastActiveThread(id);

    return thread;
  }

  /**
   * Switch to a different thread
   */
  async switchThread(id: string): Promise<ThreadData | null> {
    // Check if already selected
    if (this.currentThreadId === id && this.currentThread) {
      return this.currentThread;
    }

    // Use optimized getThread if available
    const asyncAdapter = this.adapter as AsyncThreadStorageAdapter;
    if (asyncAdapter.getThread) {
      try {
        const thread = await asyncAdapter.getThread(id);
        this.state.setCurrentThread(thread);
        if (thread) {
          this.threadsData.set(id, thread);
          // Save as last active thread
          this.saveLastActiveThread(id);
        }
        this.callbacks.onThreadSwitched?.(thread);
        return thread;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        this.state.setError(error);
        this.callbacks.onError?.(error);
        throw error;
      }
    }

    // Fallback to cache lookup
    const thread = this.threadsData.get(id) ?? null;
    this.state.setCurrentThread(thread);
    if (thread) {
      // Save as last active thread
      this.saveLastActiveThread(id);
    }
    this.callbacks.onThreadSwitched?.(thread);
    return thread;
  }

  /**
   * Update the current thread
   */
  async updateCurrentThread(updates: UpdateThreadOptions): Promise<void> {
    if (!this.currentThread) {
      throw new Error("No thread selected");
    }

    const now = new Date();
    const id = this.currentThread.id;

    // Calculate updated thread data
    const updatedThread: ThreadData = {
      ...this.currentThread,
      ...updates,
      updatedAt: now,
    };

    // Update preview and message count if messages changed
    if (updates.messages) {
      updatedThread.messageCount = updates.messages.length;
      if (updates.messages[0]?.content) {
        updatedThread.preview = generatePreview(
          typeof updates.messages[0].content === "string"
            ? updates.messages[0].content
            : "",
        );
      }
      // Auto-generate title from first user message if not set
      if (!updatedThread.title) {
        const firstUserMsg = updates.messages.find((m) => m.role === "user");
        if (firstUserMsg?.content) {
          updatedThread.title = generateThreadTitle(
            typeof firstUserMsg.content === "string"
              ? firstUserMsg.content
              : "",
          );
        }
      }
    }

    // Use optimized updateThread if available
    const asyncAdapter = this.adapter as AsyncThreadStorageAdapter;
    if (asyncAdapter.updateThread) {
      try {
        const updated = await asyncAdapter.updateThread(id, updatedThread);
        this.threadsData.set(id, updated);
        this.state.setCurrentThread(updated);
        this.state.updateThread(id, {
          title: updated.title,
          preview: updated.preview,
          messageCount: updated.messageCount,
          updatedAt: updated.updatedAt,
        });
        this.callbacks.onThreadUpdated?.(updated);
        return;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        this.state.setError(error);
        this.callbacks.onError?.(error);
        throw error;
      }
    }

    // Fallback to full save
    this.threadsData.set(id, updatedThread);
    this.state.setCurrentThread(updatedThread);
    this.state.updateThread(id, {
      title: updatedThread.title,
      preview: updatedThread.preview,
      messageCount: updatedThread.messageCount,
      updatedAt: updatedThread.updatedAt,
    });
    this.scheduleSave();
    this.callbacks.onThreadUpdated?.(updatedThread);
  }

  /**
   * Delete a thread
   */
  async deleteThread(id: string): Promise<void> {
    // Check if deleting the current thread
    const isDeletingCurrent = this.currentThreadId === id;

    // Use optimized deleteThread if available
    const asyncAdapter = this.adapter as AsyncThreadStorageAdapter;
    if (asyncAdapter.deleteThread) {
      try {
        await asyncAdapter.deleteThread(id);
        this.threadsData.delete(id);
        this.state.removeThread(id);

        // Clear current thread if we deleted it
        if (isDeletingCurrent) {
          this.state.setCurrentThread(null);
          this.saveLastActiveThread(null);
        }

        this.callbacks.onThreadDeleted?.(id);
        return;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        this.state.setError(error);
        this.callbacks.onError?.(error);
        throw error;
      }
    }

    // Fallback to full save
    this.threadsData.delete(id);
    this.state.removeThread(id);

    // Clear current thread if we deleted it
    if (isDeletingCurrent) {
      this.state.setCurrentThread(null);
      this.saveLastActiveThread(null);
    }

    this.scheduleSave();
    this.callbacks.onThreadDeleted?.(id);
  }

  /**
   * Clear the current thread selection
   */
  clearCurrentThread(): void {
    this.state.setCurrentThread(null);
    this.saveLastActiveThread(null);
    this.callbacks.onThreadSwitched?.(null);
  }

  /**
   * Clear all threads
   */
  async clearAllThreads(): Promise<void> {
    try {
      await this.adapter.clear();
      this.threadsData.clear();
      this.state.setThreads([]);
      this.state.setCurrentThread(null);
      this.saveLastActiveThread(null);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      this.state.setError(error);
      this.callbacks.onError?.(error);
      throw error;
    }
  }

  /**
   * Save changes immediately (bypass debounce)
   */
  async saveNow(): Promise<void> {
    // Cancel pending save
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }

    try {
      const threads = Array.from(this.threadsData.values());
      await this.adapter.save(threads);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      this.state.setError(error);
      this.callbacks.onError?.(error);
      throw error;
    }
  }

  /**
   * Dispose of the manager and save pending changes
   */
  async dispose(): Promise<void> {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
      // Save any pending changes
      await this.saveNow();
    }
  }

  // ============================================
  // Protected Methods
  // ============================================

  /**
   * Schedule a debounced save
   */
  protected scheduleSave(): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
    }

    this.saveTimer = setTimeout(async () => {
      this.saveTimer = null;
      try {
        await this.saveNow();
      } catch (err) {
        console.warn("[ThreadManager] Auto-save failed:", err);
      }
    }, this.saveDebounce);
  }

  /**
   * Save the last active thread ID (for session persistence)
   */
  protected saveLastActiveThread(threadId: string | null): void {
    if (this.adapter.setLastActiveThreadId) {
      this.adapter.setLastActiveThreadId(threadId).catch((err) => {
        console.warn("[ThreadManager] Failed to save last active thread:", err);
      });
    }
  }
}

/**
 * Create a ThreadManager instance
 */
export function createThreadManager(
  config?: ThreadManagerConfig,
  callbacks?: ThreadManagerCallbacks,
): ThreadManager {
  return new ThreadManager(config, callbacks);
}
