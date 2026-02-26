/**
 * Web Search - Shared Types and Utilities
 *
 * This module exports shared types and utility functions for web search tools.
 * Import from this module when you need access to types without any provider.
 *
 * @example
 * ```typescript
 * import type { WebSearchConfig, WebSearchResponse } from '@yourgpt/copilot-sdk/tools/web-search';
 * import { formatSearchResultsForAI } from '@yourgpt/copilot-sdk/tools/web-search';
 * ```
 *
 * @module @yourgpt/copilot-sdk/tools/web-search
 */

// ============================================
// Re-export Types
// ============================================

export type {
  WebSearchConfig,
  WebSearchParams,
  WebSearchResult,
  WebSearchResponse,
  WebSearchImage,
  WebSearchProvider,
  WebSearchProviderInterface,
} from "../../core/tools/webSearch/types";

// ============================================
// Re-export Utilities
// ============================================

export {
  formatSearchResultsForAI,
  summarizeSearchResults,
} from "../../core/tools/webSearch";

// ============================================
// Re-export Base Tool Definition
// ============================================

export { webSearchTool } from "../../core/tools/builtin/webSearch";
