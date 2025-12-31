import type { Extension } from "@yourgpt/copilot-sdk-core";
import type { KnowledgeBaseConfig } from "./client/yourgpt-api";

/**
 * Knowledge Base Extension configuration
 */
export interface KnowledgeBaseExtensionConfig extends KnowledgeBaseConfig {
  /** Auto-retrieve relevant documents for each query */
  autoRetrieve?: boolean;
  /** Number of documents to retrieve */
  retrieveCount?: number;
  /** Minimum relevance score */
  minScore?: number;
}

/**
 * Create Knowledge Base Extension for CopilotProvider
 *
 * @example
 * ```tsx
 * import { CopilotProvider } from '@yourgpt/copilot-sdk-react';
 * import { KnowledgeBaseExtension } from '@yourgpt/copilot-sdk-knowledge';
 *
 * <CopilotProvider
 *   config={{ provider: 'openai', apiKey: '...' }}
 *   extensions={[
 *     KnowledgeBaseExtension({
 *       apiKey: 'yg_...',
 *       botId: 'bot_123',
 *       autoRetrieve: true,
 *     }),
 *   ]}
 * >
 *   <ChatWindow showSources={true} />
 * </CopilotProvider>
 * ```
 */
export function KnowledgeBaseExtension(
  config: KnowledgeBaseExtensionConfig,
): Extension {
  return {
    name: "knowledge-base",
    config: {
      apiKey: config.apiKey,
      botId: config.botId,
      endpoint: config.endpoint,
      autoRetrieve: config.autoRetrieve ?? true,
      retrieveCount: config.retrieveCount ?? 5,
      minScore: config.minScore ?? 0.5,
    },
    init: async () => {
      // Validate configuration
      if (!config.apiKey) {
        throw new Error("Knowledge base extension requires an API key");
      }
      if (!config.botId) {
        throw new Error("Knowledge base extension requires a bot ID");
      }

      // Could perform initial connection test here
      console.log("[Copilot SDK] Knowledge base extension initialized");
    },
  };
}

/**
 * Check if knowledge base extension is enabled in config
 */
export function hasKnowledgeBaseExtension(extensions?: Extension[]): boolean {
  return extensions?.some((ext) => ext.name === "knowledge-base") ?? false;
}

/**
 * Get knowledge base config from extensions
 */
export function getKnowledgeBaseConfig(
  extensions?: Extension[],
): KnowledgeBaseExtensionConfig | null {
  const ext = extensions?.find((e) => e.name === "knowledge-base");
  if (!ext) return null;

  const config = ext.config as unknown as KnowledgeBaseExtensionConfig;
  return config;
}
