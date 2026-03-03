/**
 * Smart Context Tools
 *
 * Framework-agnostic tools for capturing app context:
 * - Screenshot capture
 * - Console log interception
 * - Network request capture
 * - Intent detection
 */

// Types
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
} from "./types";

// Screenshot
export {
  captureScreenshot,
  isScreenshotSupported,
  resizeScreenshot,
} from "./screenshot";

// Console
export {
  startConsoleCapture,
  stopConsoleCapture,
  getConsoleLogs,
  clearConsoleLogs,
  isConsoleCaptureActive,
  getConsoleErrors,
  getConsoleWarnings,
  formatLogsForAI,
  captureCurrentLogs,
} from "./console";

// Network
export {
  startNetworkCapture,
  stopNetworkCapture,
  getNetworkRequests,
  clearNetworkRequests,
  isNetworkCaptureActive,
  getFailedRequests,
  formatRequestsForAI,
} from "./network";

// Intent Detection
export {
  detectIntent,
  hasToolSuggestions,
  getPrimaryTool,
  generateSuggestionReason,
  createCustomDetector,
} from "./intentDetector";

export type { CustomKeywords } from "./intentDetector";

// Built-in Tools (pre-configured tools for common operations)
export {
  // Individual tools
  screenshotTool,
  consoleLogsTool,
  networkRequestsTool,
  webSearchTool,
  // Factory functions for custom configs
  createScreenshotTool,
  createConsoleLogsTool,
  createNetworkRequestsTool,
  createWebSearchTool,
  // All tools as a ToolSet
  builtinTools,
} from "./builtin";

// Web Search module (multi-provider search)
export {
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
} from "./webSearch";

export type {
  // Web Search types
  WebSearchProvider,
  WebSearchConfig,
  WebSearchConfigExtended,
  WebSearchParams,
  WebSearchResult,
  WebSearchImage,
  WebSearchResponse,
  WebSearchProviderInterface,
} from "./webSearch";
