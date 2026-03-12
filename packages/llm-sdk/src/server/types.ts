import type {
  ActionDefinition,
  KnowledgeBaseConfig,
  ToolDefinition,
  ToolProfile,
  WebSearchConfig,
} from "../core/stream-events";
import type { LLMAdapter } from "../adapters";
import type { AIProvider } from "../providers/types";

/**
 * Tool search/discovery configuration.
 * Controls the `search_tools` meta-tool that lets the AI discover deferred tools.
 *
 * Tools marked with `deferLoading: true` are excluded from the default context
 * and loaded on demand when the AI calls `search_tools`.
 */
export interface ToolSearchConfig {
  /**
   * Custom description for the search_tools meta-tool shown to the AI.
   */
  description?: string;
  /**
   * Custom name for the search meta-tool (default: "search_tools").
   */
  name?: string;
  /**
   * Max eager tools sent to the AI per request (default: 20).
   * Tools beyond this limit are deferred and discoverable via search.
   */
  maxEagerTools?: number;
  /**
   * Max deferred tools returned per search query (default: 8).
   */
  maxResults?: number;
  /**
   * Expose the search tool when total tool count exceeds this number (default: 8).
   */
  exposeWhenExceeds?: number;
  /**
   * How the AI should choose tools.
   * - "auto": model decides whether to use a tool (default)
   * - "required": model must call at least one tool
   */
  toolChoice?: "auto" | "required";
  /**
   * Allow the model to call multiple tools in a single turn (default: true).
   * Set false to force one tool call at a time.
   */
  parallelCalls?: boolean;
  /**
   * Default active profile when none is provided in the request.
   */
  defaultProfile?: string;
  /**
   * Named tool profiles with include/exclude selectors.
   * Profiles filter which tools are visible to the AI per request.
   */
  profiles?: Record<string, ToolProfile>;
  /**
   * When a profile is active, include tools with no profile membership (default: true).
   */
  includeUnprofiled?: boolean;
}

/**
 * Runtime configuration with adapter (advanced usage)
 */
export interface RuntimeConfigWithAdapter {
  /** Custom LLM adapter */
  adapter: LLMAdapter;
  /** System prompt */
  systemPrompt?: string;
  /** Available actions (legacy) */
  actions?: ActionDefinition[];
  /** Available tools (new - supports location: server/client) */
  tools?: ToolDefinition[];
  /**
   * Max agent loop iterations before stopping (default: 20).
   */
  maxIterations?: number;
  /**
   * Configure deferred tool discovery. Tools with `deferLoading: true` are
   * excluded from the default context and discoverable via the search meta-tool.
   */
  toolSearch?: ToolSearchConfig;
  /** Knowledge base configuration (enables search_knowledge tool) */
  knowledgeBase?: KnowledgeBaseConfig;
  /** Enable debug logging */
  debug?: boolean;
  /** Custom context data passed to all tool handlers */
  toolContext?: Record<string, unknown>;
  /**
   * Enable native web search for the provider.
   * Set to true for defaults, or pass WebSearchConfig for customization.
   */
  webSearch?: boolean | WebSearchConfig;
}

/**
 * Runtime configuration with AIProvider
 *
 * @example
 * ```typescript
 * import { createOpenAI } from '@yourgpt/llm-sdk';
 *
 * const openai = createOpenAI({ apiKey: '...' });
 * const runtime = createRuntime({
 *   provider: openai,
 *   model: 'gpt-4o',
 * });
 * ```
 */
export interface RuntimeConfigWithProvider {
  /** AI Provider instance */
  provider: AIProvider;
  /** Model ID to use (required when using provider) */
  model: string;
  /** System prompt */
  systemPrompt?: string;
  /** Available actions (legacy) */
  actions?: ActionDefinition[];
  /** Available tools (new - supports location: server/client) */
  tools?: ToolDefinition[];
  /**
   * Max agent loop iterations before stopping (default: 20).
   */
  maxIterations?: number;
  /**
   * Configure deferred tool discovery. Tools with `deferLoading: true` are
   * excluded from the default context and discoverable via the search meta-tool.
   */
  toolSearch?: ToolSearchConfig;
  /** Knowledge base configuration (enables search_knowledge tool) */
  knowledgeBase?: KnowledgeBaseConfig;
  /** Enable debug logging */
  debug?: boolean;
  /** Custom context data passed to all tool handlers */
  toolContext?: Record<string, unknown>;
  /**
   * Enable native web search for the provider.
   * Set to true for defaults, or pass WebSearchConfig for customization.
   */
  webSearch?: boolean | WebSearchConfig;
}

/**
 * Runtime configuration - provide either a provider instance or a custom adapter
 *
 * @example
 * ```typescript
 * // Recommended: Use provider instance
 * const runtime = createRuntime({
 *   provider: createOpenAI({ apiKey: process.env.OPENAI_API_KEY }),
 *   model: 'gpt-4o',
 * });
 *
 * // Advanced: Use custom adapter
 * const runtime = createRuntime({
 *   adapter: myCustomAdapter,
 * });
 * ```
 */
export type RuntimeConfig =
  | RuntimeConfigWithProvider
  | RuntimeConfigWithAdapter;

/**
 * Message attachment (images, files, etc.)
 */
export interface MessageAttachment {
  type: "image" | "file" | "audio" | "video";
  data: string;
  mimeType?: string;
  filename?: string;
}

/**
 * Chat request body
 */
export interface ChatRequest {
  /** Conversation messages */
  messages: Array<{
    role: string;
    content: string;
    /** Attachments like images (for vision support) */
    attachments?: MessageAttachment[];
    /** Tool call ID (for tool result messages) */
    tool_call_id?: string;
    /** Tool calls from assistant (for continuing agent loop) */
    tool_calls?: Array<{
      id: string;
      type: string;
      function: { name: string; arguments: string };
    }>;
  }>;
  /** Thread/conversation ID */
  threadId?: string;
  /** Bot ID (for cloud) */
  botId?: string;
  /** LLM config overrides */
  config?: { temperature?: number; maxTokens?: number };
  /** System prompt override */
  systemPrompt?: string;
  /** Actions from client (legacy) */
  actions?: Array<{
    name: string;
    description: string;
    parameters?: Record<string, unknown>;
  }>;
  /** Tools from client (location is always "client" for tools from request) */
  tools?: Array<{
    name: string;
    description: string;
    category?: string;
    group?: string;
    deferLoading?: boolean;
    profiles?: string[];
    searchKeywords?: string[];
    inputSchema: {
      type: "object";
      properties: Record<string, unknown>;
      required?: string[];
    };
  }>;
  /** Active tool profile to apply (filters tools by profile when toolSearch is configured). */
  toolProfile?: string;
  /** Enable agentic loop mode */
  useAgentLoop?: boolean;
  /** Enable streaming responses (default: true). Set to false for non-streaming mode. */
  streaming?: boolean;
  /** Knowledge Base configuration (enables search_knowledge tool) */
  knowledgeBase?: {
    /** Project UID for the knowledge base */
    projectUid: string;
    /** Auth token for API calls */
    token: string;
    /** App ID (default: "1") */
    appId?: string;
    /** Results limit (default: 5) */
    limit?: number;
  };
}

/**
 * Action execution request
 */
export interface ActionRequest {
  /** Action name */
  name: string;
  /** Action arguments */
  args: Record<string, unknown>;
}

/**
 * Request context
 */
export interface RequestContext {
  /** Request headers */
  headers: Record<string, string>;
  /** Parsed request body */
  body: ChatRequest;
}

// ============================================
// Handle Request Options (for onFinish callback)
// ============================================

import type { DoneEventMessage } from "../core/stream-events";

/**
 * Result passed to onFinish callback after stream completes
 */
export interface HandleRequestResult {
  /** All messages from this request (assistant messages + tool results) */
  messages: DoneEventMessage[];
  /** Thread ID if provided in request */
  threadId?: string;
  /** Token usage information */
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

/**
 * Options for handleRequest method
 *
 * @example
 * ```typescript
 * runtime.handleRequest(request, {
 *   onFinish: async ({ messages, threadId }) => {
 *     await db.thread.upsert({
 *       where: { id: threadId },
 *       update: { messages, updatedAt: new Date() },
 *       create: { id: threadId, messages },
 *     });
 *   },
 * });
 * ```
 */
export interface HandleRequestOptions {
  /**
   * Called after the stream completes successfully.
   * Use this for server-side persistence of messages.
   */
  onFinish?: (result: HandleRequestResult) => Promise<void> | void;
}

/**
 * Options for runtime.generate()
 *
 * @example
 * ```typescript
 * const result = await runtime.generate(body, {
 *   onFinish: async ({ messages }) => {
 *     await db.saveMessages(messages);
 *   },
 * });
 * ```
 */
export interface GenerateOptions {
  /** AbortSignal for cancellation */
  signal?: AbortSignal;
  /** HTTP request for extracting headers (auth context) */
  httpRequest?: Request;
  /**
   * Called after generation completes successfully.
   * Use for server-side persistence.
   */
  onFinish?: (result: HandleRequestResult) => Promise<void> | void;
}
