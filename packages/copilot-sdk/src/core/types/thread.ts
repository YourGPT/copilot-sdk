import type { Message, Source } from "./message";

/**
 * Thread metadata (for listing threads)
 */
export interface Thread {
  /** Unique thread identifier */
  id: string;
  /** Thread title (auto-generated from first message or manual) */
  title?: string;
  /** Preview of the first message (for thread lists) */
  preview?: string;
  /** Number of messages in this thread */
  messageCount?: number;
  /** When thread was created */
  createdAt: Date;
  /** When thread was last updated */
  updatedAt: Date;
}

/**
 * Full thread data including messages
 */
export interface ThreadData extends Thread {
  /** Messages in this thread */
  messages: Message[];
  /** Sources from knowledge base for this thread */
  sources: Source[];
  /**
   * ID of the active leaf message (tip of the active branch path).
   * Saved so the correct branch is restored after a page reload.
   */
  activeLeafId?: string;
}

/**
 * Persistence storage interface for custom adapters
 */
export interface ThreadStorageAdapter {
  /** Save threads to storage */
  save: (threads: ThreadData[]) => Promise<void>;
  /** Load threads from storage */
  load: () => Promise<ThreadData[]>;
  /** Clear all threads from storage */
  clear: () => Promise<void>;
}

/**
 * Persistence configuration
 */
export interface PersistenceConfig {
  /** Enable persistence (default: false) */
  enabled: boolean;
  /** Storage type */
  storage?: "localStorage" | "custom";
  /** Custom storage adapter (required if storage is 'custom') */
  customStorage?: ThreadStorageAdapter;
}

/**
 * Generate a thread title from message content
 */
export function generateThreadTitle(content: string): string {
  const trimmed = content.trim();
  if (trimmed.length <= 50) return trimmed;
  return trimmed.substring(0, 47) + "...";
}
