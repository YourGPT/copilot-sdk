/**
 * Web Search Tool Types
 *
 * Types and interfaces for the multi-provider web search tool.
 */

// ============================================
// Provider Types
// ============================================

/**
 * Supported web search providers
 *
 * Native providers (no third-party API needed):
 * - "openai" - Uses OpenAI's built-in web_search (Responses API)
 * - "google" - Uses Google's grounding with Google Search
 * - "anthropic" - Uses Anthropic's built-in web_search tool
 *
 * Third-party providers:
 * - "tavily" - AI-optimized search with answer generation
 * - "serper" - Google Search API
 * - "brave" - Privacy-focused search
 * - "searxng" - Self-hosted metasearch
 * - "exa" - Semantic AI search
 */
export type WebSearchProvider =
  | "openai"
  | "google"
  | "anthropic"
  | "tavily"
  | "serper"
  | "brave"
  | "searxng"
  | "exa";

// ============================================
// Configuration Types
// ============================================

/**
 * Web search configuration options
 */
export interface WebSearchConfig {
  /** Search provider to use */
  provider: WebSearchProvider;
  /** API key for the provider (not needed for SearXNG self-hosted) */
  apiKey?: string;
  /** Base URL for self-hosted providers (e.g., SearXNG) */
  baseUrl?: string;

  // Search options
  /** Search depth - 'advanced' provides more thorough results (Tavily/Exa) */
  searchDepth?: "basic" | "advanced";
  /** Maximum number of results to return (default: 5) */
  maxResults?: number;

  // Domain filtering (OpenAI-style)
  /** Only include results from these domains */
  includeDomains?: string[];
  /** Exclude results from these domains */
  excludeDomains?: string[];

  // Result options
  /** Include AI-generated answer summary (Tavily) */
  includeAnswer?: boolean;
  /** Include image results */
  includeImages?: boolean;
  /** Include raw page content (Tavily/Exa) */
  includeRawContent?: boolean;

  // Locale settings
  /** Country code for localized results (e.g., 'us', 'gb', 'de') */
  country?: string;
  /** Language code for results (e.g., 'en', 'es', 'fr') */
  language?: string;

  // Request options
  /** Request timeout in milliseconds (default: 30000) */
  timeout?: number;
}

/**
 * Parameters passed to the web search tool
 */
export interface WebSearchParams {
  /** The search query */
  query: string;
  /** Maximum number of results (overrides config) */
  maxResults?: number;
  /** Search depth (overrides config) */
  searchDepth?: "basic" | "advanced";
}

// ============================================
// Result Types
// ============================================

/**
 * A single search result
 */
export interface WebSearchResult {
  /** Page title */
  title: string;
  /** Page URL */
  url: string;
  /** Snippet/excerpt from the page */
  content: string;
  /** Relevance score (0-1, provider-dependent) */
  score?: number;
  /** Publication date if available */
  publishedDate?: string;
  /** Image URL if available */
  image?: string;
  /** Source domain */
  domain?: string;
}

/**
 * Image result from search
 */
export interface WebSearchImage {
  /** Image URL */
  url: string;
  /** Image description/alt text */
  description?: string;
  /** Source page URL */
  sourceUrl?: string;
}

/**
 * Response from web search
 */
export interface WebSearchResponse {
  /** Original search query */
  query: string;
  /** AI-generated answer summary (if provider supports it) */
  answer?: string;
  /** Search results */
  results: WebSearchResult[];
  /** Image results (if requested) */
  images?: WebSearchImage[];
  /** Search provider used */
  provider: WebSearchProvider;
  /** Total number of results found (may be more than returned) */
  totalResults?: number;
  /** Time taken to search in milliseconds */
  searchTime?: number;
}

// ============================================
// Provider-specific Types
// ============================================

/**
 * Tavily API response structure
 */
export interface TavilyApiResponse {
  answer?: string;
  query: string;
  results: {
    title: string;
    url: string;
    content: string;
    score: number;
    published_date?: string;
    raw_content?: string;
  }[];
  images?: {
    url: string;
    description?: string;
  }[];
  response_time?: number;
}

/**
 * Serper API response structure
 */
export interface SerperApiResponse {
  organic: {
    title: string;
    link: string;
    snippet: string;
    position: number;
    date?: string;
    imageUrl?: string;
  }[];
  answerBox?: {
    snippet?: string;
    answer?: string;
  };
  images?: {
    imageUrl: string;
    title: string;
    link: string;
  }[];
  searchParameters?: {
    q: string;
    gl?: string;
    hl?: string;
  };
}

/**
 * Brave Search API response structure
 */
export interface BraveApiResponse {
  query: {
    original: string;
  };
  web?: {
    results: {
      title: string;
      url: string;
      description: string;
      page_age?: string;
      thumbnail?: {
        src: string;
      };
    }[];
  };
  infobox?: {
    title: string;
    description: string;
    url: string;
  };
}

/**
 * SearXNG API response structure
 */
export interface SearxngApiResponse {
  query: string;
  number_of_results: number;
  results: {
    title: string;
    url: string;
    content: string;
    publishedDate?: string;
    img_src?: string;
    engine: string;
    score: number;
  }[];
  answers?: string[];
  infoboxes?: {
    infobox: string;
    content: string;
    urls: { title: string; url: string }[];
  }[];
}

/**
 * Exa API response structure
 */
export interface ExaApiResponse {
  autopromptString?: string;
  results: {
    title: string;
    url: string;
    id: string;
    score: number;
    publishedDate?: string;
    author?: string;
    text?: string;
    highlights?: string[];
    highlightScores?: number[];
  }[];
}

// ============================================
// Provider Interface
// ============================================

/**
 * Provider implementation interface
 */
export interface WebSearchProviderInterface {
  /**
   * Execute a web search using this provider
   */
  search(
    params: WebSearchParams,
    config: WebSearchConfig,
  ): Promise<WebSearchResponse>;

  /**
   * Validate the configuration for this provider
   */
  validateConfig?(config: WebSearchConfig): void;
}
