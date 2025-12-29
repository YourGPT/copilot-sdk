/**
 * @yourgpt/copilot-sdk-react
 *
 * React hooks and components for YourGPT Copilot SDK
 */

// Provider
export {
  YourGPTProvider,
  type YourGPTProviderProps,
} from "./provider/YourGPTProvider";

// Context
export {
  YourGPTContext,
  useYourGPTContext,
  type YourGPTContextValue,
  type ChatState,
  type CombinedChatState,
  type ChatActions,
  type ToolsState,
  type ToolsActions,
  type AgentLoopState,
} from "./context/YourGPTContext";

export {
  ThreadsContext,
  useThreadsContext,
  type ThreadsContextValue,
} from "./context/ThreadsContext";

// Hooks
export {
  useAIChat,
  useIsPremium,
  useAIAction,
  useAIActions,
  useAIContext,
  useAIContexts,
  useAITools,
  useSuggestions,
  useAgent,
  useThreads,
  generateSuggestionReason,
  // Tool hooks (Agentic Loop)
  useTool,
  useTools,
  useToolWithSchema,
  useToolsWithSchema,
  useToolExecutor,
  // Note: Screenshot/Console/Network tools are auto-registered via toolsConfig
  type UseAIChatReturn,
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
// Use with: import { DevLogger } from "@yourgpt/copilot-sdk-ui";
export { useDevLogger, type DevLoggerState } from "./hooks/useDevLogger";

// Capabilities Hooks (for multi-provider support)
export {
  useCapabilities,
  useFeatureSupport,
  useSupportedMediaTypes,
  type ProviderCapabilities,
  type CapabilitiesResponse,
} from "./hooks/useCapabilities";

// Re-export core types for convenience
export type {
  Message,
  Source,
  ActionDefinition,
  ActionParameter,
  YourGPTConfig,
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
} from "@yourgpt/copilot-sdk-core";
