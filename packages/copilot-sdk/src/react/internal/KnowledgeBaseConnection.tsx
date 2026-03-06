"use client";

/**
 * KnowledgeBaseConnection
 *
 * Internal component that auto-registers the knowledge base tool
 * when configured in CopilotProvider.
 *
 * Similar to MCPConnection, this is rendered by CopilotProvider
 * when knowledgeBase config is provided.
 */

import { useKnowledgeBase } from "../hooks/useKnowledgeBase";
import type { KnowledgeBaseConfig } from "../../core";

interface KnowledgeBaseConnectionProps {
  config: KnowledgeBaseConfig;
}

/**
 * Internal component that registers the knowledge base tool
 *
 * This component is rendered by CopilotProvider when knowledgeBase
 * config is provided. It uses the useKnowledgeBase hook to register
 * the hidden search tool.
 */
export function KnowledgeBaseConnection({
  config,
}: KnowledgeBaseConnectionProps) {
  useKnowledgeBase(config);
  return null;
}
