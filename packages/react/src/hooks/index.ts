// AI Hooks (Tiered API)
// Free tier - limited API for component users
export { useAIChat, useIsPremium, type UseAIChatReturn } from "./useAIChat";

// Premium tier - full headless access (requires YourGPT API key)
export {
  useAIChatHeadless,
  useAIChatHeadless_c,
  YourGPTError,
  YourGPTErrorCode,
  type UseAIChatHeadlessReturn,
} from "./useAIChatHeadless";

// Note: useAIChatInternal is NOT exported (internal implementation only)

export { useAIAction, useAIActions } from "./useAIAction";
export {
  useAIContext,
  useAIContexts,
  type AIContextItem,
} from "./useAIContext";
export {
  useAITools,
  generateSuggestionReason,
  type UseAIToolsOptions,
  type UseAIToolsReturn,
} from "./useAITools";
export { useThreads } from "./useThreads";

// Tool Hooks (Agentic Loop)
export { useTool, useTools, type UseToolConfig } from "./useTool";
export {
  useToolWithSchema,
  useToolsWithSchema,
  type UseToolWithSchemaConfig,
} from "./useToolWithSchema";
export { useToolExecutor, type UseToolExecutorReturn } from "./useToolExecutor";

// Other hooks
export {
  useSuggestions,
  type UseSuggestionsOptions,
  type UseSuggestionsReturn,
  type Suggestion,
} from "./useSuggestions";
export {
  useAgent,
  type UseAgentOptions,
  type UseAgentReturn,
} from "./useAgent";
export {
  useKnowledgeBase,
  type UseKnowledgeBaseConfig,
} from "./useKnowledgeBase";

// Note: useScreenshotTool is NOT exported - screenshot tool is auto-registered
// when toolsConfig.screenshot = true in YourGPTProvider

// Capabilities Hooks (for multi-provider support)
export {
  useCapabilities,
  useFeatureSupport,
  useSupportedMediaTypes,
  type ProviderCapabilities,
  type CapabilitiesResponse,
} from "./useCapabilities";
