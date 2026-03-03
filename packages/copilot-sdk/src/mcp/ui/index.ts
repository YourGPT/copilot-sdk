/**
 * MCP-UI Module
 *
 * Provides support for MCP tools that return interactive UI components.
 *
 * @module mcp/ui
 */

export type {
  // Resource types
  MCPUIResource,
  MCPUIResourceContent,
  MCPUIResourceMimeType,
  MCPUIResourceMetadata,
  // Intent types
  MCPUIIntent,
  MCPUIToolIntent,
  MCPUIActionIntent,
  MCPUIPromptIntent,
  MCPUINotifyIntent,
  MCPUILinkIntent,
  // Message types
  MCPUIMessage,
  // Handler types
  MCPUIIntentHandler,
  MCPUIIntentContext,
  UseMCPUIIntentsConfig,
  UseMCPUIIntentsReturn,
  // Component props
  MCPUIFrameProps,
} from "./types";

export {
  // Type guards
  isMCPUIResourceContent,
  isMCPUIIntent,
  isMCPUIMessage,
  parseMCPUIMessage,
  // Constants
  DEFAULT_MCP_UI_SANDBOX,
  RESTRICTED_MCP_UI_SANDBOX,
} from "./types";
