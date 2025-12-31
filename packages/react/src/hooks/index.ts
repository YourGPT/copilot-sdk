/**
 * React Hooks for Copilot SDK
 */

// Action hooks
export { useAIAction, useAIActions } from "./useAIAction";

// Context hooks
export {
  useAIContext,
  useAIContexts,
  type AIContextItem,
} from "./useAIContext";

// Smart Context tools hooks
export {
  useAITools,
  generateSuggestionReason,
  type UseAIToolsOptions,
  type UseAIToolsReturn,
} from "./useAITools";

// Tool Hooks (Agentic Loop)
export {
  useTool,
  useTools,
  useToolsArray,
  type UseToolConfig,
  type ToolSet,
} from "./useTool";
export {
  useToolWithSchema,
  useToolsWithSchema,
  type UseToolWithSchemaConfig,
} from "./useToolWithSchema";
export { useToolExecutor, type UseToolExecutorReturn } from "./useToolExecutor";

// Suggestions
export {
  useSuggestions,
  type UseSuggestionsOptions,
  type UseSuggestionsReturn,
  type Suggestion,
} from "./useSuggestions";

// Agent (LangGraph)
export {
  useAgent,
  type UseAgentOptions,
  type UseAgentReturn,
} from "./useAgent";

// Knowledge Base
export {
  useKnowledgeBase,
  type UseKnowledgeBaseConfig,
} from "./useKnowledgeBase";

// Capabilities Hooks (for multi-provider support)
export {
  useCapabilities,
  useFeatureSupport,
  useSupportedMediaTypes,
  type ProviderCapabilities,
  type CapabilitiesResponse,
} from "./useCapabilities";

// Dev Logger
export { useDevLogger, type DevLoggerState } from "./useDevLogger";
