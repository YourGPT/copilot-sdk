/**
 * MCP (Model Context Protocol) Type Definitions
 *
 * This module defines all types for MCP client integration,
 * following the MCP specification for JSON-RPC 2.0 communication.
 */

// ============================================
// Transport Types
// ============================================

/**
 * Supported MCP transport types
 */
export type MCPTransportType = "http" | "sse" | "stdio";

/**
 * Base transport configuration
 */
export interface MCPTransportConfigBase {
  /** Transport type */
  type: MCPTransportType;
}

/**
 * HTTP Streamable transport configuration (recommended)
 */
export interface MCPHttpTransportConfig extends MCPTransportConfigBase {
  type: "http";
  /** Server URL endpoint */
  url: string;
  /** Custom headers for authentication */
  headers?: Record<string, string>;
  /** Request timeout in milliseconds */
  timeout?: number;
}

/**
 * SSE (Server-Sent Events) transport configuration
 */
export interface MCPSSETransportConfig extends MCPTransportConfigBase {
  type: "sse";
  /** Server URL endpoint */
  url: string;
  /** Custom headers for authentication */
  headers?: Record<string, string>;
}

/**
 * Stdio transport configuration (for local MCP servers)
 */
export interface MCPStdioTransportConfig extends MCPTransportConfigBase {
  type: "stdio";
  /** Command to execute */
  command: string;
  /** Command arguments */
  args?: string[];
  /** Environment variables */
  env?: Record<string, string>;
  /** Working directory */
  cwd?: string;
}

/**
 * Union of all transport configurations
 */
export type MCPTransportConfig =
  | MCPHttpTransportConfig
  | MCPSSETransportConfig
  | MCPStdioTransportConfig;

// ============================================
// JSON-RPC 2.0 Types
// ============================================

/**
 * JSON-RPC request
 */
export interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: string | number;
  method: string;
  params?: Record<string, unknown>;
}

/**
 * JSON-RPC notification (no response expected)
 */
export interface JsonRpcNotification {
  jsonrpc: "2.0";
  method: string;
  params?: Record<string, unknown>;
}

/**
 * JSON-RPC success response
 */
export interface JsonRpcSuccessResponse {
  jsonrpc: "2.0";
  id: string | number;
  result: unknown;
}

/**
 * JSON-RPC error response
 */
export interface JsonRpcErrorResponse {
  jsonrpc: "2.0";
  id: string | number | null;
  error: JsonRpcError;
}

/**
 * JSON-RPC error object
 */
export interface JsonRpcError {
  code: number;
  message: string;
  data?: unknown;
}

/**
 * JSON-RPC response (success or error)
 */
export type JsonRpcResponse = JsonRpcSuccessResponse | JsonRpcErrorResponse;

/**
 * JSON-RPC message (request, notification, or response)
 */
export type JsonRpcMessage =
  | JsonRpcRequest
  | JsonRpcNotification
  | JsonRpcResponse;

// Standard JSON-RPC error codes
export const JSON_RPC_ERROR_CODES = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
} as const;

// ============================================
// MCP Protocol Types
// ============================================

/**
 * MCP Protocol Version
 *
 * The SDK supports multiple protocol versions:
 * - 2025-06-18: Latest protocol with full features
 * - 2025-03-26: Streamable HTTP transport
 * - 2024-11-05: Legacy HTTP+SSE transport (deprecated)
 */
export const MCP_PROTOCOL_VERSION = "2025-06-18";

/**
 * Supported protocol versions for negotiation
 */
export const SUPPORTED_PROTOCOL_VERSIONS = [
  "2025-06-18",
  "2025-03-26",
  "2024-11-05",
] as const;

/**
 * MCP client capabilities
 */
export interface MCPClientCapabilities {
  /** Roots capability (file system access) */
  roots?: {
    listChanged?: boolean;
  };
  /** Sampling capability */
  sampling?: Record<string, never>;
  /** Experimental capabilities */
  experimental?: Record<string, unknown>;
}

/**
 * MCP server capabilities
 */
export interface MCPServerCapabilities {
  /** Tools capability */
  tools?: {
    listChanged?: boolean;
  };
  /** Resources capability */
  resources?: {
    subscribe?: boolean;
    listChanged?: boolean;
  };
  /** Prompts capability */
  prompts?: {
    listChanged?: boolean;
  };
  /** Logging capability */
  logging?: Record<string, never>;
  /** Experimental capabilities */
  experimental?: Record<string, unknown>;
}

/**
 * MCP client info
 */
export interface MCPClientInfo {
  name: string;
  version: string;
}

/**
 * MCP server info
 */
export interface MCPServerInfo {
  name: string;
  version: string;
}

/**
 * MCP initialization params
 */
export interface MCPInitializeParams {
  protocolVersion: string;
  capabilities: MCPClientCapabilities;
  clientInfo: MCPClientInfo;
}

/**
 * MCP initialization result
 */
export interface MCPInitializeResult {
  protocolVersion: string;
  capabilities: MCPServerCapabilities;
  serverInfo: MCPServerInfo;
  instructions?: string;
}

// ============================================
// MCP Tool Types
// ============================================

/**
 * MCP tool definition (from server)
 */
export interface MCPToolDefinition {
  /** Tool name */
  name: string;
  /** Tool description */
  description?: string;
  /** JSON Schema for input parameters */
  inputSchema: MCPToolInputSchema;
}

/**
 * MCP tool input schema (JSON Schema format)
 */
export interface MCPToolInputSchema {
  type: "object";
  properties?: Record<string, MCPJsonSchemaProperty>;
  required?: string[];
  additionalProperties?: boolean;
}

/**
 * MCP JSON Schema property
 */
export interface MCPJsonSchemaProperty {
  type?: string | string[];
  description?: string;
  enum?: unknown[];
  items?: MCPJsonSchemaProperty;
  properties?: Record<string, MCPJsonSchemaProperty>;
  required?: string[];
  default?: unknown;
  // Additional JSON Schema validations
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  pattern?: string;
  format?: string;
  oneOf?: MCPJsonSchemaProperty[];
  anyOf?: MCPJsonSchemaProperty[];
  allOf?: MCPJsonSchemaProperty[];
}

/**
 * MCP tool call request params
 */
export interface MCPToolCallParams {
  name: string;
  arguments?: Record<string, unknown>;
}

/**
 * MCP UI content (for MCP-UI support)
 * @see https://github.com/idosal/mcp-ui
 */
export interface MCPUIContent {
  type: "ui";
  resource: {
    uri: string;
    mimeType:
      | "text/html"
      | "text/uri-list"
      | "application/vnd.mcp-ui.remote-dom";
    content?: string;
    blob?: string;
    metadata?: {
      title?: string;
      width?: string;
      height?: string;
      sandbox?: string[];
      className?: string;
    };
  };
}

/**
 * MCP tool call result content types
 */
export type MCPToolResultContent =
  | MCPTextContent
  | MCPImageContent
  | MCPResourceContent
  | MCPUIContent;

/**
 * MCP text content
 */
export interface MCPTextContent {
  type: "text";
  text: string;
}

/**
 * MCP image content
 */
export interface MCPImageContent {
  type: "image";
  data: string;
  mimeType: string;
}

/**
 * MCP embedded resource content
 */
export interface MCPResourceContent {
  type: "resource";
  resource: {
    uri: string;
    mimeType?: string;
    text?: string;
    blob?: string;
  };
}

/**
 * MCP tool call result
 */
export interface MCPToolCallResult {
  content: MCPToolResultContent[];
  isError?: boolean;
}

/**
 * MCP tools list result
 */
export interface MCPToolsListResult {
  tools: MCPToolDefinition[];
  nextCursor?: string;
}

// ============================================
// MCP Elicitation Types (Human-in-the-Loop)
// ============================================

/**
 * Elicitation request from MCP server
 */
export interface MCPElicitationRequest {
  /** Unique request ID */
  requestId: string;
  /** Elicitation mode */
  mode: "form" | "confirm" | "select";
  /** Message to display to user */
  message?: string;
  /** JSON Schema for form mode */
  schema?: MCPToolInputSchema;
  /** Options for select mode */
  options?: MCPElicitationOption[];
  /** Default values */
  defaults?: Record<string, unknown>;
}

/**
 * Elicitation option (for select mode)
 */
export interface MCPElicitationOption {
  value: string;
  label?: string;
  description?: string;
}

/**
 * Elicitation response to MCP server
 */
export interface MCPElicitationResponse {
  /** Request ID being responded to */
  requestId: string;
  /** Whether user accepted */
  accepted: boolean;
  /** User's form data (for form/select modes) */
  data?: Record<string, unknown>;
  /** Rejection reason (if not accepted) */
  reason?: string;
}

// ============================================
// MCP Resource Types (for future use)
// ============================================

/**
 * MCP resource definition
 */
export interface MCPResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

/**
 * MCP resources list result
 */
export interface MCPResourcesListResult {
  resources: MCPResource[];
  nextCursor?: string;
}

// ============================================
// MCP Client Types
// ============================================

/**
 * MCP client connection state
 */
export type MCPConnectionState =
  | "disconnected"
  | "connecting"
  | "connected"
  | "error";

/**
 * MCP client configuration
 */
export interface MCPClientConfig {
  /** Unique name for this client/server connection */
  name: string;
  /** Transport type shorthand */
  transport: MCPTransportType;
  /** Server URL (for http/sse transports) */
  url?: string;
  /** Custom headers (for http/sse transports) */
  headers?: Record<string, string>;
  /** Request timeout in milliseconds (default: 30000) */
  timeout?: number;
  /** Command to execute (for stdio transport) */
  command?: string;
  /** Command arguments (for stdio transport) */
  args?: string[];
  /** Environment variables (for stdio transport) */
  env?: Record<string, string>;
  /** Working directory (for stdio transport) */
  cwd?: string;
  /** Client info */
  clientInfo?: MCPClientInfo;
  /** Client capabilities */
  capabilities?: MCPClientCapabilities;
}

/**
 * MCP client state
 */
export interface MCPClientState {
  /** Connection state */
  connectionState: MCPConnectionState;
  /** Server info (after connection) */
  serverInfo?: MCPServerInfo;
  /** Server capabilities (after connection) */
  serverCapabilities?: MCPServerCapabilities;
  /** Available tools */
  tools: MCPToolDefinition[];
  /** Error message (if in error state) */
  error?: string;
  /** Last activity timestamp */
  lastActivity?: number;
}

/**
 * MCP client events
 */
export interface MCPClientEvents {
  /** Connection state changed */
  onConnectionStateChange?: (state: MCPConnectionState) => void;
  /** Tools list updated */
  onToolsChange?: (tools: MCPToolDefinition[]) => void;
  /** Elicitation request received */
  onElicitationRequest?: (
    request: MCPElicitationRequest,
  ) => Promise<MCPElicitationResponse>;
  /** Error occurred */
  onError?: (error: Error) => void;
  /** Notification received */
  onNotification?: (method: string, params?: Record<string, unknown>) => void;
}

// ============================================
// React Hook Types
// ============================================

/**
 * Configuration for useMCPClient hook
 */
export interface UseMCPClientConfig extends MCPClientConfig, MCPClientEvents {
  /** Auto-connect on mount (default: true) */
  autoConnect?: boolean;
}

/**
 * Configuration for useMCPTools hook
 */
export interface UseMCPToolsConfig extends UseMCPClientConfig {
  /** Prefix tool names with client name (default: true) */
  prefixToolNames?: boolean;
  /** Auto-register tools with CopilotProvider (default: true) */
  autoRegister?: boolean;
}

/**
 * Return type for useMCPClient hook
 */
export interface UseMCPClientReturn {
  /** Current client state */
  state: MCPClientState;
  /** Connect to server */
  connect: () => Promise<void>;
  /** Disconnect from server */
  disconnect: () => Promise<void>;
  /** Call a tool */
  callTool: (
    name: string,
    args?: Record<string, unknown>,
  ) => Promise<MCPToolCallResult>;
  /** Refresh tools list */
  refreshTools: () => Promise<MCPToolDefinition[]>;
  /** Whether client is connected */
  isConnected: boolean;
  /** Whether client is loading */
  isLoading: boolean;
}

/**
 * Return type for useMCPTools hook
 */
export interface UseMCPToolsReturn extends UseMCPClientReturn {
  /** Tools converted to ToolDefinition format */
  toolDefinitions: import("../core/types/tools").ToolDefinition[];
}

// ============================================
// Transport Interface
// ============================================

/**
 * MCP transport interface
 */
export interface MCPTransport {
  /** Connect the transport */
  connect(): Promise<void>;
  /** Disconnect the transport */
  disconnect(): Promise<void>;
  /** Send a JSON-RPC message */
  send(message: JsonRpcRequest | JsonRpcNotification): Promise<void>;
  /** Set message handler */
  onMessage(handler: (message: JsonRpcMessage) => void): void;
  /** Set error handler */
  onError(handler: (error: Error) => void): void;
  /** Set close handler */
  onClose(handler: () => void): void;
  /** Check if connected */
  isConnected(): boolean;
}

// ============================================
// Helper Types
// ============================================

/**
 * Pending request tracker
 */
export interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
}

/**
 * MCP error class
 */
export class MCPError extends Error {
  constructor(
    message: string,
    public code?: number,
    public data?: unknown,
  ) {
    super(message);
    this.name = "MCPError";
  }

  static fromJsonRpcError(error: JsonRpcError): MCPError {
    return new MCPError(error.message, error.code, error.data);
  }
}
