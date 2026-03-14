/**
 * ChatState Interface
 *
 * Contract for framework-specific state implementations.
 * React, Vue, Svelte each implement this differently.
 */

import type { UIMessage, ChatStatus } from "../types/index";
import type { BranchInfo } from "../branching";

/**
 * ChatState interface - Framework adapters implement this
 *
 * This is the key abstraction that enables framework-agnostic code.
 * The AbstractChat class uses this interface, and each framework
 * provides its own implementation.
 *
 * @example React implementation
 * ```typescript
 * class ReactChatState implements ChatState<UIMessage> {
 *   #messages: UIMessage[] = [];
 *   #callbacks = new Set<() => void>();
 *
 *   get messages() { return this.#messages; }
 *   set messages(m) {
 *     this.#messages = m;
 *     this.#callbacks.forEach(cb => cb()); // Trigger re-render
 *   }
 *
 *   subscribe(cb: () => void) {
 *     this.#callbacks.add(cb);
 *     return () => this.#callbacks.delete(cb);
 *   }
 * }
 * ```
 *
 * @example Vue implementation
 * ```typescript
 * class VueChatState implements ChatState<UIMessage> {
 *   messages = ref<UIMessage[]>([]);
 *   status = ref<ChatStatus>('ready');
 *   // Vue refs are automatically reactive
 * }
 * ```
 */
export interface ChatState<T extends UIMessage = UIMessage> {
  // ============================================
  // State Properties
  // ============================================

  /** All messages in the conversation */
  messages: T[];

  /** Current chat status */
  status: ChatStatus;

  /** Current error if any */
  error: Error | undefined;

  // ============================================
  // State Mutations (trigger reactivity)
  // ============================================

  /**
   * Add a message to the end
   */
  pushMessage(message: T): void;

  /**
   * Remove the last message
   */
  popMessage(): void;

  /**
   * Replace a message at index
   */
  replaceMessage(index: number, message: T): void;

  /**
   * Update the last message (common during streaming)
   */
  updateLastMessage(updater: (message: T) => T): void;

  /**
   * Update a specific message by ID
   * Returns true if message was found and updated, false otherwise
   */
  updateMessageById(id: string, updater: (message: T) => T): boolean;

  /**
   * Set all messages (replace entire array)
   */
  setMessages(messages: T[]): void;

  /**
   * Clear all messages
   */
  clearMessages(): void;

  // ============================================
  // Subscription (for React's useSyncExternalStore)
  // ============================================

  /**
   * Subscribe to state changes
   * Returns unsubscribe function
   *
   * This is used by React's useSyncExternalStore.
   * Vue/Svelte may not need this (they use refs/stores).
   */
  subscribe?(callback: () => void): () => void;

  // ============================================
  // Snapshot (for React concurrent mode)
  // ============================================

  /**
   * Get immutable snapshot of messages
   * Used by useSyncExternalStore's getSnapshot
   */
  getMessagesSnapshot?(): T[];

  /**
   * Get status snapshot
   */
  getStatusSnapshot?(): ChatStatus;

  /**
   * Get error snapshot
   */
  getErrorSnapshot?(): Error | undefined;

  // ============================================
  // Branching Extensions (optional — only ReactChatState implements these)
  // ============================================

  /**
   * Set the current leaf message ID.
   * Used by regenerate() to rewind the active path before pushing a new response.
   */
  setCurrentLeaf?(leafId: string | null): void;

  /**
   * Get all messages across all branches (for persistence).
   * The base messages getter returns only the visible path.
   */
  getAllMessages?(): T[];

  /**
   * Get branch navigation info for a message.
   * Returns null if the message has no siblings.
   */
  getBranchInfo?(messageId: string): BranchInfo | null;

  /**
   * Navigate to a specific message variant (sibling branch).
   * Updates the active path to go through messageId.
   */
  switchBranch?(messageId: string): void;

  /**
   * Whether any message has siblings (branching has occurred).
   */
  readonly hasBranches?: boolean;
}

/**
 * Default in-memory state implementation (for testing/vanilla JS)
 */
export class SimpleChatState<
  T extends UIMessage = UIMessage,
> implements ChatState<T> {
  private _messages: T[] = [];
  private _status: ChatStatus = "ready";
  private _error: Error | undefined = undefined;
  private callbacks = new Set<() => void>();

  get messages(): T[] {
    return this._messages;
  }

  set messages(value: T[]) {
    this._messages = value;
    this.notify();
  }

  get status(): ChatStatus {
    return this._status;
  }

  set status(value: ChatStatus) {
    this._status = value;
    this.notify();
  }

  get error(): Error | undefined {
    return this._error;
  }

  set error(value: Error | undefined) {
    this._error = value;
    this.notify();
  }

  pushMessage(message: T): void {
    this._messages = [...this._messages, message];
    this.notify();
  }

  popMessage(): void {
    this._messages = this._messages.slice(0, -1);
    this.notify();
  }

  replaceMessage(index: number, message: T): void {
    this._messages = [
      ...this._messages.slice(0, index),
      message,
      ...this._messages.slice(index + 1),
    ];
    this.notify();
  }

  updateLastMessage(updater: (message: T) => T): void {
    if (this._messages.length === 0) return;
    const lastIndex = this._messages.length - 1;
    this.replaceMessage(lastIndex, updater(this._messages[lastIndex]));
  }

  updateMessageById(id: string, updater: (message: T) => T): boolean {
    const index = this._messages.findIndex((m) => m.id === id);
    if (index === -1) return false;
    this.replaceMessage(index, updater(this._messages[index]));
    return true;
  }

  setMessages(messages: T[]): void {
    this._messages = messages;
    this.notify();
  }

  clearMessages(): void {
    this._messages = [];
    this.notify();
  }

  subscribe(callback: () => void): () => void {
    this.callbacks.add(callback);
    return () => this.callbacks.delete(callback);
  }

  getMessagesSnapshot(): T[] {
    return this._messages;
  }

  getStatusSnapshot(): ChatStatus {
    return this._status;
  }

  getErrorSnapshot(): Error | undefined {
    return this._error;
  }

  private notify(): void {
    this.callbacks.forEach((cb) => cb());
  }
}
