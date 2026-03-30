// Runtime
export { Runtime, createRuntime } from "./runtime";
export type {
  RuntimeConfig,
  ToolSearchConfig,
  ChatRequest,
  ActionRequest,
  RequestContext,
  HandleRequestOptions,
  HandleRequestResult,
  GenerateOptions,
} from "./types";

// StreamResult (Industry Standard Pattern)
export {
  StreamResult,
  createStreamResult,
  type StreamResultOptions,
  type CollectedResult,
} from "./stream-result";

// GenerateResult (Non-streaming)
export {
  GenerateResult,
  type GenerateResultData,
  type CopilotChatResponse,
} from "./generate-result";

// Streaming utilities
export {
  createSSEHeaders,
  createTextStreamHeaders,
  formatSSEData,
  createEventStream,
  createSSEResponse,
  createTextStreamResponse,
  pipeSSEToResponse,
  pipeTextToResponse,
} from "./streaming";

// Framework integrations
export {
  createHonoApp,
  createNextHandler,
  createExpressMiddleware,
  createExpressHandler,
  createNodeHandler,
} from "./integrations";

// Agent loop
export {
  runAgentLoop,
  DEFAULT_MAX_ITERATIONS,
  type AgentLoopOptions,
} from "./agent-loop";

// Tool selection
export {
  selectTools,
  searchTools,
  shouldExposeToolSearch,
  buildProviderToolOptions,
} from "./tool-selection";
export type { ToolSearchMatch } from "./tool-selection";

// Storage helpers (used internally by Runtime, exposed for custom server setups)
export { extractInputMessages, mapOutputMessages } from "./storage-helpers";
