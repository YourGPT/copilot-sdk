/**
 * localStorage Thread Storage Adapter
 *
 * Default adapter for thread persistence using browser localStorage.
 * Stores all data in a single key for cleaner storage management.
 */

import type { ThreadData } from "../../core/types/thread";
import type { ThreadStorageAdapter, AsyncThreadStorageAdapter } from "./types";

const DEFAULT_STORAGE_KEY = "copilot-sdk-store";
const STORE_VERSION = 1;

/**
 * Store structure for localStorage
 */
interface CopilotStore {
  /** Schema version for future migrations */
  version: number;
  /** Last active thread ID for session restore */
  lastActiveThreadId: string | null;
  /** All thread data */
  threads: SerializedThreadData[];
}

/**
 * Serialized thread data (dates as ISO strings)
 */
interface SerializedThreadData {
  id: string;
  title?: string;
  preview?: string;
  messageCount?: number;
  createdAt: string;
  updatedAt: string;
  messages: SerializedMessage[];
  sources: unknown[];
  /** ID of the active leaf message for branch restoration */
  activeLeafId?: string;
}

/**
 * Serialized message (dates as ISO strings)
 */
interface SerializedMessage {
  id: string;
  role: string;
  content: string | null;
  created_at: string;
  tool_calls?: unknown;
  tool_call_id?: string;
  metadata?: unknown;
  /** Parent message ID for branch tree reconstruction */
  parent_id?: string | null;
  /** Child message IDs for branch tree reconstruction */
  children_ids?: string[];
}

/**
 * Configuration for localStorage adapter
 */
export interface LocalStorageAdapterConfig {
  /**
   * Storage key to use
   * @default "copilot-sdk-store"
   */
  storageKey?: string;
}

/**
 * Check if localStorage is available (SSR-safe)
 */
let _localStorageAvailable: boolean | null = null;
function isLocalStorageAvailable(): boolean {
  if (_localStorageAvailable !== null) return _localStorageAvailable;
  if (typeof window === "undefined") return (_localStorageAvailable = false);
  try {
    const testKey = "__copilot_ls_check__";
    window.localStorage.setItem(testKey, "1");
    window.localStorage.removeItem(testKey);
    return (_localStorageAvailable = true);
  } catch {
    return (_localStorageAvailable = false);
  }
}

/**
 * Create empty store with defaults
 */
function createEmptyStore(): CopilotStore {
  return {
    version: STORE_VERSION,
    lastActiveThreadId: null,
    threads: [],
  };
}

/**
 * Serialize thread data for storage
 */
function serializeThread(thread: ThreadData): SerializedThreadData {
  return {
    id: thread.id,
    title: thread.title,
    preview: thread.preview,
    messageCount: thread.messageCount,
    createdAt: thread.createdAt.toISOString(),
    updatedAt: thread.updatedAt.toISOString(),
    sources: thread.sources || [],
    activeLeafId: thread.activeLeafId,
    messages: thread.messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      created_at:
        m.created_at instanceof Date
          ? m.created_at.toISOString()
          : m.created_at,
      tool_calls: m.tool_calls,
      tool_call_id: m.tool_call_id,
      metadata: m.metadata,
      parent_id: m.parent_id,
      children_ids: m.children_ids,
    })),
  };
}

/**
 * Deserialize thread data from storage
 */
function deserializeThread(data: SerializedThreadData): ThreadData {
  return {
    id: data.id,
    title: data.title,
    preview: data.preview,
    messageCount: data.messageCount ?? data.messages?.length ?? 0,
    createdAt: new Date(data.createdAt),
    updatedAt: new Date(data.updatedAt),
    sources: (data.sources || []) as ThreadData["sources"],
    activeLeafId: data.activeLeafId,
    messages: (data.messages || []).map((m) => ({
      id: m.id,
      role: m.role as "user" | "assistant" | "system" | "tool",
      content: m.content,
      created_at: new Date(m.created_at),
      tool_calls: m.tool_calls as ThreadData["messages"][0]["tool_calls"],
      tool_call_id: m.tool_call_id,
      metadata: m.metadata as ThreadData["messages"][0]["metadata"],
      parent_id: m.parent_id,
      children_ids: m.children_ids,
    })),
  };
}

/**
 * Read store from localStorage
 */
function readStore(storageKey: string): CopilotStore {
  if (!isLocalStorageAvailable()) {
    return createEmptyStore();
  }

  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) {
      return createEmptyStore();
    }

    const parsed = JSON.parse(raw);

    // Validate store structure
    if (!parsed || typeof parsed !== "object") {
      console.warn("[CopilotSDK] Invalid store format, resetting");
      return createEmptyStore();
    }

    // Handle version migrations if needed in the future
    if (parsed.version !== STORE_VERSION) {
      console.log(
        `[CopilotSDK] Migrating store from v${parsed.version} to v${STORE_VERSION}`,
      );
      // Future: Add migration logic here
    }

    return {
      version: STORE_VERSION,
      lastActiveThreadId: parsed.lastActiveThreadId ?? null,
      threads: Array.isArray(parsed.threads) ? parsed.threads : [],
    };
  } catch (e) {
    console.warn("[CopilotSDK] Failed to read store, resetting:", e);
    return createEmptyStore();
  }
}

/**
 * Write store to localStorage
 */
function writeStore(storageKey: string, store: CopilotStore): void {
  if (!isLocalStorageAvailable()) return;

  try {
    const serialized = JSON.stringify(store);
    localStorage.setItem(storageKey, serialized);
  } catch (e) {
    if (e instanceof DOMException && e.name === "QuotaExceededError") {
      // Evict the oldest thread and retry once
      if (store.threads.length > 1) {
        const evicted = [...store.threads].sort(
          (a, b) =>
            new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime(),
        );
        const trimmed = { ...store, threads: evicted.slice(1) };
        console.warn(
          "[CopilotSDK] localStorage quota exceeded — evicting oldest thread:",
          evicted[0].id,
        );
        try {
          localStorage.setItem(storageKey, JSON.stringify(trimmed));
        } catch {
          console.error("[CopilotSDK] localStorage still full after eviction.");
        }
      } else {
        console.error(
          "[CopilotSDK] localStorage quota exceeded and only one thread remains. Cannot evict.",
        );
      }
    } else {
      console.warn("[CopilotSDK] Failed to write store:", e);
    }
  }
}

/**
 * Update store with a partial update (read-modify-write)
 */
function updateStore(
  storageKey: string,
  updater: (store: CopilotStore) => Partial<CopilotStore>,
): CopilotStore {
  const store = readStore(storageKey);
  const updates = updater(store);
  const newStore = { ...store, ...updates };
  writeStore(storageKey, newStore);
  return newStore;
}

/**
 * Create a localStorage adapter for thread storage
 *
 * All data is stored in a single key for cleaner storage management.
 *
 * @example Default usage
 * ```typescript
 * const adapter = createLocalStorageAdapter();
 * const threadManager = new ThreadManager({ adapter });
 * ```
 *
 * @example With custom key
 * ```typescript
 * const adapter = createLocalStorageAdapter({
 *   storageKey: "my-app-copilot-store"
 * });
 * ```
 */
export function createLocalStorageAdapter(
  config?: LocalStorageAdapterConfig,
): AsyncThreadStorageAdapter {
  const storageKey = config?.storageKey ?? DEFAULT_STORAGE_KEY;

  return {
    save: async (threads: ThreadData[]): Promise<void> => {
      updateStore(storageKey, (store) => ({
        threads: threads.map(serializeThread),
      }));
    },

    load: async (): Promise<ThreadData[]> => {
      const store = readStore(storageKey);
      return store.threads.map(deserializeThread);
    },

    clear: async (): Promise<void> => {
      if (!isLocalStorageAvailable()) return;

      try {
        localStorage.removeItem(storageKey);
      } catch (e) {
        console.warn("[CopilotSDK] Failed to clear store:", e);
      }
    },

    getLastActiveThreadId: async (): Promise<string | null> => {
      const store = readStore(storageKey);
      return store.lastActiveThreadId;
    },

    setLastActiveThreadId: async (threadId: string | null): Promise<void> => {
      updateStore(storageKey, () => ({
        lastActiveThreadId: threadId,
      }));
    },

    deleteThread: async (id: string): Promise<void> => {
      updateStore(storageKey, (store) => ({
        threads: store.threads.filter((t) => t.id !== id),
      }));
    },
  };
}

/**
 * Default localStorage adapter instance
 */
export const localStorageAdapter = createLocalStorageAdapter();
