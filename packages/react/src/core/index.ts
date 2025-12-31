/**
 * Core React adapters for Copilot SDK
 *
 * These classes and hooks use the framework-agnostic abstractions
 * from @yourgpt/copilot-sdk-chat and add React-specific integration.
 */

// ReactChatState - React-specific ChatState implementation
export { ReactChatState, createReactChatState } from "./ReactChatState";

// ReactChat - React adapter for AbstractChat
export {
  ReactChat,
  createReactChat,
  type ChatStatus,
  type ReactChatConfig,
} from "./ReactChat";

// ReactChatWithTools - React adapter for ChatWithTools (recommended)
export {
  ReactChatWithTools,
  createReactChatWithTools,
  type ReactChatWithToolsConfig,
} from "./ReactChatWithTools";

// useChat - Thin React hook using useSyncExternalStore
export { useChat, type UseChatConfig, type UseChatReturn } from "./useChat";
