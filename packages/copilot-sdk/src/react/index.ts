/**
 * @yourgpt/copilot-sdk-react
 *
 * React hooks and components for Copilot SDK
 */

// Provider
export {
  CopilotProvider,
  useCopilot,
  type CopilotProviderProps,
  type CopilotContextValue,
} from "./provider/CopilotProvider";

// Context types from legacy provider (for backward compat)
export type {
  ChatState,
  CombinedChatState,
  ChatActions,
  ToolsState,
  ToolsActions,
  AgentLoopState,
} from "./context/CopilotContext";

// Hooks
export {
  // Tool hooks
  useTool,
  useTools,
  useToolWithSchema,
  useToolsWithSchema,
  useToolExecutor,
  // Context hooks
  useAIAction,
  useAIActions,
  useAIContext,
  useAIContexts,
  useAITools,
  // Agent hook
  useAgent,
  // Suggestions
  useSuggestions,
  generateSuggestionReason,
  // Types
  type AIContextItem,
  type UseAIToolsOptions,
  type UseAIToolsReturn,
  type UseSuggestionsOptions,
  type UseSuggestionsReturn,
  type Suggestion,
  type UseAgentOptions,
  type UseAgentReturn,
  type UseToolConfig,
  type UseToolWithSchemaConfig,
  type UseToolExecutorReturn,
} from "./hooks";

// Knowledge Base
export {
  useKnowledgeBase,
  searchKnowledgeBase,
  formatKnowledgeResultsForAI,
  type UseKnowledgeBaseConfig,
  type KnowledgeBaseConfig,
  type KnowledgeBaseResult,
  type KnowledgeBaseSearchResponse,
} from "./hooks/useKnowledgeBase";

// Permission Storage
export {
  createPermissionStorage,
  createSessionPermissionCache,
} from "./utils/permission-storage";

// DevLogger (Development debugging tool)
export { useDevLogger, type DevLoggerState } from "./hooks/useDevLogger";

// Capabilities Hooks (for multi-provider support)
export {
  useCapabilities,
  useFeatureSupport,
  useSupportedMediaTypes,
  type ProviderCapabilities,
  type CapabilitiesResponse,
} from "./hooks/useCapabilities";

// Thread Manager Hook
export {
  useThreadManager,
  type UseThreadManagerConfig,
  type UseThreadManagerReturn,
} from "./hooks/useThreadManager";

// Thread Adapters (for custom persistence)
export {
  createServerAdapter,
  createLocalStorageAdapter,
  createMemoryAdapter,
  type ServerAdapterConfig,
  type LocalStorageAdapterConfig,
  type AsyncThreadStorageAdapter,
} from "../thread";

// Core (Vercel AI SDK pattern)
// These use useSyncExternalStore for optimal React integration
export {
  ReactChat,
  ReactChatState,
  createReactChat,
  createReactChatState,
  useChat,
  type ChatStatus,
  type ReactChatConfig,
  type UseChatConfig,
  type UseChatReturn,
  // Thread Manager
  ReactThreadManager,
  ReactThreadManagerState,
  createReactThreadManager,
  createReactThreadManagerState,
  type ReactThreadManagerConfig,
} from "./internal";

// Re-export chat types (framework-agnostic core)
export type {
  UIMessage,
  ChatState as CoreChatState,
  ChatConfig,
  ChatCallbacks,
  AgentLoopState as CoreAgentLoopState,
  AgentLoopCallbacks,
  AgentLoopActions,
  ToolExecution as ChatToolExecution,
  ToolResponse as ChatToolResponse,
} from "../chat";

export {
  AbstractChat,
  AbstractAgentLoop,
  initialAgentLoopState,
} from "../chat";

// MCP (Model Context Protocol) Hooks
export {
  useMCPClient,
  useMCPTools,
  type UseMCPClientConfig,
  type UseMCPClientReturn,
  type UseMCPToolsConfig,
  type UseMCPToolsReturn,
  type MCPClientState,
} from "./hooks";

// MCP-UI Hooks (Interactive UI Intent Handling)
export {
  useMCPUIIntents,
  createMessageIntentHandler,
  createToolIntentHandler,
  type UseMCPUIIntentsConfig,
  type UseMCPUIIntentsReturn,
} from "./hooks";

// Re-export core types for convenience
export type {
  Message,
  Source,
  ActionDefinition,
  ActionParameter,
  CopilotConfig,
  LLMConfig,
  CloudConfig,
  // Tools types (smart context)
  ToolsConfig,
  ToolType,
  ToolConsentRequest,
  ToolConsentResponse,
  CapturedContext,
  IntentDetectionResult,
  // Thread types
  Thread,
  ThreadData,
  PersistenceConfig,
  ThreadStorageAdapter,
  // Agentic Loop types
  ToolDefinition,
  ToolResponse,
  ToolContext,
  ToolExecution,
  ToolExecutionStatus,
  UnifiedToolCall,
  AgentLoopConfig,
  // Permission types
  PermissionLevel,
  ToolPermission,
  PermissionStorageConfig,
  PermissionStorageAdapter,
} from "../core";
