/**
 * Knowledge Base Types
 *
 * Configuration and types for Knowledge Base (RAG) integration
 * with YourGPT's searchIndexDocument API.
 *
 * @see https://docs.yourgpt.ai/chatbot/developer-guide/api-reference/chatbot/searchIndexDocument
 */

// ============================================
// Knowledge Base Configuration
// ============================================

/**
 * Knowledge Base configuration for CopilotProvider
 *
 * Uses YourGPT's searchIndexDocument API for semantic search
 * across your project's trained knowledge base.
 *
 * @example
 * ```tsx
 * <CopilotProvider
 *   runtimeUrl="/api/copilot"
 *   knowledgeBase={{
 *     apiKey: "your-yourgpt-api-key",
 *     limit: 10,
 *   }}
 * >
 *   {children}
 * </CopilotProvider>
 * ```
 */
export interface KnowledgeBaseConfig {
  /**
   * API key for authentication.
   * Generate from Integration settings in your YourGPT dashboard.
   */
  apiKey: string;

  /**
   * Maximum results to return (default: 10, max: 100)
   */
  limit?: number;

  /**
   * Whether KB search is enabled (default: true)
   */
  enabled?: boolean;

  /**
   * Custom tool name (default: "search_knowledge")
   */
  toolName?: string;

  /**
   * Custom tool description for the AI
   */
  toolDescription?: string;

  /**
   * Hide the tool card from the chat UI (default: false)
   * When true, the tool executes but no card is shown
   */
  hidden?: boolean;
}

/**
 * Props passed to the knowledge base render function
 */
export interface KnowledgeBaseRenderProps {
  /** The search query that was used */
  query: string;

  /** Whether the search is currently loading */
  isLoading: boolean;

  /** Search results (empty array while loading or if no results) */
  results: KnowledgeBaseResult[];

  /** Error message if the search failed */
  error?: string;

  /** Total number of results */
  total: number;
}

// ============================================
// Search Result Types
// ============================================

/**
 * Individual search result from the knowledge base
 *
 * Maps to the API response structure from searchIndexDocument
 */
export interface KnowledgeBaseResult {
  /** Unique point ID in the vector store */
  pointId: string;

  /** Document ID */
  docId: string;

  /** Relevance score (higher = more relevant) */
  score: number;

  /** Matched content chunk */
  content: string;
}

/**
 * API response from searchIndexDocument
 */
export interface KnowledgeBaseAPIResponse {
  /** Response type */
  type: "RXSUCCESS" | "RXERROR";

  /** Response message */
  message: string;

  /** Search results */
  data: Array<{
    point_id: string;
    doc_id: string;
    score: number;
    content: string;
  }>;
}

/**
 * Internal search response format
 */
export interface KnowledgeBaseSearchResponse {
  /** Whether the search was successful */
  success: boolean;

  /** Normalized search results */
  results: KnowledgeBaseResult[];

  /** Total number of results */
  total: number;

  /** Error message if failed */
  error?: string;
}

// ============================================
// Legacy Types (Deprecated)
// ============================================

/**
 * @deprecated Use KnowledgeBaseConfig instead
 */
export interface InternalKnowledgeBaseConfig {
  projectUid: string;
  token: string;
  appId?: string;
  limit?: number;
  enabled?: boolean;
}

/**
 * @deprecated Use KnowledgeBaseResult instead
 */
export interface InternalKnowledgeBaseResult {
  id: string;
  title?: string;
  content: string;
  score?: number;
  url?: string;
  metadata?: Record<string, unknown>;
}

/**
 * @deprecated Use KnowledgeBaseSearchResponse instead
 */
export interface InternalKnowledgeBaseSearchResponse {
  success: boolean;
  results: InternalKnowledgeBaseResult[];
  total?: number;
  error?: string;
}
