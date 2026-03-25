"use client";

/**
 * useChat - React hook for chat functionality
 *
 * This hook uses ReactChat with useSyncExternalStore for optimal
 * React integration. Inspired by Vercel AI SDK's useChat pattern.
 */

import {
  useRef,
  useSyncExternalStore,
  useCallback,
  useEffect,
  useState,
} from "react";
import { ReactChat, createReactChat, type ReactChatConfig } from "./ReactChat";
import type { UIMessage, ChatStatus } from "../../chat";
import type { MessageAttachment } from "../../core";
import type { BranchInfo } from "../../chat/branching";

/**
 * Hook configuration
 */
export interface UseChatConfig extends Omit<ReactChatConfig, "callbacks"> {
  /** Callback when messages change */
  onMessagesChange?: (messages: UIMessage[]) => void;
  /** Callback when error occurs */
  onError?: (error: Error | null) => void;
  /** Callback when generation finishes */
  onFinish?: (messages: UIMessage[]) => void;
  /** Callback when tool calls are received */
  onToolCalls?: (toolCalls: UIMessage["toolCalls"]) => void;
}

/**
 * Hook return type
 */
export interface UseChatReturn {
  /** All messages (visible path — active branch only) */
  messages: UIMessage[];
  /** Current status */
  status: ChatStatus;
  /** Current error */
  error: Error | undefined;
  /** Whether loading */
  isLoading: boolean;
  /** Current input value */
  input: string;
  /** Set input value */
  setInput: (input: string) => void;
  /** Send a message */
  sendMessage: (
    content: string,
    attachments?: MessageAttachment[],
  ) => Promise<void>;
  /** Stop generation */
  stop: () => void;
  /** Clear all messages */
  clearMessages: () => void;
  /** Set messages directly */
  setMessages: (messages: UIMessage[]) => void;
  /** Regenerate last response (branch-aware: preserves original as sibling) */
  regenerate: (messageId?: string) => Promise<void>;
  /** Continue with tool results */
  continueWithToolResults: (
    toolResults: Array<{ toolCallId: string; result: unknown }>,
  ) => Promise<void>;
  /** Reference to the ReactChat instance */
  chatRef: React.RefObject<ReactChat | null>;

  // ============================================
  // Branching API
  // ============================================

  /**
   * Navigate to a sibling branch (← / → navigation).
   * Only populated when chat is branch-aware.
   */
  switchBranch?: (messageId: string) => void;

  /**
   * Get branch navigation info for a message.
   * Returns null if the message has no siblings.
   * Only populated when chat is branch-aware.
   */
  getBranchInfo?: (messageId: string) => BranchInfo | null;

  /**
   * Edit a user message: sends newContent as a new branch from the same
   * parent as the original message. Preserves the original message in place.
   * Only populated when chat is branch-aware.
   */
  editMessage?: (messageId: string, newContent: string) => Promise<void>;

  /**
   * Whether any message has siblings (branching has occurred).
   */
  hasBranches?: boolean;
}

/**
 * useChat - Thin React wrapper using useSyncExternalStore
 *
 * This hook is designed to be minimal (~100 lines like Vercel AI SDK).
 * All business logic lives in ReactChat/AbstractChat.
 *
 * @example
 * ```tsx
 * const { messages, sendMessage, status } = useChat({
 *   runtimeUrl: "/api/chat",
 * });
 *
 * return (
 *   <div>
 *     {messages.map(m => <Message key={m.id} message={m} />)}
 *     <button onClick={() => sendMessage("Hello!")}>Send</button>
 *   </div>
 * );
 * ```
 */
export function useChat(config: UseChatConfig): UseChatReturn {
  // Create and store ReactChat instance
  const chatRef = useRef<ReactChat | null>(null);
  const isThreadIdControlled = Object.prototype.hasOwnProperty.call(
    config,
    "threadId",
  );
  const lastControlledThreadIdRef = useRef<{
    controlled: boolean;
    value: string | undefined;
  }>({
    controlled: isThreadIdControlled,
    value: config.threadId,
  });

  // Local input state (UI concern)
  const [input, setInput] = useState("");

  // Revive if disposed (React StrictMode compatibility)
  if (chatRef.current !== null && chatRef.current.disposed) {
    chatRef.current.revive();
  }

  // Initialize chat on first render
  if (chatRef.current === null) {
    chatRef.current = createReactChat({
      runtimeUrl: config.runtimeUrl,
      systemPrompt: config.systemPrompt,
      llm: config.llm,
      threadId: config.threadId,
      onCreateSession: config.onCreateSession,
      yourgptConfig: config.yourgptConfig,
      streaming: config.streaming,
      headers: config.headers,
      initialMessages: config.initialMessages,
      debug: config.debug,
      callbacks: {
        onMessagesChange: config.onMessagesChange,
        onError: config.onError,
        onFinish: config.onFinish,
        onToolCalls: config.onToolCalls,
      },
    });
  }

  // Keep the chat instance aligned with controlled threadId prop changes.
  useEffect(() => {
    const prev = lastControlledThreadIdRef.current;
    const controlChanged = prev.controlled !== isThreadIdControlled;
    const valueChanged = prev.value !== config.threadId;

    if (!controlChanged && !valueChanged) {
      return;
    }

    lastControlledThreadIdRef.current = {
      controlled: isThreadIdControlled,
      value: config.threadId,
    };

    if (!isThreadIdControlled) {
      return;
    }

    chatRef.current?.setActiveThread(config.threadId ?? null);
  }, [config.threadId, isThreadIdControlled]);

  // Subscribe to all state changes with useSyncExternalStore
  const messages = useSyncExternalStore(
    chatRef.current.subscribe,
    () => chatRef.current!.messages,
    () => chatRef.current!.messages, // Server snapshot
  );

  const status = useSyncExternalStore(
    chatRef.current.subscribe,
    () => chatRef.current!.status,
    () => "ready" as ChatStatus, // Server snapshot
  );

  const error = useSyncExternalStore(
    chatRef.current.subscribe,
    () => chatRef.current!.error,
    () => undefined, // Server snapshot
  );

  const hasBranches = useSyncExternalStore(
    chatRef.current.subscribe,
    () => chatRef.current!.hasBranches,
    () => false,
  );

  // Derived state
  const isLoading = status === "streaming" || status === "submitted";

  // Actions (stable references)
  const sendMessage = useCallback(
    async (content: string, attachments?: MessageAttachment[]) => {
      await chatRef.current?.sendMessage(content, attachments);
      setInput(""); // Clear input after sending
    },
    [],
  );

  const stop = useCallback(() => {
    chatRef.current?.stop();
  }, []);

  const clearMessages = useCallback(() => {
    chatRef.current?.clearMessages();
  }, []);

  const setMessages = useCallback((messages: UIMessage[]) => {
    chatRef.current?.setMessages(messages);
  }, []);

  const regenerate = useCallback(async (messageId?: string) => {
    await chatRef.current?.regenerate(messageId);
  }, []);

  const continueWithToolResults = useCallback(
    async (toolResults: Array<{ toolCallId: string; result: unknown }>) => {
      await chatRef.current?.continueWithToolResults(toolResults);
    },
    [],
  );

  // Branching actions
  const switchBranch = useCallback((messageId: string) => {
    chatRef.current?.switchBranch(messageId);
  }, []);

  const getBranchInfo = useCallback((messageId: string): BranchInfo | null => {
    return chatRef.current?.getBranchInfo(messageId) ?? null;
  }, []);

  const editMessage = useCallback(
    async (messageId: string, newContent: string) => {
      await chatRef.current?.sendMessage(newContent, undefined, {
        editMessageId: messageId,
      });
      setInput("");
    },
    [],
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      chatRef.current?.dispose();
    };
  }, []);

  return {
    messages,
    status,
    error,
    isLoading,
    input,
    setInput,
    sendMessage,
    stop,
    clearMessages,
    setMessages,
    regenerate,
    continueWithToolResults,
    chatRef,
    // Branching
    switchBranch,
    getBranchInfo,
    editMessage,
    hasBranches,
  };
}
