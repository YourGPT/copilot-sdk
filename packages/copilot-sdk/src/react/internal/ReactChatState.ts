/**
 * ReactChatState - React-specific implementation of ChatState
 *
 * Backed by MessageTree for conversation branching support.
 * The `messages` getter returns only the visible path (active branch).
 * Use `getAllMessages()` for full persistence.
 *
 * Pattern inspired by Vercel AI SDK's useSyncExternalStore pattern.
 */

import type { ChatState, UIMessage, ChatStatus } from "../../chat";
import { MessageTree, type BranchInfo } from "../../chat/branching";

/**
 * ReactChatState implements ChatState with callback-based reactivity
 * and full conversation branching support via MessageTree.
 *
 * @example
 * ```tsx
 * const state = new ReactChatState<UIMessage>();
 *
 * // Subscribe to changes (for useSyncExternalStore)
 * const unsubscribe = state.subscribe(() => {
 *   console.log('State changed');
 * });
 *
 * // Get visible path (active branch only)
 * const messages = state.messages;
 *
 * // Get all messages across branches (for persistence)
 * const all = state.getAllMessages();
 * ```
 */
export class ReactChatState<
  T extends UIMessage = UIMessage,
> implements ChatState<T> {
  private tree: MessageTree<T>;
  private _status: ChatStatus = "ready";
  private _error: Error | undefined = undefined;

  // Callbacks for React subscriptions (useSyncExternalStore)
  private subscribers = new Set<() => void>();

  constructor(initialMessages?: T[]) {
    this.tree = new MessageTree<T>(initialMessages);
  }

  // ============================================
  // Getters — visible path only
  // ============================================

  /**
   * Returns the VISIBLE PATH (active branch) — what the UI renders
   * and what gets sent to the API.
   *
   * For all messages across all branches, use getAllMessages().
   */
  get messages(): T[] {
    return this.tree.getVisibleMessages();
  }

  get status(): ChatStatus {
    return this._status;
  }

  get error(): Error | undefined {
    return this._error;
  }

  // ============================================
  // Setters (trigger reactivity)
  // ============================================

  set messages(value: T[]) {
    this.tree.reset(value);
    this.notify();
  }

  set status(value: ChatStatus) {
    this._status = value;
    this.notify();
  }

  set error(value: Error | undefined) {
    this._error = value;
    this.notify();
  }

  // ============================================
  // Mutations
  // ============================================

  pushMessage(message: T): void {
    this.tree.addMessage(message);
    this.notify();
  }

  popMessage(): void {
    // Remove current leaf from tree
    const leafId = this.tree.currentLeafId;
    if (!leafId) return;

    const allMessages = this.tree.getAllMessages().filter((m) => m.id !== leafId);
    // Walk up to the parent to set it as new leaf
    const leaf = this.tree.getAllMessages().find((m) => m.id === leafId);
    const newLeafId =
      leaf && leaf.parentId !== undefined && leaf.parentId !== null
        ? leaf.parentId
        : null;

    this.tree.reset(allMessages);
    if (newLeafId) {
      this.tree.setCurrentLeaf(newLeafId);
    }
    this.notify();
  }

  replaceMessage(index: number, message: T): void {
    // replaceMessage operates on the visible path
    const visible = this.tree.getVisibleMessages();
    const target = visible[index];
    if (!target) return;
    this.tree.updateMessage(target.id, () => message);
    this.notify();
  }

  updateLastMessage(updater: (message: T) => T): void {
    const leafId = this.tree.currentLeafId;
    if (!leafId) return;
    this.tree.updateMessage(leafId, updater);
    this.notify();
  }

  updateMessageById(id: string, updater: (message: T) => T): boolean {
    const updated = this.tree.updateMessage(id, updater);
    if (updated) this.notify();
    return updated;
  }

  setMessages(messages: T[]): void {
    this.tree.reset(messages);
    this.notify();
  }

  clearMessages(): void {
    this.tree.reset([]);
    this.notify();
  }

  // ============================================
  // Branching API
  // ============================================

  /**
   * Returns ALL messages across all branches.
   * Use this for persistence (ThreadManager save).
   */
  getAllMessages(): T[] {
    return this.tree.getAllMessages();
  }

  /**
   * Get branch navigation info for a message.
   * Returns null if the message has no siblings.
   */
  getBranchInfo(messageId: string): BranchInfo | null {
    return this.tree.getBranchInfo(messageId);
  }

  /**
   * Navigate to a sibling branch.
   * Triggers re-render via notify().
   */
  switchBranch(messageId: string): void {
    this.tree.switchBranch(messageId);
    this.notify();
  }

  /**
   * Set the current leaf (used by regenerate() to rewind active path).
   * Triggers re-render via notify().
   */
  setCurrentLeaf(leafId: string | null): void {
    this.tree.setCurrentLeaf(leafId);
    this.notify();
  }

  get hasBranches(): boolean {
    return this.tree.hasBranches;
  }

  // ============================================
  // Subscription (for useSyncExternalStore)
  // ============================================

  /**
   * Subscribe to state changes.
   * Returns an unsubscribe function.
   *
   * @example
   * ```tsx
   * const messages = useSyncExternalStore(
   *   state.subscribe,
   *   () => state.messages
   * );
   * ```
   */
  subscribe = (callback: () => void): (() => void) => {
    this.subscribers.add(callback);
    return () => {
      this.subscribers.delete(callback);
    };
  };

  // ============================================
  // Private Methods
  // ============================================

  private notify(): void {
    this.subscribers.forEach((cb) => cb());
  }

  /**
   * Cleanup subscriptions
   */
  dispose(): void {
    this.subscribers.clear();
  }

  /**
   * Revive after dispose (for React StrictMode compatibility)
   * Subscribers will be re-added automatically via useSyncExternalStore
   */
  revive(): void {
    // No-op: subscribers are re-added automatically
  }
}

/**
 * Create a ReactChatState instance
 */
export function createReactChatState<T extends UIMessage = UIMessage>(
  initialMessages?: T[],
): ReactChatState<T> {
  return new ReactChatState<T>(initialMessages);
}
