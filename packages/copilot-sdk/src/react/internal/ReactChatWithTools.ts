/**
 * ReactChatWithTools - React-specific wrapper for ChatWithTools
 *
 * Injects ReactChatState for proper useSyncExternalStore integration.
 */

import {
  ChatWithTools,
  type ChatWithToolsConfig,
  type ChatWithToolsCallbacks,
  type UIMessage,
  type ToolExecution,
} from "../../chat";
import { ReactChatState } from "./ReactChatState";
import type { BranchInfo } from "../../chat/branching";

/**
 * React-specific configuration
 */
export interface ReactChatWithToolsConfig extends Omit<
  ChatWithToolsConfig,
  "state"
> {
  /** Initial messages */
  initialMessages?: UIMessage[];
}

/**
 * ReactChatWithTools - Chat + Tools with React state management
 *
 * @example
 * ```tsx
 * const chatRef = useRef(new ReactChatWithTools(config, callbacks));
 *
 * const messages = useSyncExternalStore(
 *   chatRef.current.subscribe,
 *   () => chatRef.current.messages
 * );
 * ```
 */
export class ReactChatWithTools extends ChatWithTools {
  private reactState: ReactChatState<UIMessage>;

  constructor(
    config: ReactChatWithToolsConfig,
    callbacks: ChatWithToolsCallbacks = {},
  ) {
    // Create React-specific state
    const reactState = new ReactChatState<UIMessage>(config.initialMessages);

    // Pass state to parent
    super({ ...config, state: reactState }, callbacks);

    this.reactState = reactState;
  }

  /**
   * Subscribe to state changes (for useSyncExternalStore)
   */
  subscribe = (callback: () => void): (() => void) => {
    return this.reactState.subscribe(callback);
  };

  // ============================================
  // Branching API — pass-throughs to ReactChatState
  // ============================================

  /**
   * Navigate to a sibling branch.
   */
  switchBranch(messageId: string): void {
    this.reactState.switchBranch(messageId);
  }

  /**
   * Get branch navigation info for a message.
   */
  getBranchInfo(messageId: string): BranchInfo | null {
    return this.reactState.getBranchInfo(messageId);
  }

  /**
   * Get all messages across all branches (for persistence).
   */
  getAllMessages(): UIMessage[] {
    return this.reactState.getAllMessages();
  }

  /**
   * Whether any message has siblings (branching has occurred).
   */
  get hasBranches(): boolean {
    return this.reactState.hasBranches;
  }

  /**
   * Dispose and cleanup
   */
  dispose(): void {
    super.dispose();
    this.reactState.dispose();
  }

  /**
   * Revive a disposed instance (for React StrictMode compatibility)
   */
  revive(): void {
    super.revive();
    this.reactState.revive();
  }
}

/**
 * Create a ReactChatWithTools instance
 */
export function createReactChatWithTools(
  config: ReactChatWithToolsConfig,
  callbacks?: ChatWithToolsCallbacks,
): ReactChatWithTools {
  return new ReactChatWithTools(config, callbacks);
}
