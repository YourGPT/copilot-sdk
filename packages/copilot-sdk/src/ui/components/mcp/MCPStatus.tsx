"use client";

import * as React from "react";
import { cn } from "../../lib/utils";
import type { MCPConnectionState } from "../../../mcp/types";

export interface MCPStatusProps {
  /** Connection state */
  state: MCPConnectionState;
  /** Server name (shown when connected) */
  serverName?: string;
  /** Custom class name */
  className?: string;
  /** Size variant */
  size?: "sm" | "md" | "lg";
  /** Show label text */
  showLabel?: boolean;
}

const sizeClasses = {
  sm: "w-2 h-2",
  md: "w-3 h-3",
  lg: "w-4 h-4",
};

const textSizeClasses = {
  sm: "text-xs",
  md: "text-sm",
  lg: "text-base",
};

/**
 * MCP connection status indicator
 *
 * Shows a colored dot indicating the current connection state.
 */
export function MCPStatus({
  state,
  serverName,
  className,
  size = "md",
  showLabel = true,
}: MCPStatusProps) {
  const statusConfig = {
    disconnected: {
      color: "bg-gray-400",
      label: "Disconnected",
    },
    connecting: {
      color: "bg-yellow-500 animate-pulse",
      label: "Connecting...",
    },
    connected: {
      color: "bg-green-500",
      label: serverName ? `Connected to ${serverName}` : "Connected",
    },
    error: {
      color: "bg-red-500",
      label: "Connection Error",
    },
  };

  const config = statusConfig[state];

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className={cn("rounded-full", sizeClasses[size], config.color)} />
      {showLabel && (
        <span className={cn("text-muted-foreground", textSizeClasses[size])}>
          {config.label}
        </span>
      )}
    </div>
  );
}
