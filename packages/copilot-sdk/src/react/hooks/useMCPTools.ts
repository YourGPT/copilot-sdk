"use client";

import { useEffect, useRef, useMemo } from "react";
import { useCopilot } from "../provider/CopilotProvider";
import { useMCPClient } from "./useMCPClient";
import { MCPToolAdapter } from "../../mcp/tools/MCPToolAdapter";
import type {
  UseMCPToolsConfig,
  UseMCPToolsReturn,
  MCPToolDefinition,
} from "../../mcp/types";
import type { ToolDefinition } from "../../core/types/tools";

/**
 * React hook for connecting to an MCP server and auto-registering its tools
 *
 * This hook combines the MCP client management with automatic tool registration
 * to the CopilotProvider. When connected, all MCP tools become available to
 * the AI assistant automatically.
 *
 * @example
 * ```tsx
 * function CopilotWithGitHub() {
 *   const {
 *     state,
 *     isConnected,
 *     isLoading,
 *     toolDefinitions,
 *   } = useMCPTools({
 *     name: "github",
 *     transport: "http",
 *     url: "https://mcp.github.com",
 *     headers: { Authorization: `Bearer ${token}` },
 *     autoConnect: true,
 *     prefixToolNames: true,  // Tools named: github_create_issue, etc.
 *     onElicitationRequest: async (request) => {
 *       // Show custom approval UI
 *       const approved = await showApprovalDialog(request);
 *       return { requestId: request.requestId, accepted: approved };
 *     },
 *   });
 *
 *   return (
 *     <div>
 *       {isLoading && <div>Connecting to GitHub MCP...</div>}
 *       {isConnected && (
 *         <div>{toolDefinitions.length} GitHub tools available</div>
 *       )}
 *       <CopilotChat />
 *     </div>
 *   );
 * }
 * ```
 */
export function useMCPTools(config: UseMCPToolsConfig): UseMCPToolsReturn {
  const {
    prefixToolNames = true,
    autoRegister = true,
    ...clientConfig
  } = config;

  // Get copilot context for tool registration
  const { registerTool, unregisterTool } = useCopilot();

  // Track registered tool names for cleanup
  const registeredToolsRef = useRef<string[]>([]);

  // Use the base MCP client hook
  const mcpClient = useMCPClient(clientConfig);

  // Create tool adapter
  const toolAdapter = useMemo(
    () => new MCPToolAdapter(clientConfig.name),
    [clientConfig.name],
  );

  // Convert MCP tools to ToolDefinitions
  const toolDefinitions = useMemo((): ToolDefinition[] => {
    if (!mcpClient.isConnected || mcpClient.state.tools.length === 0) {
      return [];
    }

    return mcpClient.state.tools.map((tool) =>
      toolAdapter.toToolDefinition(tool, {
        prefix: prefixToolNames,
        asServerTool: true, // MCP tools execute remotely
        callTool: mcpClient.callTool,
      }),
    );
  }, [
    mcpClient.isConnected,
    mcpClient.state.tools,
    mcpClient.callTool,
    toolAdapter,
    prefixToolNames,
  ]);

  // Auto-register/unregister tools with CopilotProvider
  useEffect(() => {
    if (!autoRegister) {
      return;
    }

    // Unregister previously registered tools
    for (const toolName of registeredToolsRef.current) {
      unregisterTool(toolName);
    }
    registeredToolsRef.current = [];

    // Register new tools
    if (mcpClient.isConnected && toolDefinitions.length > 0) {
      for (const tool of toolDefinitions) {
        registerTool(tool);
        registeredToolsRef.current.push(tool.name);
      }
    }

    // Cleanup on unmount
    return () => {
      for (const toolName of registeredToolsRef.current) {
        unregisterTool(toolName);
      }
      registeredToolsRef.current = [];
    };
  }, [
    autoRegister,
    mcpClient.isConnected,
    toolDefinitions,
    registerTool,
    unregisterTool,
  ]);

  return {
    ...mcpClient,
    toolDefinitions,
  };
}

/**
 * Hook for using multiple MCP servers simultaneously
 *
 * @example
 * ```tsx
 * function CopilotWithMultipleMCP() {
 *   const github = useMCPTools({
 *     name: "github",
 *     transport: "http",
 *     url: "https://mcp.github.com",
 *   });
 *
 *   const slack = useMCPTools({
 *     name: "slack",
 *     transport: "http",
 *     url: "https://mcp.slack.com",
 *   });
 *
 *   const allConnected = github.isConnected && slack.isConnected;
 *   const totalTools = github.toolDefinitions.length + slack.toolDefinitions.length;
 *
 *   return (
 *     <div>
 *       {allConnected && <div>{totalTools} tools available</div>}
 *       <CopilotChat />
 *     </div>
 *   );
 * }
 * ```
 */

export type { UseMCPToolsConfig, UseMCPToolsReturn };
