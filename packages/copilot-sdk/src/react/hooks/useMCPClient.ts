"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { MCPClient, createMCPClient } from "../../mcp/client/MCPClient";
import type {
  UseMCPClientConfig,
  UseMCPClientReturn,
  MCPClientState,
  MCPToolDefinition,
  MCPToolCallResult,
  MCPConnectionState,
} from "../../mcp/types";

/**
 * React hook for managing an MCP client connection
 *
 * This hook provides a managed MCP client that handles connection lifecycle,
 * tool discovery, and state management automatically.
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const {
 *     state,
 *     connect,
 *     disconnect,
 *     callTool,
 *     isConnected,
 *     isLoading,
 *   } = useMCPClient({
 *     name: "github",
 *     transport: "http",
 *     url: "https://mcp.github.com",
 *     headers: { Authorization: `Bearer ${token}` },
 *     autoConnect: true,
 *   });
 *
 *   if (isLoading) return <div>Connecting...</div>;
 *   if (!isConnected) return <button onClick={connect}>Connect</button>;
 *
 *   return (
 *     <div>
 *       <p>Connected to {state.serverInfo?.name}</p>
 *       <p>{state.tools.length} tools available</p>
 *     </div>
 *   );
 * }
 * ```
 */
export function useMCPClient(config: UseMCPClientConfig): UseMCPClientReturn {
  const {
    autoConnect = true,
    onConnectionStateChange,
    onToolsChange,
    onElicitationRequest,
    onError,
    onNotification,
    ...clientConfig
  } = config;

  // Track client instance
  const clientRef = useRef<MCPClient | null>(null);
  const mountedRef = useRef(true);

  // State
  const [state, setState] = useState<MCPClientState>({
    connectionState: "disconnected",
    tools: [],
  });

  // Create or get client instance
  const getClient = useCallback((): MCPClient => {
    if (!clientRef.current) {
      clientRef.current = createMCPClient(clientConfig, {
        onConnectionStateChange: (newState: MCPConnectionState) => {
          if (mountedRef.current) {
            setState((prev) => ({ ...prev, connectionState: newState }));
            onConnectionStateChange?.(newState);
          }
        },
        onToolsChange: (tools: MCPToolDefinition[]) => {
          if (mountedRef.current) {
            setState((prev) => ({ ...prev, tools }));
            onToolsChange?.(tools);
          }
        },
        onElicitationRequest,
        onError: (error: Error) => {
          if (mountedRef.current) {
            setState((prev) => ({ ...prev, error: error.message }));
            onError?.(error);
          }
        },
        onNotification,
      });
    }
    return clientRef.current;
  }, [
    clientConfig,
    onConnectionStateChange,
    onToolsChange,
    onElicitationRequest,
    onError,
    onNotification,
  ]);

  // Connect function
  const connect = useCallback(async (): Promise<void> => {
    const client = getClient();
    try {
      setState((prev) => ({
        ...prev,
        connectionState: "connecting",
        error: undefined,
      }));
      await client.connect();
      if (mountedRef.current) {
        const clientState = client.getState();
        setState({
          connectionState: "connected",
          tools: clientState.tools,
          serverInfo: clientState.serverInfo,
          serverCapabilities: clientState.serverCapabilities,
          lastActivity: Date.now(),
        });
      }
    } catch (error) {
      if (mountedRef.current) {
        const errorMessage =
          error instanceof Error ? error.message : "Connection failed";
        setState((prev) => ({
          ...prev,
          connectionState: "error",
          error: errorMessage,
        }));
      }
      throw error;
    }
  }, [getClient]);

  // Disconnect function
  const disconnect = useCallback(async (): Promise<void> => {
    const client = clientRef.current;
    if (client) {
      await client.disconnect();
      if (mountedRef.current) {
        setState({
          connectionState: "disconnected",
          tools: [],
        });
      }
    }
  }, []);

  // Call tool function
  const callTool = useCallback(
    async (
      name: string,
      args?: Record<string, unknown>,
    ): Promise<MCPToolCallResult> => {
      const client = clientRef.current;
      if (!client || !client.isConnected()) {
        throw new Error("MCP client not connected");
      }
      const result = await client.callTool(name, args);
      if (mountedRef.current) {
        setState((prev) => ({ ...prev, lastActivity: Date.now() }));
      }
      return result;
    },
    [],
  );

  // Refresh tools function
  const refreshTools = useCallback(async (): Promise<MCPToolDefinition[]> => {
    const client = clientRef.current;
    if (!client || !client.isConnected()) {
      throw new Error("MCP client not connected");
    }
    const tools = await client.refreshTools();
    if (mountedRef.current) {
      setState((prev) => ({ ...prev, tools, lastActivity: Date.now() }));
    }
    return tools;
  }, []);

  // Auto-connect on mount if enabled
  useEffect(() => {
    mountedRef.current = true;

    if (autoConnect) {
      connect().catch(() => {
        // Error is already handled in connect function
      });
    }

    return () => {
      mountedRef.current = false;
      // Disconnect on unmount
      const client = clientRef.current;
      if (client) {
        client.disconnect().catch(() => {
          // Ignore disconnect errors on unmount
        });
        clientRef.current = null;
      }
    };
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Computed values
  const isConnected = state.connectionState === "connected";
  const isLoading = state.connectionState === "connecting";

  return {
    state,
    connect,
    disconnect,
    callTool,
    refreshTools,
    isConnected,
    isLoading,
  };
}

export type { UseMCPClientConfig, UseMCPClientReturn, MCPClientState };
