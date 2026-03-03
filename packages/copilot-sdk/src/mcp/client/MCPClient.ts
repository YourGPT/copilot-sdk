/**
 * MCP Client
 *
 * The core client class for connecting to MCP servers and managing
 * tools, resources, and the connection lifecycle.
 */

import type {
  MCPClientConfig,
  MCPClientState,
  MCPClientEvents,
  MCPConnectionState,
  MCPToolDefinition,
  MCPToolCallResult,
  MCPInitializeResult,
  MCPToolsListResult,
  JsonRpcMessage,
  JsonRpcResponse,
  MCPServerCapabilities,
  MCPServerInfo,
} from "../types";
import { MCPError, JSON_RPC_ERROR_CODES } from "../types";
import { JsonRpcHandler } from "../protocol/JsonRpcHandler";
import {
  MCP_METHODS,
  createInitializeParams,
  createToolsListParams,
  createToolCallParams,
  createPingParams,
  isInitializeResult,
  isToolsListResult,
  isToolCallResult,
} from "../protocol/messages";
import { HttpTransport } from "../transports/HttpTransport";
import type { MCPTransport } from "../transports/types";
import { MCPToolAdapter } from "../tools/MCPToolAdapter";
import type { ToolDefinition } from "../../core/types/tools";

/**
 * MCP Client
 *
 * Provides a simple interface for connecting to MCP servers and using their tools.
 *
 * @example
 * ```typescript
 * const client = new MCPClient({
 *   name: "github",
 *   transport: "http",
 *   url: "https://mcp.github.com",
 *   headers: { Authorization: `Bearer ${token}` },
 * });
 *
 * await client.connect();
 * const tools = client.toToolDefinitions();
 * const result = await client.callTool("create_issue", { title: "Bug" });
 * await client.disconnect();
 * ```
 */
export class MCPClient {
  private config: MCPClientConfig;
  private transport?: MCPTransport;
  private rpcHandler: JsonRpcHandler;
  private state: MCPClientState;
  private events: MCPClientEvents;
  private toolAdapter: MCPToolAdapter;

  constructor(config: MCPClientConfig, events?: MCPClientEvents) {
    this.config = config;
    this.events = events ?? {};
    this.rpcHandler = new JsonRpcHandler({ timeout: config.timeout ?? 30000 });
    this.toolAdapter = new MCPToolAdapter(config.name);
    this.state = {
      connectionState: "disconnected",
      tools: [],
    };
  }

  /**
   * Get the current client state
   */
  getState(): Readonly<MCPClientState> {
    return { ...this.state };
  }

  /**
   * Get the client name
   */
  getName(): string {
    return this.config.name;
  }

  /**
   * Check if client is connected
   */
  isConnected(): boolean {
    return this.state.connectionState === "connected";
  }

  /**
   * Connect to the MCP server
   */
  async connect(): Promise<void> {
    if (this.state.connectionState === "connected") {
      return;
    }

    if (this.state.connectionState === "connecting") {
      throw new MCPError("Connection already in progress");
    }

    this.setConnectionState("connecting");

    try {
      // Create transport based on config
      this.transport = this.createTransport();

      // Set up message handling
      this.transport.onMessage(this.handleMessage.bind(this));
      this.transport.onError(this.handleError.bind(this));
      this.transport.onClose(this.handleClose.bind(this));

      // Connect transport
      await this.transport.connect();

      // Perform MCP initialization handshake
      await this.initialize();

      // Mark as connected before fetching tools
      this.setConnectionState("connected");

      // Fetch available tools
      await this.refreshTools();
    } catch (error) {
      this.setConnectionState(
        "error",
        error instanceof Error ? error.message : "Connection failed",
      );
      throw error;
    }
  }

  /**
   * Disconnect from the MCP server
   */
  async disconnect(): Promise<void> {
    if (this.state.connectionState === "disconnected") {
      return;
    }

    // Cancel any pending requests
    this.rpcHandler.cancelAllPending("Client disconnecting");

    // Disconnect transport
    if (this.transport) {
      await this.transport.disconnect();
      this.transport = undefined;
    }

    // Reset state
    this.state = {
      connectionState: "disconnected",
      tools: [],
    };
  }

  /**
   * Call an MCP tool
   */
  async callTool(
    name: string,
    args?: Record<string, unknown>,
  ): Promise<MCPToolCallResult> {
    this.ensureConnected();

    const result = await this.request(
      MCP_METHODS.TOOLS_CALL,
      createToolCallParams(name, args) as unknown as Record<string, unknown>,
    );

    if (!isToolCallResult(result)) {
      throw new MCPError(
        "Invalid tool call result from server",
        JSON_RPC_ERROR_CODES.INTERNAL_ERROR,
      );
    }

    return result;
  }

  /**
   * Refresh the list of available tools
   */
  async refreshTools(): Promise<MCPToolDefinition[]> {
    this.ensureConnected();

    const allTools: MCPToolDefinition[] = [];
    let cursor: string | undefined;

    // Handle pagination
    do {
      const result = await this.request(
        MCP_METHODS.TOOLS_LIST,
        createToolsListParams(cursor),
      );

      if (!isToolsListResult(result)) {
        throw new MCPError(
          "Invalid tools list result from server",
          JSON_RPC_ERROR_CODES.INTERNAL_ERROR,
        );
      }

      allTools.push(...result.tools);
      cursor = result.nextCursor;
    } while (cursor);

    this.state.tools = allTools;
    this.state.lastActivity = Date.now();
    this.events.onToolsChange?.(allTools);

    return allTools;
  }

  /**
   * Convert MCP tools to ToolDefinition format for use with CopilotProvider
   */
  toToolDefinitions(options?: {
    prefixToolNames?: boolean;
    serverLocation?: boolean;
  }): ToolDefinition[] {
    const prefix = options?.prefixToolNames !== false;
    const asServer = options?.serverLocation ?? false;

    return this.state.tools.map((tool) =>
      this.toolAdapter.toToolDefinition(tool, {
        prefix,
        asServerTool: asServer,
        callTool: this.callTool.bind(this),
      }),
    );
  }

  /**
   * Get the list of MCP tools
   */
  getTools(): MCPToolDefinition[] {
    return [...this.state.tools];
  }

  /**
   * Get server info
   */
  getServerInfo(): MCPServerInfo | undefined {
    return this.state.serverInfo;
  }

  /**
   * Get server capabilities
   */
  getServerCapabilities(): MCPServerCapabilities | undefined {
    return this.state.serverCapabilities;
  }

  /**
   * Ping the server to check connectivity
   */
  async ping(): Promise<boolean> {
    try {
      await this.request(MCP_METHODS.PING, createPingParams());
      return true;
    } catch {
      return false;
    }
  }

  // ============================================
  // Private Methods
  // ============================================

  /**
   * Create transport based on config
   */
  private createTransport(): MCPTransport {
    switch (this.config.transport) {
      case "http":
        if (!this.config.url) {
          throw new MCPError(
            "URL is required for HTTP transport",
            JSON_RPC_ERROR_CODES.INVALID_PARAMS,
          );
        }
        return new HttpTransport({
          url: this.config.url,
          headers: this.config.headers,
          timeout: this.config.timeout,
        });

      case "sse":
        // SSE uses the same transport but with different behavior
        if (!this.config.url) {
          throw new MCPError(
            "URL is required for SSE transport",
            JSON_RPC_ERROR_CODES.INVALID_PARAMS,
          );
        }
        return new HttpTransport({
          url: this.config.url,
          headers: this.config.headers,
          timeout: this.config.timeout,
        });

      case "stdio":
        // Stdio transport will be implemented in Phase 3
        throw new MCPError(
          "Stdio transport not yet implemented. Use HTTP or SSE transport.",
          JSON_RPC_ERROR_CODES.INTERNAL_ERROR,
        );

      default:
        throw new MCPError(
          `Unknown transport type: ${this.config.transport}`,
          JSON_RPC_ERROR_CODES.INVALID_PARAMS,
        );
    }
  }

  /**
   * Perform MCP initialization handshake
   */
  private async initialize(): Promise<void> {
    const params = createInitializeParams(
      this.config.clientInfo,
      this.config.capabilities,
    );

    const result = await this.request(
      MCP_METHODS.INITIALIZE,
      params as unknown as Record<string, unknown>,
    );

    if (!isInitializeResult(result)) {
      throw new MCPError(
        "Invalid initialization result from server",
        JSON_RPC_ERROR_CODES.INTERNAL_ERROR,
      );
    }

    // Store server info
    this.state.serverInfo = result.serverInfo;
    this.state.serverCapabilities = result.capabilities;

    // Send initialized notification
    await this.notify(MCP_METHODS.INITIALIZED);
  }

  /**
   * Send a JSON-RPC request and wait for response
   */
  private async request(
    method: string,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    if (!this.transport) {
      throw new MCPError(
        "Transport not initialized",
        JSON_RPC_ERROR_CODES.INTERNAL_ERROR,
      );
    }

    const request = this.rpcHandler.createRequest(method, params);
    const responsePromise = this.rpcHandler.registerRequest(
      request,
      this.config.timeout,
    );

    await this.transport.send(request);

    return responsePromise;
  }

  /**
   * Send a JSON-RPC notification (no response expected)
   */
  private async notify(
    method: string,
    params?: Record<string, unknown>,
  ): Promise<void> {
    if (!this.transport) {
      throw new MCPError(
        "Transport not initialized",
        JSON_RPC_ERROR_CODES.INTERNAL_ERROR,
      );
    }

    const notification = this.rpcHandler.createNotification(method, params);
    await this.transport.send(notification);
  }

  /**
   * Handle incoming JSON-RPC message
   */
  private handleMessage(message: JsonRpcMessage): void {
    // Check if it's a response to a pending request
    if (this.rpcHandler.isResponse(message)) {
      this.rpcHandler.handleResponse(message as JsonRpcResponse);
      return;
    }

    // Check if it's a notification
    if (this.rpcHandler.isNotification(message)) {
      const notification = message as import("../types").JsonRpcNotification;
      this.handleNotification(notification.method, notification.params);
      return;
    }

    // Check if it's a request (server-initiated, e.g., elicitation)
    if (this.rpcHandler.isRequest(message)) {
      const request = message as import("../types").JsonRpcRequest;
      this.handleServerRequest(request.id, request.method, request.params);
    }
  }

  /**
   * Handle server notification
   */
  private handleNotification(
    method: string,
    params?: Record<string, unknown>,
  ): void {
    switch (method) {
      case MCP_METHODS.TOOLS_LIST_CHANGED:
        // Refresh tools when server notifies of changes
        this.refreshTools().catch((error) => {
          this.events.onError?.(error);
        });
        break;

      default:
        // Pass unknown notifications to event handler
        this.events.onNotification?.(method, params);
    }
  }

  /**
   * Handle server-initiated request (e.g., elicitation)
   */
  private async handleServerRequest(
    _id: string | number,
    method: string,
    params?: Record<string, unknown>,
  ): Promise<void> {
    // Handle elicitation requests
    if (
      method === MCP_METHODS.ELICITATION_REQUEST &&
      this.events.onElicitationRequest
    ) {
      try {
        const elicitationRequest =
          params as unknown as import("../types").MCPElicitationRequest;
        const response =
          await this.events.onElicitationRequest(elicitationRequest);

        // Send response back to server
        await this.notify(
          MCP_METHODS.ELICITATION_RESPONSE,
          response as unknown as Record<string, unknown>,
        );
      } catch (error) {
        // Send rejection response
        await this.notify(MCP_METHODS.ELICITATION_RESPONSE, {
          requestId: params?.requestId as string,
          accepted: false,
          reason: error instanceof Error ? error.message : "User rejected",
        });
      }
    }
  }

  /**
   * Handle transport error
   */
  private handleError(error: Error): void {
    this.setConnectionState("error", error.message);
    this.events.onError?.(error);
  }

  /**
   * Handle transport close
   */
  private handleClose(): void {
    if (this.state.connectionState === "connected") {
      this.setConnectionState("disconnected");
    }
  }

  /**
   * Update connection state
   */
  private setConnectionState(state: MCPConnectionState, error?: string): void {
    this.state.connectionState = state;
    this.state.error = error;
    this.events.onConnectionStateChange?.(state);
  }

  /**
   * Ensure client is connected
   */
  private ensureConnected(): void {
    if (!this.isConnected()) {
      throw new MCPError(
        "Client not connected. Call connect() first.",
        JSON_RPC_ERROR_CODES.INTERNAL_ERROR,
      );
    }
  }
}

/**
 * Create an MCP client
 *
 * Factory function for creating MCPClient instances.
 *
 * @example
 * ```typescript
 * const client = createMCPClient({
 *   name: "github",
 *   transport: "http",
 *   url: "https://mcp.github.com",
 * });
 *
 * await client.connect();
 * const tools = client.toToolDefinitions();
 * ```
 */
export function createMCPClient(
  config: MCPClientConfig,
  events?: MCPClientEvents,
): MCPClient {
  return new MCPClient(config, events);
}
