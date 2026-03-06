/**
 * Knowledge Base Module
 *
 * Provides knowledge base (RAG) integration with YourGPT's searchIndexDocument API.
 * This module is tree-shakeable - only import what you need.
 *
 * @example
 * ```tsx
 * // Option 1: Use via CopilotProvider config (recommended)
 * import { CopilotProvider } from "@yourgpt/copilot-sdk/react";
 *
 * <CopilotProvider
 *   runtimeUrl="/api/copilot"
 *   knowledgeBase={{
 *     apiKey: "your-yourgpt-api-key",
 *     limit: 10,
 *   }}
 * >
 *   {children}
 * </CopilotProvider>
 *
 * // Option 2: Use hook directly
 * import { useKnowledgeBase } from "@yourgpt/copilot-sdk/knowledge";
 *
 * function MyComponent() {
 *   useKnowledgeBase({
 *     apiKey: "your-yourgpt-api-key",
 *     limit: 10,
 *   });
 *   return <CopilotChat />;
 * }
 *
 * // Option 3: Manual search
 * import { searchKnowledgeBase } from "@yourgpt/copilot-sdk/knowledge";
 *
 * const results = await searchKnowledgeBase("How to reset password?", {
 *   apiKey: "your-api-key",
 * });
 * ```
 *
 * @see https://docs.yourgpt.ai/chatbot/developer-guide/api-reference/chatbot/searchIndexDocument
 */

// Hook
export { useKnowledgeBase } from "../react/hooks/useKnowledgeBase";

// Utility functions
export {
  searchKnowledgeBase,
  formatKnowledgeResultsForAI,
  KNOWLEDGE_BASE_SYSTEM_INSTRUCTION,
} from "../react/utils/knowledge-base";

// Types
export type {
  KnowledgeBaseConfig,
  KnowledgeBaseResult,
  KnowledgeBaseSearchResponse,
  KnowledgeBaseAPIResponse,
} from "../core/types/knowledge";
