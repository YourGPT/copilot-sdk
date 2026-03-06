/**
 * @yourgpt/copilot-sdk-core
 *
 * Core types and utilities for Copilot SDK
 */

// ============================================
// Smart Context Tools
// ============================================
export {
  // Screenshot
  captureScreenshot,
  isScreenshotSupported,
  resizeScreenshot,
  // Console
  startConsoleCapture,
  stopConsoleCapture,
  getConsoleLogs,
  clearConsoleLogs,
  isConsoleCaptureActive,
  getConsoleErrors,
  getConsoleWarnings,
  formatLogsForAI,
  captureCurrentLogs,
  // Network
  startNetworkCapture,
  stopNetworkCapture,
  getNetworkRequests,
  clearNetworkRequests,
  isNetworkCaptureActive,
  getFailedRequests,
  formatRequestsForAI,
  // Intent Detection
  detectIntent,
  hasToolSuggestions,
  getPrimaryTool,
  generateSuggestionReason,
  createCustomDetector,
  // Built-in Tools (pre-configured)
  screenshotTool,
  consoleLogsTool,
  networkRequestsTool,
  webSearchTool,
  createScreenshotTool,
  createConsoleLogsTool,
  createNetworkRequestsTool,
  createWebSearchTool,
  builtinTools,
  // Web Search module
  executeWebSearch,
  getProvider,
  getAvailableProviders,
  formatSearchResultsForAI,
  summarizeSearchResults,
  // Native providers (no third-party API needed)
  openaiProvider,
  googleProvider,
  anthropicProvider,
  // Third-party providers
  tavilyProvider,
  serperProvider,
  braveProvider,
  searxngProvider,
  exaProvider,
} from "./tools";

export type {
  // Screenshot types
  ScreenshotOptions,
  ScreenshotResult,
  // Console types
  ConsoleLogType,
  ConsoleLogEntry,
  ConsoleLogOptions,
  ConsoleLogResult,
  // Network types
  HttpMethod,
  NetworkRequestEntry,
  NetworkRequestOptions,
  NetworkRequestResult,
  // Intent types
  ToolType,
  IntentDetectionResult,
  // Config types
  ToolsConfig,
  ToolConsentRequest,
  ToolConsentResponse,
  CapturedContext,
  CustomKeywords,
  // Web Search types
  WebSearchProvider,
  WebSearchConfig,
  WebSearchParams,
  WebSearchResult,
  WebSearchImage,
  WebSearchResponse,
  WebSearchProviderInterface,
} from "./tools";

// ============================================
// Core Types
// ============================================

// Types
export type {
  // Message types (OpenAI format)
  MessageRole,
  Message,
  MessageMetadata,
  MessageAttachment,
  Source,
  ToolCall,
  TokenUsage,
  // Config types
  LLMConfig,
  CloudConfig,
  Extension,
  CopilotConfig,
  // Action types
  ParameterType,
  ActionParameter,
  ActionDefinition,
  ActionRenderProps,
  // Event types
  StreamEventType,
  StreamEvent,
  MessageStartEvent,
  MessageDeltaEvent,
  MessageEndEvent,
  SourceAddEvent,
  ActionStartEvent,
  ActionArgsEvent,
  ActionEndEvent,
  ToolCallsEvent,
  ToolCallInfo,
  AssistantToolMessage,
  ToolStatusEvent,
  ToolResultEvent,
  LoopIterationEvent,
  LoopCompleteEvent,
  ErrorEvent,
  DoneEvent,
  DoneEventMessage,
  // Knowledge Base types (YourGPT searchIndexDocument API)
  KnowledgeBaseConfig,
  KnowledgeBaseResult,
  KnowledgeBaseSearchResponse,
  KnowledgeBaseAPIResponse,
  // Legacy Knowledge Base types (deprecated)
  InternalKnowledgeBaseConfig,
  InternalKnowledgeBaseResult,
  InternalKnowledgeBaseSearchResponse,
  // Thread types
  Thread,
  ThreadData,
  PersistenceConfig,
  ThreadStorageAdapter,
  // Tool types (Agentic Loop)
  AIProvider,
  ToolLocation,
  ToolSource,
  JSONSchemaProperty,
  ToolInputSchema,
  ToolContext,
  ToolResponse,
  ToolRenderProps,
  ToolDefinition,
  ToolConfig,
  ToolSet,
  UnifiedToolCall,
  UnifiedToolResult,
  ToolExecutionStatus,
  ToolApprovalStatus,
  ToolExecution,
  AgentLoopConfig,
  AgentLoopState,
  // AI Response Control types
  AIResponseMode,
  AIContent,
  // Permission types (for persistent tool approvals)
  PermissionLevel,
  ToolPermission,
  PermissionStorageConfig,
  PermissionStorageAdapter,
} from "./types";

// Thread title generation
export { generateThreadTitle } from "./types";

// Functions
export {
  // Message functions (OpenAI format)
  createMessage,
  createUserMessage,
  createAssistantMessage,
  createToolMessage,
  createToolCall,
  parseToolCallArgs,
  hasToolCalls,
  isToolResult,
  // Legacy/conversion
  actionToTool,
  parseStreamEvent,
  serializeStreamEvent,
  formatSSE,
  // Tool functions
  tool,
  toolToOpenAIFormat,
  toolToAnthropicFormat,
  createToolResult,
  success,
  failure,
} from "./types";

// Utils
export {
  parseSSELine,
  streamSSE,
  createSSEStream,
  generateId,
  generateMessageId,
  generateThreadId,
  generateToolCallId,
  // Zod utilities
  zodToJsonSchema,
  zodObjectToInputSchema,
  defineTool,
  defineClientTool,
  defineServerTool,
} from "./utils";

export type { DefineToolConfig } from "./utils";

// System Prompt
export { defaultSystemMessage } from "./system-prompt";
export type { SystemMessageFunction } from "./system-prompt";

// ============================================
// Services (Cloud Storage, etc.)
// ============================================
export {
  createCloudStorage,
  processFileToAttachment,
  getAttachmentTypeFromMime,
  CLOUD_MAX_FILE_SIZE,
  DEFAULT_YOURGPT_ENDPOINT,
} from "./services";

export type {
  StorageService,
  StorageConfig,
  UploadResult,
  UploadOptions,
} from "./services";

// ============================================
// Thread Management (Framework-agnostic)
// ============================================
export {
  // ThreadManager
  ThreadManager,
  createThreadManager,
  // Adapters
  createLocalStorageAdapter,
  localStorageAdapter,
  createMemoryAdapter,
  noopAdapter,
  // Interfaces
  SimpleThreadManagerState,
} from "../thread";

export type {
  // ThreadManager types
  ThreadManagerConfig,
  ThreadManagerCallbacks,
  CreateThreadOptions,
  UpdateThreadOptions,
  // Interface types
  ThreadManagerState,
  LoadStatus,
  // Adapter types
  AsyncThreadStorageAdapter,
  LocalStorageAdapterConfig,
  ListThreadsOptions,
  ListThreadsResult,
} from "../thread";
