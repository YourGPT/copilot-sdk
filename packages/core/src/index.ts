/**
 * @yourgpt/core
 *
 * Core types and utilities for YourGPT Copilot SDK
 */

// ============================================
// Smart Context Tools (Unique to YourGPT)
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
} from "./tools";

// ============================================
// Core Types
// ============================================

// Types
export type {
  // Message types
  MessageRole,
  Message,
  MessageAttachment,
  Source,
  ToolCall,
  ToolResult,
  // Config types
  LLMProvider,
  LLMConfig,
  CloudConfig,
  Extension,
  YourGPTConfig,
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
  // Knowledge Base types (generic)
  KnowledgeBaseProvider,
  KnowledgeBaseConfig,
  KnowledgeBaseResult,
  KnowledgeBaseSearchRequest,
  KnowledgeBaseSearchResponse,
  // YourGPT Knowledge Base types (internal API)
  YourGPTKnowledgeBaseConfig,
  YourGPTKnowledgeBaseResult,
  YourGPTKnowledgeBaseSearchResponse,
  // Thread types
  Thread,
  ThreadData,
  PersistenceConfig,
  ThreadStorageAdapter,
  // Tool types (Agentic Loop)
  AIProvider,
  ToolLocation,
  JSONSchemaProperty,
  ToolInputSchema,
  ToolContext,
  ToolResponse,
  ToolRenderProps,
  ToolDefinition,
  UnifiedToolCall,
  UnifiedToolResult,
  ToolExecutionStatus,
  ToolApprovalStatus,
  ToolExecution,
  AgentLoopConfig,
  AgentLoopState,
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
  createMessage,
  actionToTool,
  parseStreamEvent,
  serializeStreamEvent,
  formatSSE,
  getDefaultModel,
  DEFAULT_MODELS,
  // Tool functions
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

// System Prompt
export { defaultSystemMessage } from "./system-prompt";
export type { SystemMessageFunction } from "./system-prompt";
