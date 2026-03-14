/**
 * MessageTree — Bidirectional flat-map message tree for conversation branching.
 *
 * Industry-standard data structure used by ChatGPT, Claude.ai, and Gemini:
 * - parentId + childrenIds[] for O(1) navigation
 * - activeChildMap tracks the active path through the tree
 *
 * Zero React dependency — pure TypeScript, works in any environment.
 */

import type { UIMessage } from "../types/message";

// ============================================
// Types
// ============================================

/**
 * Branch navigation info for the UI navigator (← N/M →)
 */
export interface BranchInfo {
  /** 0-based index of this message among its siblings */
  siblingIndex: number;
  /** Total number of sibling variants at this fork */
  totalSiblings: number;
  /** Ordered IDs of all siblings (oldest-first) */
  siblingIds: string[];
  hasPrevious: boolean;
  hasNext: boolean;
}

// ============================================
// MessageTree
// ============================================

export class MessageTree<T extends UIMessage = UIMessage> {
  /** All messages by ID */
  private nodeMap: Map<string, T> = new Map();
  /** parentKey → ordered list of child IDs (insertion order = oldest-first) */
  private childrenOf: Map<string, string[]> = new Map();
  /** parentKey → currently-active child ID */
  private activeChildMap: Map<string, string> = new Map();
  /** Current leaf message ID (tip of the active path) */
  private _currentLeafId: string | null = null;

  /** Sentinel key used for root-level messages (parentId === null) */
  static readonly ROOT_KEY = "__root__";

  constructor(messages?: T[]) {
    if (messages?.length) {
      this._buildFromMessages(messages);
    }
  }

  // ============================================
  // Static Migration Helpers
  // ============================================

  /**
   * Convert a legacy flat array (no parentId) to a tree-linked array.
   *
   * Rules:
   * - Tool messages get parentId = the owning assistant message's id
   *   (matched via toolCallId → toolCall.id).
   * - All other messages get parentId of the previous non-tool message
   *   (or null for the first message).
   *
   * Returns a new array with parentId/childrenIds filled in.
   * Does NOT mutate the original messages.
   */
  static fromFlatArray<T extends UIMessage>(messages: T[]): T[] {
    if (messages.length === 0) return messages;

    // If already tree-linked (any message has parentId defined), return as-is
    const alreadyLinked = messages.some((m) => m.parentId !== undefined);
    if (alreadyLinked) return messages;

    const result: T[] = [];
    // Track linear parent chain (skip tool messages for parent tracking)
    let prevNonToolId: string | null = null;

    // Build assistant id → assistant message map for tool pairing
    const assistantById = new Map<string, T>();
    for (const msg of messages) {
      if (msg.role === "assistant") {
        assistantById.set(msg.id, msg);
      }
    }

    for (const msg of messages) {
      if (msg.role === "tool" && msg.toolCallId) {
        // Find owning assistant message by matching toolCallId → toolCall.id
        let ownerAssistantId: string | null = null;
        for (const [, assistant] of assistantById) {
          if (assistant.toolCalls?.some((tc) => tc.id === msg.toolCallId)) {
            ownerAssistantId = assistant.id;
            break;
          }
        }
        result.push({
          ...msg,
          parentId: ownerAssistantId ?? prevNonToolId,
          childrenIds: [],
        });
      } else {
        result.push({
          ...msg,
          parentId: prevNonToolId,
          childrenIds: [],
        });
        prevNonToolId = msg.id;
      }
    }

    // Second pass: fill in childrenIds based on parentId assignments
    const childrenMap = new Map<string, string[]>();
    for (const msg of result) {
      const parentKey =
        msg.parentId == null ? MessageTree.ROOT_KEY : msg.parentId;
      if (!childrenMap.has(parentKey)) {
        childrenMap.set(parentKey, []);
      }
      childrenMap.get(parentKey)!.push(msg.id);
    }

    return result.map((msg) => ({
      ...msg,
      childrenIds: childrenMap.get(msg.id) ?? [],
    }));
  }

  // ============================================
  // Core Queries
  // ============================================

  /**
   * Returns the visible path (root → current leaf) — what the UI renders
   * and what gets sent to the API.
   *
   * Backward-compat: if NO message has parentId set (all undefined),
   * falls back to insertion order (legacy linear mode).
   */
  getVisibleMessages(): T[] {
    if (this.nodeMap.size === 0) return [];

    // Legacy linear fallback: no parentId on any message
    const hasTreeStructure = Array.from(this.nodeMap.values()).some(
      (m) => m.parentId !== undefined,
    );
    if (!hasTreeStructure) {
      return Array.from(this.nodeMap.values());
    }

    return this._getActivePath().map((id) => this.nodeMap.get(id)!);
  }

  /**
   * Returns ALL messages across every branch (for persistence / ThreadManager).
   */
  getAllMessages(): T[] {
    return Array.from(this.nodeMap.values());
  }

  /**
   * Branch navigation info for the UI navigator.
   * Returns null if the message has no siblings (only child).
   */
  getBranchInfo(messageId: string): BranchInfo | null {
    const msg = this.nodeMap.get(messageId);
    if (!msg) return null;

    const parentKey = this._parentKey(msg.parentId);
    const siblings = this.childrenOf.get(parentKey) ?? [];

    if (siblings.length <= 1) return null;

    const siblingIndex = siblings.indexOf(messageId);
    return {
      siblingIndex,
      totalSiblings: siblings.length,
      siblingIds: [...siblings],
      hasPrevious: siblingIndex > 0,
      hasNext: siblingIndex < siblings.length - 1,
    };
  }

  get currentLeafId(): string | null {
    return this._currentLeafId;
  }

  get hasBranches(): boolean {
    for (const children of this.childrenOf.values()) {
      if (children.length > 1) return true;
    }
    return false;
  }

  // ============================================
  // Mutations
  // ============================================

  /**
   * Insert a new message.
   * - Updates childrenOf and nodeMap.
   * - New branch becomes active (activeChildMap updated).
   * - Updates current leaf.
   */
  addMessage(message: T): T {
    this.nodeMap.set(message.id, message);

    const parentKey = this._parentKey(message.parentId);
    if (!this.childrenOf.has(parentKey)) {
      this.childrenOf.set(parentKey, []);
    }
    const siblings = this.childrenOf.get(parentKey)!;
    if (!siblings.includes(message.id)) {
      siblings.push(message.id);
    }

    // New message becomes active at its parent fork
    this.activeChildMap.set(parentKey, message.id);

    // Update current leaf (walk forward from this message)
    this._currentLeafId = this._walkToLeaf(message.id);

    return message;
  }

  /**
   * Navigate: make messageId the active child at its parent fork,
   * then walk to its leaf and update currentLeafId.
   */
  switchBranch(messageId: string): void {
    const msg = this.nodeMap.get(messageId);
    if (!msg) return;

    const parentKey = this._parentKey(msg.parentId);
    this.activeChildMap.set(parentKey, messageId);
    this._currentLeafId = this._walkToLeaf(messageId);
  }

  /**
   * Update message content in-place (streaming updates).
   * No tree structure change.
   */
  updateMessage(id: string, updater: (msg: T) => T): boolean {
    const existing = this.nodeMap.get(id);
    if (!existing) return false;
    this.nodeMap.set(id, updater(existing));
    return true;
  }

  /**
   * Set current leaf explicitly.
   * Used by regenerate() to rewind the active path before pushing a new message.
   */
  setCurrentLeaf(leafId: string | null): void {
    this._currentLeafId = leafId;

    if (leafId === null) return;

    // Ensure the active path points to this leaf
    const msg = this.nodeMap.get(leafId);
    if (!msg) return;

    // Walk up and set activeChildMap entries so getVisibleMessages() is consistent
    let current: T | undefined = msg;
    while (current) {
      const parentKey = this._parentKey(current.parentId);
      this.activeChildMap.set(parentKey, current.id);
      if (current.parentId == null || current.parentId === undefined) break;
      current = this.nodeMap.get(current.parentId);
    }
  }

  /**
   * Rebuild entire tree from a message array.
   * Used by setMessages().
   */
  reset(messages: T[]): void {
    this.nodeMap.clear();
    this.childrenOf.clear();
    this.activeChildMap.clear();
    this._currentLeafId = null;

    if (messages.length > 0) {
      this._buildFromMessages(messages);
    }
  }

  // ============================================
  // Private Helpers
  // ============================================

  private _buildFromMessages(messages: T[]): void {
    // Auto-migrate legacy flat arrays
    const linked = messages.some((m) => m.parentId !== undefined)
      ? messages
      : MessageTree.fromFlatArray(messages);

    for (const msg of linked) {
      this.nodeMap.set(msg.id, msg);

      const parentKey = this._parentKey(msg.parentId);
      if (!this.childrenOf.has(parentKey)) {
        this.childrenOf.set(parentKey, []);
      }
      const siblings = this.childrenOf.get(parentKey)!;
      if (!siblings.includes(msg.id)) {
        siblings.push(msg.id);
      }
    }

    // Build activeChildMap: default to last child at each fork
    // (last child = most recently added = what was active when saved)
    for (const [parentKey, children] of this.childrenOf) {
      if (children.length > 0) {
        this.activeChildMap.set(parentKey, children[children.length - 1]);
      }
    }

    // Set current leaf by walking the active path from root
    const path = this._getActivePath();
    this._currentLeafId = path.length > 0 ? path[path.length - 1] : null;
  }

  private _parentKey(parentId: string | null | undefined): string {
    if (parentId == null || parentId === undefined) {
      return MessageTree.ROOT_KEY;
    }
    return parentId;
  }

  /**
   * Walk forward from a message along active children to find the leaf.
   */
  private _walkToLeaf(fromId: string): string {
    let current = fromId;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const children = this.childrenOf.get(current);
      if (!children || children.length === 0) break;
      const activeChild = this.activeChildMap.get(current);
      if (!activeChild) break;
      if (!this.nodeMap.has(activeChild)) break;
      current = activeChild;
    }
    return current;
  }

  /**
   * Walk the active path from root to the current leaf.
   */
  private _getActivePath(): string[] {
    const path: string[] = [];
    const visited = new Set<string>();

    // Start from root children
    const rootChildren = this.childrenOf.get(MessageTree.ROOT_KEY) ?? [];
    if (rootChildren.length === 0) return path;

    // Pick active root child
    let activeId = this.activeChildMap.get(MessageTree.ROOT_KEY);
    if (!activeId) {
      // Fall back to last root child
      activeId = rootChildren[rootChildren.length - 1];
    }

    // Walk forward along active children
    let current: string | undefined = activeId;
    while (current && !visited.has(current)) {
      if (!this.nodeMap.has(current)) break;
      visited.add(current);
      path.push(current);

      // Check if this message has an override active child set
      // (used when setCurrentLeaf rewinds the active path)
      const activeChild = this.activeChildMap.get(current);
      if (!activeChild || !this.nodeMap.has(activeChild)) break;
      current = activeChild;
    }

    return path;
  }
}
