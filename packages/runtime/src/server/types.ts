import type {
  LLMConfig,
  ActionDefinition,
  KnowledgeBaseConfig,
  ToolDefinition,
  AgentLoopConfig,
} from "@yourgpt/copilot-sdk-core";
import type { LLMAdapter } from "../adapters";
import type { AIProvider } from "../providers/types";

/**
 * Runtime configuration with LLM config
 */
export interface RuntimeConfigWithLLM {
  /** LLM configuration */
  llm: LLMConfig & { apiKey: string };
  /** Custom LLM adapter (overrides llm config) */
  adapter?: LLMAdapter;
  /** System prompt */
  systemPrompt?: string;
  /** Available actions (legacy) */
  actions?: ActionDefinition[];
  /** Available tools (new - supports location: server/client) */
  tools?: ToolDefinition[];
  /** Agent loop configuration */
  agentLoop?: AgentLoopConfig;
  /** Knowledge base configuration (enables search_knowledge tool) */
  knowledgeBase?: KnowledgeBaseConfig;
  /** Enable debug logging */
  debug?: boolean;
}

/**
 * Runtime configuration with adapter
 */
export interface RuntimeConfigWithAdapter {
  /** Custom LLM adapter */
  adapter: LLMAdapter;
  /** LLM configuration (optional when adapter provided) */
  llm?: LLMConfig & { apiKey: string };
  /** System prompt */
  systemPrompt?: string;
  /** Available actions (legacy) */
  actions?: ActionDefinition[];
  /** Available tools (new - supports location: server/client) */
  tools?: ToolDefinition[];
  /** Agent loop configuration */
  agentLoop?: AgentLoopConfig;
  /** Knowledge base configuration (enables search_knowledge tool) */
  knowledgeBase?: KnowledgeBaseConfig;
  /** Enable debug logging */
  debug?: boolean;
}

/**
 * Runtime configuration with AIProvider
 *
 * @example
 * ```typescript
 * import { createOpenAI } from '@yourgpt/copilot-sdk-runtime/providers';
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
  /** Agent loop configuration */
  agentLoop?: AgentLoopConfig;
  /** Knowledge base configuration (enables search_knowledge tool) */
  knowledgeBase?: KnowledgeBaseConfig;
  /** Enable debug logging */
  debug?: boolean;
}

/**
 * Runtime configuration - either provide llm config, adapter, or provider
 */
export type RuntimeConfig =
  | RuntimeConfigWithLLM
  | RuntimeConfigWithAdapter
  | RuntimeConfigWithProvider;

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
  config?: Partial<LLMConfig>;
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
    inputSchema: {
      type: "object";
      properties: Record<string, unknown>;
      required?: string[];
    };
  }>;
  /** Enable agentic loop mode */
  useAgentLoop?: boolean;
  /** Enable streaming responses (default: true). Set to false for non-streaming mode. */
  streaming?: boolean;
  /** YourGPT Knowledge Base configuration (enables search_knowledge tool) */
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
