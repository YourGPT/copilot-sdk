/**
 * MCP (Model Context Protocol) Integration Module
 *
 * This module provides client support for connecting to MCP servers
 * and using their tools within the YourGPT Copilot SDK.
 *
 * @example
 * ```typescript
 * // Basic usage
 * import { createMCPClient } from '@yourgpt/copilot-sdk/mcp';
 *
 * const client = createMCPClient({
 *   name: "github",
 *   transport: "http",
 *   url: "https://mcp.github.com",
 *   headers: { Authorization: `Bearer ${token}` },
 * });
 *
 * await client.connect();
 * const tools = client.toToolDefinitions();
 * await client.disconnect();
 * ```
 *
 * @example
 * ```typescript
 * // With React hooks
 * import { useMCPTools } from '@yourgpt/copilot-sdk/react';
 *
 * function MyApp() {
 *   const { state, isConnected, toolDefinitions } = useMCPTools({
 *     name: "github",
 *     transport: "http",
 *     url: "https://mcp.github.com",
 *     autoConnect: true,
 *   });
 *
 *   return <CopilotChat />;
 * }
 * ```
 *
 * @module mcp
 */

// ============================================
// Core Client
// ============================================

export { MCPClient, createMCPClient } from "./client/MCPClient";
export {
  MCPClientManager,
  createMCPClientManager,
} from "./client/MCPClientManager";

// ============================================
// Types
// ============================================

export type {
  // Transport types
  MCPTransportType,
  MCPTransportConfig,
  MCPHttpTransportConfig,
  MCPSSETransportConfig,
  MCPStdioTransportConfig,
  // JSON-RPC types
  JsonRpcRequest,
  JsonRpcNotification,
  JsonRpcResponse,
  JsonRpcMessage,
  JsonRpcError,
  // Client types
  MCPClientConfig,
  MCPClientState,
  MCPClientEvents,
  MCPConnectionState,
  // Tool types
  MCPToolDefinition,
  MCPToolInputSchema,
  MCPToolCallParams,
  MCPToolCallResult,
  MCPToolResultContent,
  MCPTextContent,
  MCPImageContent,
  MCPResourceContent,
  MCPUIContent,
  // Elicitation types
  MCPElicitationRequest,
  MCPElicitationResponse,
  MCPElicitationOption,
  // Server types
  MCPServerInfo,
  MCPServerCapabilities,
  MCPClientInfo,
  MCPClientCapabilities,
  // Hook types
  UseMCPClientConfig,
  UseMCPClientReturn,
  UseMCPToolsConfig,
  UseMCPToolsReturn,
} from "./types";

export { MCPError, MCP_PROTOCOL_VERSION, JSON_RPC_ERROR_CODES } from "./types";

// ============================================
// Transports
// ============================================

export { HttpTransport } from "./transports/HttpTransport";
export { SSETransport } from "./transports/SSETransport";
export { StdioTransport } from "./transports/StdioTransport";
export { BaseTransport } from "./transports/types";
export type {
  MCPTransport,
  HttpTransportOptions,
  SSETransportOptions,
  StdioTransportOptions,
} from "./transports/types";

// ============================================
// Protocol
// ============================================

export { JsonRpcHandler } from "./protocol/JsonRpcHandler";
export {
  MCP_METHODS,
  DEFAULT_CLIENT_INFO,
  DEFAULT_CLIENT_CAPABILITIES,
  createInitializeParams,
  createToolsListParams,
  createToolCallParams,
} from "./protocol/messages";

// ============================================
// Tools
// ============================================

export {
  MCPToolAdapter,
  mcpToolToDefinition,
  mcpToolsToDefinitions,
} from "./tools/MCPToolAdapter";
export type { MCPToolAdapterOptions } from "./tools/MCPToolAdapter";

// ============================================
// Client Manager Types
// ============================================

export type {
  MCPManagedClientConfig,
  MCPClientManagerEvents,
  MCPClientManagerState,
} from "./client/MCPClientManager";

// ============================================
// MCP-UI Types (Interactive UI Components)
// ============================================

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
} from "./ui";

export {
  // Type guards
  isMCPUIResourceContent,
  isMCPUIIntent,
  isMCPUIMessage,
  parseMCPUIMessage,
  // Constants
  DEFAULT_MCP_UI_SANDBOX,
  RESTRICTED_MCP_UI_SANDBOX,
} from "./ui";
