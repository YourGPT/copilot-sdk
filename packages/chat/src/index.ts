/**
 * @yourgpt/copilot-sdk-chat
 *
 * Framework-agnostic chat core for Copilot SDK.
 *
 * This package provides the core chat functionality that can be used
 * with any UI framework (React, Vue, Svelte, Angular, etc).
 *
 * @example React usage:
 * ```tsx
 * import { AbstractChat, UIMessage, ChatConfig } from '@yourgpt/copilot-sdk-chat';
 * ```
 */

// ============================================
// Types
// ============================================

export type {
  // Message types
  MessageRole,
  UIMessage,
  StreamingMessageState,
  ToolResultMessage,
  AssistantToolMessage,
  // Chat types
  ChatStatus,
  ChatConfig,
  ChatRequestOptions,
  ChatCallbacks,
  ChatInit,
  SendMessageOptions,
  // Tool types
  ToolCallInfo,
  RawToolCall,
  ToolExecutionStatus,
  ToolApprovalStatus,
  ToolExecution,
  ToolResponse,
  AgentLoopConfig,
  AgentLoopCallbacks,
  AgentLoopState,
  AgentLoopActions,
  PermissionCheckResult,
} from "./types/index";

export { initialAgentLoopState } from "./types/index";

// ============================================
// Interfaces (Contracts)
// ============================================

export type {
  ChatState,
  ChatTransport,
  ChatRequest,
  ChatResponse,
  StreamChunk,
  TransportConfig,
} from "./interfaces";

export { SimpleChatState } from "./interfaces";

// ============================================
// Adapters
// ============================================

export { HttpTransport, createHttpTransport } from "./adapters";

// ============================================
// Classes
// ============================================

export { AbstractChat, type ChatEvent, type ChatEventHandler } from "./classes";

// AbstractAgentLoop (tool execution)
export { AbstractAgentLoop } from "./AbstractAgentLoop";

// ChatWithTools (coordinated chat + tools - recommended)
export {
  ChatWithTools,
  createChatWithTools,
  type ChatWithToolsConfig,
  type ChatWithToolsCallbacks,
} from "./ChatWithTools";

// ============================================
// Pure Functions
// ============================================

export {
  // Stream functions
  parseSSELine,
  parseSSEText,
  isStreamDone,
  requiresToolExecution,
  processStreamChunk,
  createStreamState,
  isStreamComplete,
  hasContent,
  // Message functions
  generateMessageId,
  createUserMessage,
  createAssistantMessage,
  createToolMessage,
  createSystemMessage,
  streamStateToMessage,
  createEmptyAssistantMessage,
  updateMessageContent,
  appendMessageContent,
  updateMessageThinking,
  appendMessageThinking,
  updateMessage,
  removeMessage,
  findMessage,
  getLastMessage,
  getLastAssistantMessage,
  hasPendingToolCalls,
} from "./functions";
