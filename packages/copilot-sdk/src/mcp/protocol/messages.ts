/**
 * MCP Protocol Messages
 *
 * Defines all MCP-specific JSON-RPC methods and message helpers.
 */

import type {
  MCPInitializeParams,
  MCPToolCallParams,
  MCPClientCapabilities,
  MCPClientInfo,
} from "../types";
import { MCP_PROTOCOL_VERSION } from "../types";

// ============================================
// MCP Method Names
// ============================================

export const MCP_METHODS = {
  // Lifecycle
  INITIALIZE: "initialize",
  INITIALIZED: "notifications/initialized",
  PING: "ping",

  // Tools
  TOOLS_LIST: "tools/list",
  TOOLS_CALL: "tools/call",

  // Resources (for future use)
  RESOURCES_LIST: "resources/list",
  RESOURCES_READ: "resources/read",
  RESOURCES_SUBSCRIBE: "resources/subscribe",
  RESOURCES_UNSUBSCRIBE: "resources/unsubscribe",

  // Prompts (for future use)
  PROMPTS_LIST: "prompts/list",
  PROMPTS_GET: "prompts/get",

  // Notifications
  TOOLS_LIST_CHANGED: "notifications/tools/list_changed",
  RESOURCES_LIST_CHANGED: "notifications/resources/list_changed",
  RESOURCES_UPDATED: "notifications/resources/updated",
  PROMPTS_LIST_CHANGED: "notifications/prompts/list_changed",

  // Elicitation
  ELICITATION_REQUEST: "elicitation/request",
  ELICITATION_RESPONSE: "elicitation/response",

  // Logging
  LOGGING_SET_LEVEL: "logging/setLevel",
  LOGGING_MESSAGE: "notifications/message",

  // Cancellation
  CANCEL: "notifications/cancelled",
} as const;

// ============================================
// Message Parameter Builders
// ============================================

/**
 * Default client info for YourGPT Copilot SDK
 */
export const DEFAULT_CLIENT_INFO: MCPClientInfo = {
  name: "yourgpt-copilot-sdk",
  version: "2.2.0",
};

/**
 * Default client capabilities
 */
export const DEFAULT_CLIENT_CAPABILITIES: MCPClientCapabilities = {
  roots: {
    listChanged: true,
  },
  sampling: {},
};

/**
 * Create initialize params
 */
export function createInitializeParams(
  clientInfo?: Partial<MCPClientInfo>,
  capabilities?: MCPClientCapabilities,
): MCPInitializeParams {
  return {
    protocolVersion: MCP_PROTOCOL_VERSION,
    clientInfo: {
      ...DEFAULT_CLIENT_INFO,
      ...clientInfo,
    },
    capabilities: capabilities ?? DEFAULT_CLIENT_CAPABILITIES,
  };
}

/**
 * Create tools/list params
 */
export function createToolsListParams(cursor?: string): { cursor?: string } {
  if (cursor) {
    return { cursor };
  }
  return {};
}

/**
 * Create tools/call params
 */
export function createToolCallParams(
  name: string,
  args?: Record<string, unknown>,
): MCPToolCallParams {
  return {
    name,
    arguments: args,
  };
}

/**
 * Create ping params (empty object)
 */
export function createPingParams(): Record<string, never> {
  return {};
}

/**
 * Create cancellation notification params
 */
export function createCancelParams(
  requestId: string | number,
  reason?: string,
): { requestId: string | number; reason?: string } {
  return {
    requestId,
    ...(reason && { reason }),
  };
}

/**
 * Create logging set level params
 */
export function createLoggingSetLevelParams(
  level:
    | "debug"
    | "info"
    | "notice"
    | "warning"
    | "error"
    | "critical"
    | "alert"
    | "emergency",
): { level: string } {
  return { level };
}

// ============================================
// Response Type Guards
// ============================================

/**
 * Check if value is a valid initialize result
 */
export function isInitializeResult(
  value: unknown,
): value is import("../types").MCPInitializeResult {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.protocolVersion === "string" &&
    v.capabilities !== null &&
    typeof v.capabilities === "object" &&
    v.serverInfo !== null &&
    typeof v.serverInfo === "object"
  );
}

/**
 * Check if value is a valid tools list result
 */
export function isToolsListResult(
  value: unknown,
): value is import("../types").MCPToolsListResult {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return Array.isArray(v.tools);
}

/**
 * Check if value is a valid tool call result
 */
export function isToolCallResult(
  value: unknown,
): value is import("../types").MCPToolCallResult {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return Array.isArray(v.content);
}

/**
 * Check if value is a ping result (empty object or has no required fields)
 */
export function isPingResult(value: unknown): value is Record<string, never> {
  return value !== null && typeof value === "object";
}
