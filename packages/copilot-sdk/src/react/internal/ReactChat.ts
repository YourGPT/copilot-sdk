/**
 * ReactChat - React-specific wrapper for AbstractChat
 *
 * This class extends the new AbstractChat from @yourgpt/copilot-sdk-chat
 * and injects ReactChatState for React-specific state management.
 *
 * Pattern inspired by Vercel AI SDK's Chat class.
 */

import {
  AbstractChat,
  type ChatConfig,
  type ChatCallbacks,
  type UIMessage,
  type ChatInit,
  type ChatEventHandler,
} from "../../chat";
import { ReactChatState } from "./ReactChatState";
import type { BranchInfo } from "../../chat/branching";

/**
 * Chat status for UI state
 */
export type ChatStatus = "ready" | "submitted" | "streaming" | "error";

/**
 * ReactChat configuration
 */
export interface ReactChatConfig {
  /** Runtime API endpoint */
  runtimeUrl: string;
  /** System prompt */
  systemPrompt?: string;
  /** LLM configuration */
  llm?: ChatConfig["llm"];
  /** Thread ID */
  threadId?: string;
  /** Enable streaming (default: true) */
  streaming?: boolean;
  /** Request headers */
  headers?: Record<string, string>;
  /** Initial messages */
  initialMessages?: UIMessage[];
  /** Debug mode */
  debug?: boolean;
  /** Callbacks */
  callbacks?: ChatCallbacks<UIMessage>;
}

/**
 * ReactChat extends AbstractChat with React-specific state management.
 *
 * Uses ReactChatState which implements ChatState interface with
 * callback-based reactivity for useSyncExternalStore.
 *
 * @example
 * ```tsx
 * const chatRef = useRef(new ReactChat(config));
 *
 * const messages = useSyncExternalStore(
 *   chatRef.current.subscribe,
 *   () => chatRef.current.messages
 * );
 * ```
 */
export class ReactChat extends AbstractChat<UIMessage> {
  private reactState: ReactChatState<UIMessage>;

  constructor(config: ReactChatConfig) {
    // Create React-specific state
    const reactState = new ReactChatState<UIMessage>(config.initialMessages);

    // Build ChatInit for AbstractChat
    const init: ChatInit<UIMessage> = {
      runtimeUrl: config.runtimeUrl,
      systemPrompt: config.systemPrompt,
      llm: config.llm,
      threadId: config.threadId,
      streaming: config.streaming ?? true,
      headers: config.headers,
      initialMessages: config.initialMessages,
      state: reactState,
      callbacks: config.callbacks,
      debug: config.debug,
    };

    super(init);
    this.reactState = reactState;
  }

  // ============================================
  // Subscribe (for useSyncExternalStore)
  // ============================================

  /**
   * Subscribe to state changes.
   * Returns an unsubscribe function.
   *
   * @example
   * ```tsx
   * const messages = useSyncExternalStore(
   *   chat.subscribe,
   *   () => chat.messages
   * );
   * ```
   */
  subscribe = (callback: () => void): (() => void) => {
    return this.reactState.subscribe(callback);
  };

  // ============================================
  // Event handling shortcuts
  // ============================================

  /**
   * Subscribe to tool calls events
   */
  onToolCalls(handler: ChatEventHandler<"toolCalls">): () => void {
    return this.on("toolCalls", handler);
  }

  /**
   * Subscribe to done events
   */
  onDone(handler: ChatEventHandler<"done">): () => void {
    return this.on("done", handler);
  }

  /**
   * Subscribe to error events
   */
  onError(handler: ChatEventHandler<"error">): () => void {
    return this.on("error", handler);
  }

  // ============================================
  // Branching API — pass-throughs to ReactChatState
  // ============================================

  /**
   * Navigate to a sibling branch (makes it the active path).
   */
  switchBranch(messageId: string): void {
    this.reactState.switchBranch(messageId);
  }

  /**
   * Get branch navigation info for a message.
   * Returns null if the message has no siblings.
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

  // ============================================
  // Override dispose to clean up state
  // ============================================

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
 * Create a ReactChat instance
 */
export function createReactChat(config: ReactChatConfig): ReactChat {
  return new ReactChat(config);
}
