import type { Source } from "@yourgpt/copilot-sdk-core";

/**
 * Knowledge Base configuration
 */
export interface KnowledgeBaseConfig {
  /** API key */
  apiKey: string;
  /** Bot ID with knowledge base configured */
  botId: string;
  /** Custom API endpoint (optional) */
  endpoint?: string;
}

/**
 * Knowledge base search options
 */
export interface SearchOptions {
  /** Maximum number of results */
  limit?: number;
  /** Minimum relevance score (0-1) */
  minScore?: number;
  /** Filter by metadata */
  filter?: Record<string, unknown>;
}

/**
 * Chat with knowledge base options
 */
export interface ChatWithKBOptions {
  /** The user's query */
  query: string;
  /** Conversation history */
  messages?: Array<{ role: string; content: string }>;
  /** Search options */
  searchOptions?: SearchOptions;
  /** Stream the response */
  stream?: boolean;
}

/**
 * Knowledge base search result
 */
export interface SearchResult {
  sources: Source[];
  query: string;
}

/**
 * Knowledge Base API Client
 */
export class KnowledgeBase {
  private config: KnowledgeBaseConfig;
  private baseUrl: string;

  constructor(config: KnowledgeBaseConfig) {
    this.config = config;
    this.baseUrl = config.endpoint || "https://api.yourgpt.ai/v1";
  }

  /**
   * Get default headers for API requests
   */
  private getHeaders(): Record<string, string> {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.config.apiKey}`,
    };
  }

  /**
   * Search the knowledge base
   */
  async search(query: string, options?: SearchOptions): Promise<SearchResult> {
    const response = await fetch(`${this.baseUrl}/knowledge/search`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify({
        botId: this.config.botId,
        query,
        limit: options?.limit || 5,
        minScore: options?.minScore || 0.5,
        filter: options?.filter,
      }),
    });

    if (!response.ok) {
      throw new Error(`Knowledge base search failed: ${response.status}`);
    }

    const data = await response.json();

    return {
      sources: data.sources || data.results || [],
      query,
    };
  }

  /**
   * Get streaming chat URL with knowledge base context
   */
  getStreamingUrl(): string {
    return `${this.baseUrl}/chat/stream`;
  }

  /**
   * Chat with knowledge base (streaming)
   */
  async *chatStream(
    options: ChatWithKBOptions,
  ): AsyncGenerator<{ type: string; content?: string; sources?: Source[] }> {
    const response = await fetch(this.getStreamingUrl(), {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify({
        botId: this.config.botId,
        messages: [
          ...(options.messages || []),
          { role: "user", content: options.query },
        ],
        useKnowledgeBase: true,
        searchOptions: options.searchOptions,
      }),
    });

    if (!response.ok) {
      throw new Error(`Chat failed: ${response.status}`);
    }

    if (!response.body) {
      throw new Error("No response body");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6).trim();
        if (data === "[DONE]") return;

        try {
          const event = JSON.parse(data);
          yield event;
        } catch {
          // Skip invalid JSON
        }
      }
    }
  }

  /**
   * Chat with knowledge base (non-streaming)
   */
  async chat(options: ChatWithKBOptions): Promise<{
    content: string;
    sources: Source[];
  }> {
    const response = await fetch(`${this.baseUrl}/chat`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify({
        botId: this.config.botId,
        messages: [
          ...(options.messages || []),
          { role: "user", content: options.query },
        ],
        useKnowledgeBase: true,
        searchOptions: options.searchOptions,
        stream: false,
      }),
    });

    if (!response.ok) {
      throw new Error(`Chat failed: ${response.status}`);
    }

    const data = await response.json();

    return {
      content: data.content || data.message || "",
      sources: data.sources || [],
    };
  }
}

/**
 * Create Knowledge Base client
 */
export function createKnowledgeBaseClient(
  config: KnowledgeBaseConfig,
): KnowledgeBase {
  return new KnowledgeBase(config);
}
