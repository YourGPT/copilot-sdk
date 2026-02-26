"use client";

import * as React from "react";
import { cn } from "../../lib/utils";
import { MCPStatus } from "./MCPStatus";
import { MCPToolList } from "./MCPToolList";
import type {
  MCPClientState,
  MCPConnectionState,
  MCPToolDefinition,
} from "../../../mcp/types";

export interface MCPPanelProps {
  /** MCP client state */
  state: MCPClientState;
  /** Connect callback */
  onConnect?: () => void;
  /** Disconnect callback */
  onDisconnect?: () => void;
  /** Refresh tools callback */
  onRefresh?: () => void;
  /** Whether connection is in progress */
  isLoading?: boolean;
  /** Custom class name */
  className?: string;
  /** Title for the panel */
  title?: string;
  /** Show tool schema details */
  showToolSchema?: boolean;
  /** Maximum visible tools */
  maxVisibleTools?: number;
  /** Collapsible panel */
  collapsible?: boolean;
  /** Default collapsed state */
  defaultCollapsed?: boolean;
}

/**
 * MCP Panel - Complete MCP connection management UI
 *
 * Provides connection controls, status display, and tool listing
 * for an MCP server connection.
 *
 * @example
 * ```tsx
 * const { state, connect, disconnect, isLoading } = useMCPTools({
 *   name: "github",
 *   transport: "http",
 *   url: "https://mcp.github.com",
 * });
 *
 * <MCPPanel
 *   state={state}
 *   onConnect={connect}
 *   onDisconnect={disconnect}
 *   isLoading={isLoading}
 * />
 * ```
 */
export function MCPPanel({
  state,
  onConnect,
  onDisconnect,
  onRefresh,
  isLoading = false,
  className,
  title = "MCP Server",
  showToolSchema = false,
  maxVisibleTools = 5,
  collapsible = false,
  defaultCollapsed = false,
}: MCPPanelProps) {
  const [collapsed, setCollapsed] = React.useState(defaultCollapsed);
  const isConnected = state.connectionState === "connected";
  const isConnecting = state.connectionState === "connecting" || isLoading;

  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-card overflow-hidden",
        className,
      )}
    >
      {/* Header */}
      <div
        className={cn(
          "flex items-center justify-between p-3 bg-secondary/30",
          collapsible && "cursor-pointer hover:bg-secondary/50",
        )}
        onClick={collapsible ? () => setCollapsed(!collapsed) : undefined}
      >
        <div className="flex items-center gap-2">
          {collapsible && (
            <ChevronIcon
              className={cn(
                "w-4 h-4 text-muted-foreground transition-transform",
                !collapsed && "rotate-90",
              )}
            />
          )}
          <span className="font-medium text-sm">{title}</span>
        </div>
        <MCPStatus
          state={state.connectionState}
          serverName={state.serverInfo?.name}
          size="sm"
          showLabel={false}
        />
      </div>

      {/* Content */}
      {(!collapsible || !collapsed) && (
        <div className="p-3 space-y-3">
          {/* Status and Server Info */}
          <div className="space-y-2">
            <MCPStatus
              state={state.connectionState}
              serverName={state.serverInfo?.name}
              size="sm"
            />

            {isConnected && state.serverInfo && (
              <div className="text-xs text-muted-foreground">
                v{state.serverInfo.version}
              </div>
            )}

            {state.error && (
              <div className="text-xs text-red-500 bg-red-500/10 rounded p-2">
                {state.error}
              </div>
            )}
          </div>

          {/* Connection Controls */}
          <div className="flex gap-2">
            {!isConnected ? (
              <button
                onClick={onConnect}
                disabled={isConnecting}
                className={cn(
                  "flex-1 px-3 py-1.5 rounded text-xs font-medium",
                  "bg-primary text-primary-foreground",
                  "hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed",
                )}
              >
                {isConnecting ? "Connecting..." : "Connect"}
              </button>
            ) : (
              <>
                <button
                  onClick={onDisconnect}
                  className={cn(
                    "flex-1 px-3 py-1.5 rounded text-xs font-medium",
                    "bg-secondary text-secondary-foreground",
                    "hover:bg-secondary/80",
                  )}
                >
                  Disconnect
                </button>
                {onRefresh && (
                  <button
                    onClick={onRefresh}
                    className={cn(
                      "px-3 py-1.5 rounded text-xs font-medium",
                      "bg-secondary text-secondary-foreground",
                      "hover:bg-secondary/80",
                    )}
                    title="Refresh tools"
                  >
                    <RefreshIcon className="w-3.5 h-3.5" />
                  </button>
                )}
              </>
            )}
          </div>

          {/* Tools List */}
          {isConnected && state.tools.length > 0 && (
            <div className="pt-2 border-t border-border/50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-muted-foreground">
                  Available Tools ({state.tools.length})
                </span>
              </div>
              <MCPToolList
                tools={state.tools}
                maxVisible={maxVisibleTools}
                showSchema={showToolSchema}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Simple chevron icon
function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  );
}

// Simple refresh icon
function RefreshIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
      />
    </svg>
  );
}
