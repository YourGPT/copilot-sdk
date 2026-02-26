/**
 * MCP Client Manager
 *
 * Manages multiple MCP client connections simultaneously.
 * Useful for connecting to multiple MCP servers and aggregating their tools.
 */

import { MCPClient, createMCPClient } from "./MCPClient";
import type {
  MCPClientConfig,
  MCPClientEvents,
  MCPClientState,
  MCPToolDefinition,
  MCPConnectionState,
} from "../types";
import type { ToolDefinition } from "../../core/types/tools";

/**
 * MCP Client Manager configuration for a single client
 */
export interface MCPManagedClientConfig extends MCPClientConfig {
  /** Enable this client (default: true) */
  enabled?: boolean;
}

/**
 * MCP Client Manager events
 */
export interface MCPClientManagerEvents {
  /** Called when any client's connection state changes */
  onConnectionStateChange?: (
    clientName: string,
    state: MCPConnectionState,
  ) => void;
  /** Called when any client's tools change */
  onToolsChange?: (clientName: string, tools: MCPToolDefinition[]) => void;
  /** Called when any client encounters an error */
  onError?: (clientName: string, error: Error) => void;
  /** Called when all clients are connected */
  onAllConnected?: () => void;
  /** Called when all clients are disconnected */
  onAllDisconnected?: () => void;
}

/**
 * Aggregated state for all managed clients
 */
export interface MCPClientManagerState {
  /** Individual client states */
  clients: Record<string, MCPClientState>;
  /** All tools from all connected clients */
  allTools: MCPToolDefinition[];
  /** Whether all enabled clients are connected */
  allConnected: boolean;
  /** Whether any client is connecting */
  anyConnecting: boolean;
  /** Whether any client has an error */
  anyError: boolean;
  /** Total number of tools across all clients */
  totalToolCount: number;
}

/**
 * MCP Client Manager
 *
 * Manages multiple MCP client connections for scenarios where you need
 * to connect to multiple MCP servers simultaneously.
 *
 * @example
 * ```typescript
 * const manager = new MCPClientManager([
 *   { name: "github", transport: "http", url: "https://mcp.github.com" },
 *   { name: "slack", transport: "http", url: "https://mcp.slack.com" },
 *   { name: "filesystem", transport: "stdio", command: "npx", args: ["-y", "@anthropic/filesystem-mcp-server"] },
 * ]);
 *
 * await manager.connectAll();
 *
 * // Get all tools from all clients
 * const tools = manager.getAllToolDefinitions();
 *
 * // Call a tool on a specific client
 * const result = await manager.callTool("github", "create_issue", { title: "Bug" });
 *
 * await manager.disconnectAll();
 * ```
 */
export class MCPClientManager {
  private clients = new Map<string, MCPClient>();
  private configs: MCPManagedClientConfig[];
  private events: MCPClientManagerEvents;

  constructor(
    configs: MCPManagedClientConfig[],
    events?: MCPClientManagerEvents,
  ) {
    this.configs = configs;
    this.events = events ?? {};
  }

  /**
   * Get the current aggregated state
   */
  getState(): MCPClientManagerState {
    const clientStates: Record<string, MCPClientState> = {};
    const allTools: MCPToolDefinition[] = [];
    let allConnected = true;
    let anyConnecting = false;
    let anyError = false;

    for (const config of this.configs) {
      if (config.enabled === false) continue;

      const client = this.clients.get(config.name);
      if (client) {
        const state = client.getState();
        clientStates[config.name] = state;
        allTools.push(...state.tools);

        if (state.connectionState !== "connected") {
          allConnected = false;
        }
        if (state.connectionState === "connecting") {
          anyConnecting = true;
        }
        if (state.connectionState === "error") {
          anyError = true;
        }
      } else {
        allConnected = false;
      }
    }

    return {
      clients: clientStates,
      allTools,
      allConnected,
      anyConnecting,
      anyError,
      totalToolCount: allTools.length,
    };
  }

  /**
   * Connect all enabled clients
   */
  async connectAll(): Promise<void> {
    const connectPromises: Promise<void>[] = [];

    for (const config of this.configs) {
      if (config.enabled === false) continue;

      const promise = this.connect(config.name).catch((error) => {
        // Log but don't fail other connections
        console.error(`Failed to connect ${config.name}:`, error);
        this.events.onError?.(
          config.name,
          error instanceof Error ? error : new Error(String(error)),
        );
      });

      connectPromises.push(promise);
    }

    await Promise.all(connectPromises);

    // Check if all connected
    const state = this.getState();
    if (state.allConnected) {
      this.events.onAllConnected?.();
    }
  }

  /**
   * Connect a specific client
   */
  async connect(name: string): Promise<void> {
    const config = this.configs.find((c) => c.name === name);
    if (!config) {
      throw new Error(`Client "${name}" not found in configuration`);
    }

    if (config.enabled === false) {
      throw new Error(`Client "${name}" is disabled`);
    }

    // Create client if it doesn't exist
    let client = this.clients.get(name);
    if (!client) {
      client = this.createClient(config);
      this.clients.set(name, client);
    }

    await client.connect();
  }

  /**
   * Disconnect all clients
   */
  async disconnectAll(): Promise<void> {
    const disconnectPromises: Promise<void>[] = [];

    for (const client of this.clients.values()) {
      disconnectPromises.push(
        client.disconnect().catch((error) => {
          console.error("Error disconnecting client:", error);
        }),
      );
    }

    await Promise.all(disconnectPromises);
    this.events.onAllDisconnected?.();
  }

  /**
   * Disconnect a specific client
   */
  async disconnect(name: string): Promise<void> {
    const client = this.clients.get(name);
    if (client) {
      await client.disconnect();
    }
  }

  /**
   * Get a specific client
   */
  getClient(name: string): MCPClient | undefined {
    return this.clients.get(name);
  }

  /**
   * Get all connected clients
   */
  getConnectedClients(): MCPClient[] {
    return Array.from(this.clients.values()).filter((c) => c.isConnected());
  }

  /**
   * Get all tool definitions from all connected clients
   */
  getAllToolDefinitions(options?: {
    prefixToolNames?: boolean;
  }): ToolDefinition[] {
    const tools: ToolDefinition[] = [];

    for (const client of this.getConnectedClients()) {
      const clientTools = client.toToolDefinitions({
        prefixToolNames: options?.prefixToolNames ?? true,
      });
      tools.push(...clientTools);
    }

    return tools;
  }

  /**
   * Get tool definitions from a specific client
   */
  getToolDefinitions(
    name: string,
    options?: { prefixToolNames?: boolean },
  ): ToolDefinition[] {
    const client = this.clients.get(name);
    if (!client || !client.isConnected()) {
      return [];
    }

    return client.toToolDefinitions({
      prefixToolNames: options?.prefixToolNames ?? true,
    });
  }

  /**
   * Call a tool on a specific client
   */
  async callTool(
    clientName: string,
    toolName: string,
    args?: Record<string, unknown>,
  ): Promise<import("../types").MCPToolCallResult> {
    const client = this.clients.get(clientName);
    if (!client) {
      throw new Error(`Client "${clientName}" not found`);
    }

    if (!client.isConnected()) {
      throw new Error(`Client "${clientName}" is not connected`);
    }

    return client.callTool(toolName, args);
  }

  /**
   * Refresh tools for all connected clients
   */
  async refreshAllTools(): Promise<void> {
    const refreshPromises: Promise<void>[] = [];

    for (const client of this.getConnectedClients()) {
      refreshPromises.push(
        client
          .refreshTools()
          .then(() => undefined)
          .catch((error) => {
            console.error("Error refreshing tools:", error);
          }),
      );
    }

    await Promise.all(refreshPromises);
  }

  /**
   * Check if a specific client is connected
   */
  isConnected(name: string): boolean {
    const client = this.clients.get(name);
    return client?.isConnected() ?? false;
  }

  /**
   * Create a client with event forwarding
   */
  private createClient(config: MCPManagedClientConfig): MCPClient {
    const clientEvents: MCPClientEvents = {
      onConnectionStateChange: (state) => {
        this.events.onConnectionStateChange?.(config.name, state);

        // Check for all connected/disconnected
        const managerState = this.getState();
        if (state === "connected" && managerState.allConnected) {
          this.events.onAllConnected?.();
        }
      },
      onToolsChange: (tools) => {
        this.events.onToolsChange?.(config.name, tools);
      },
      onError: (error) => {
        this.events.onError?.(config.name, error);
      },
    };

    return createMCPClient(config, clientEvents);
  }
}

/**
 * Create an MCP Client Manager
 */
export function createMCPClientManager(
  configs: MCPManagedClientConfig[],
  events?: MCPClientManagerEvents,
): MCPClientManager {
  return new MCPClientManager(configs, events);
}
