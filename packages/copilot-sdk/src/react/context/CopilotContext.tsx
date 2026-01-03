"use client";

import { createContext, useContext } from "react";
import type {
  CopilotConfig,
  Message,
  MessageAttachment,
  ActionDefinition,
  Source,
  ToolsConfig,
  ToolType,
  ToolConsentRequest,
  CapturedContext,
  ToolDefinition,
  ToolExecution,
  ToolResponse,
  ToolApprovalStatus,
  PermissionLevel,
  ToolPermission,
} from "../../core";
import type { ContextTreeNode } from "../utils/context-tree";

/**
 * Chat UI state interface (UI-only state, not message data)
 * Message data is stored in ThreadsState as the single source of truth
 */
export interface ChatState {
  /** Whether a response is being generated */
  isLoading: boolean;
  /** Current error if any */
  error: Error | null;
}

/**
 * Combined chat state for context consumers
 * Includes derived data from threads for convenience
 */
export interface CombinedChatState {
  /** All messages in the conversation (from active thread) */
  messages: Message[];
  /** Whether a response is being generated */
  isLoading: boolean;
  /** Current error if any */
  error: Error | null;
  /** Thread/conversation ID (from active thread) */
  threadId: string | null;
  /** Sources from knowledge base (from active thread) */
  sources: Source[];
}

/**
 * Tools state interface (Smart Context tools)
 */
export interface ToolsState {
  /** Whether tools are enabled */
  isEnabled: boolean;
  /** Pending consent request */
  pendingConsent: ToolConsentRequest | null;
  /** Last captured context */
  lastContext: CapturedContext | null;
  /** Currently capturing */
  isCapturing: boolean;
}

/**
 * Agent loop state interface (Agentic tools)
 */
export interface AgentLoopState {
  /** Current tool executions */
  toolExecutions: ToolExecution[];
  /** Current loop iteration */
  iteration: number;
  /** Maximum iterations */
  maxIterations: number;
  /** Whether max iterations was reached */
  maxIterationsReached: boolean;
  /** Whether waiting for server response after tool completion */
  isProcessing: boolean;
}

/**
 * Chat actions interface
 */
export interface ChatActions {
  /** Send a message (with optional attachments) */
  sendMessage: (
    content: string,
    attachments?: MessageAttachment[],
  ) => Promise<void>;
  /** Send a message with context */
  sendMessageWithContext: (
    content: string,
    context: CapturedContext,
  ) => Promise<void>;
  /** Stop generation */
  stopGeneration: () => void;
  /** Clear all messages */
  clearMessages: () => void;
  /** Regenerate last response */
  regenerate: (messageId?: string) => Promise<void>;
  /** Set messages directly */
  setMessages: (messages: Message[]) => void;
  /**
   * Process file to MessageAttachment
   * - Premium: uploads to cloud storage, returns URL-based attachment
   * - Free: converts to base64
   */
  processAttachment: (file: File) => Promise<MessageAttachment>;
}

/**
 * Tools actions interface
 */
export interface ToolsActions {
  /** Request consent for tools */
  requestConsent: (tools: ToolType[], reason?: string) => void;
  /** Respond to consent request */
  respondToConsent: (approved: ToolType[], remember?: boolean) => void;
  /** Capture context */
  captureContext: (tools: ToolType[]) => Promise<CapturedContext>;
  /** Clear pending consent */
  clearConsent: () => void;
}

/**
 * Copilot context value
 */
export interface CopilotContextValue {
  /** SDK configuration */
  config: CopilotConfig;
  /** Tools configuration */
  toolsConfig: ToolsConfig | null;
  /** Chat state (combined from UI state + active thread) */
  chat: CombinedChatState;
  /** Tools state (Smart Context) */
  tools: ToolsState;
  /** Agent loop state (Agentic tools) */
  agentLoop: AgentLoopState;
  /** Chat actions */
  actions: ChatActions;
  /** Tools actions */
  toolsActions: ToolsActions;
  /** Registered actions/tools (legacy) */
  registeredActions: ActionDefinition[];
  /** Register an action (legacy) */
  registerAction: (action: ActionDefinition) => void;
  /** Unregister an action (legacy) */
  unregisterAction: (name: string) => void;
  /** Registered tools (Agentic) */
  registeredTools: ToolDefinition[];
  /** Register a tool */
  registerTool: (tool: ToolDefinition) => void;
  /** Unregister a tool */
  unregisterTool: (name: string) => void;
  /** Add a tool execution record */
  addToolExecution?: (execution: ToolExecution) => void;
  /** Update a tool execution record */
  updateToolExecution?: (id: string, update: Partial<ToolExecution>) => void;
  /** Clear all tool executions */
  clearToolExecutions?: () => void;

  // Tool approval handlers (for needsApproval tools)

  /**
   * Approve a tool execution with optional extra data.
   * The extraData is passed to the tool handler via context.approvalData.
   *
   * @param executionId - The tool execution ID
   * @param extraData - Optional data from user's action (e.g., selected item)
   * @param permissionLevel - Optional permission level for persistence
   */
  approveToolExecution?: (
    executionId: string,
    extraData?: Record<string, unknown>,
    permissionLevel?: PermissionLevel,
  ) => void;
  /** Reject a tool execution that requires approval */
  rejectToolExecution?: (
    executionId: string,
    reason?: string,
    permissionLevel?: PermissionLevel,
  ) => void;
  /** Tool executions waiting for user approval */
  pendingApprovals: ToolExecution[];

  // Permission management (for persistent tool approvals)

  /** All stored permissions */
  storedPermissions: ToolPermission[];
  /** Whether permissions have been loaded from storage */
  permissionsLoaded: boolean;
  /** Get permission level for a specific tool */
  getToolPermission: (toolName: string) => Promise<PermissionLevel>;
  /** Set permission level for a tool */
  setToolPermission: (
    toolName: string,
    level: PermissionLevel,
  ) => Promise<void>;
  /** Clear all stored permissions */
  clearAllPermissions: () => Promise<void>;
  /** Add context for AI (returns context ID) */
  addContext: (context: string, parentId?: string) => string;
  /** Remove context by ID */
  removeContext: (id: string) => void;
  /** Get all contexts as tree */
  contextTree: ContextTreeNode[];
  /** Whether user has API key (premium) */
  isPremium: boolean;
  /** Whether cloud storage is available (premium feature) */
  isCloudStorageAvailable: boolean;
}

/**
 * Initial chat UI state
 */
export const initialChatState: ChatState = {
  isLoading: false,
  error: null,
};

/**
 * Initial tools state
 */
export const initialToolsState: ToolsState = {
  isEnabled: false,
  pendingConsent: null,
  lastContext: null,
  isCapturing: false,
};

/**
 * Initial agent loop state
 */
export const initialAgentLoopState: AgentLoopState = {
  toolExecutions: [],
  iteration: 0,
  maxIterations: 20,
  maxIterationsReached: false,
  isProcessing: false,
};

/**
 * Copilot Context
 */
export const CopilotContext = createContext<CopilotContextValue | null>(null);

/**
 * Hook to access Copilot context
 */
export function useCopilotContext(): CopilotContextValue {
  const context = useContext(CopilotContext);

  if (!context) {
    throw new Error("useCopilotContext must be used within a CopilotProvider");
  }

  return context;
}
