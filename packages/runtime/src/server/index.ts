export { Runtime, createRuntime } from "./runtime";
export type {
  RuntimeConfig,
  ChatRequest,
  ActionRequest,
  RequestContext,
} from "./types";
export {
  createSSEHeaders,
  formatSSEData,
  createEventStream,
  createSSEResponse,
} from "./streaming";
export {
  createHonoApp,
  createNextHandler,
  createExpressMiddleware,
  createNodeHandler,
} from "./integrations";

// Agent loop
export {
  runAgentLoop,
  DEFAULT_MAX_ITERATIONS,
  type AgentLoopOptions,
} from "./agent-loop";

// Knowledge Base (server-side)
export {
  searchKnowledgeBase,
  formatKnowledgeResultsForAI,
  KNOWLEDGE_BASE_SYSTEM_INSTRUCTION,
  type YourGPTKBConfig,
  type KBSearchResult,
  type KBSearchResponse,
} from "./knowledge-base";
