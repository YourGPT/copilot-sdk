"use client";

import { useState, useCallback, useEffect } from "react";
import { useMCPTools } from "@yourgpt/copilot-sdk/react";
import {
  ChevronDown,
  Plus,
  Zap,
  Server,
  X,
  Check,
  Loader2,
  Plug,
  ExternalLink,
  Sparkles,
  Edit3,
} from "lucide-react";

// ============================================
// Types
// ============================================
interface MCPServerConfig {
  id: string;
  name: string;
  description: string;
  url: string;
  icon: React.ReactNode;
  enabled: boolean;
}

// ============================================
// Default MCP Servers
// ============================================
const DEFAULT_SERVERS: MCPServerConfig[] = [
  {
    id: "local",
    name: "Local Demo Server",
    description: "MCP-UI demonstration tools",
    url: "/api/mcp",
    icon: <Zap className="w-4 h-4" />,
    enabled: true,
  },
  {
    id: "mcp360",
    name: "MCP360 Gateway",
    description: "100+ tools for search, scraping & data",
    url: process.env.NEXT_PUBLIC_MCP360_URL || "",
    icon: <Sparkles className="w-4 h-4" />,
    enabled: false,
  },
];

// ============================================
// MCP Server Card - Compact Design
// ============================================
function MCPServerCard({
  server,
  connectionState,
  tools,
  onConnect,
  onDisconnect,
  onUrlChange,
}: {
  server: MCPServerConfig;
  connectionState: {
    isConnected: boolean;
    isLoading: boolean;
    error?: string;
  };
  tools: Array<{ name: string; description?: string }>;
  onConnect: () => void;
  onDisconnect: () => void;
  onUrlChange?: (url: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showUrlEdit, setShowUrlEdit] = useState(false);
  const [editUrl, setEditUrl] = useState(server.url);
  const isConnected = connectionState.isConnected;
  const isMCP360 = server.id === "mcp360";

  const handleSaveUrl = () => {
    onUrlChange?.(editUrl);
    setShowUrlEdit(false);
  };

  return (
    <div
      className={`rounded-xl border transition-all duration-300 overflow-hidden ${isConnected ? "bg-card border-primary/30" : "bg-card/50 border-border hover:border-border"}`}
    >
      {/* Header */}
      <div className="p-4">
        {/* Title row */}
        <div className="flex items-center justify-between gap-3 mb-2">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-foreground">
              {server.name}
            </h3>
            {isConnected && (
              <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                {tools.length}
              </span>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1.5">
            {isConnected && tools.length > 0 && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="p-1.5 hover:bg-muted rounded-md transition-colors cursor-pointer"
              >
                <ChevronDown
                  className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
                />
              </button>
            )}

            {!isConnected ? (
              <button
                onClick={onConnect}
                disabled={connectionState.isLoading || !server.url}
                className="px-4 py-2 text-sm font-medium bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-2 cursor-pointer"
              >
                {connectionState.isLoading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Plug className="w-3.5 h-3.5" />
                )}
                {connectionState.isLoading ? "..." : "Connect"}
              </button>
            ) : (
              <button
                onClick={onDisconnect}
                className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Description */}
        <p className="text-sm text-muted-foreground mb-3">
          {server.description}
        </p>

        {/* URL Display with Edit */}
        {!showUrlEdit ? (
          <button
            onClick={() => setShowUrlEdit(true)}
            className="flex items-center gap-2 group cursor-pointer max-w-full overflow-hidden"
            disabled={isConnected}
          >
            <code className="text-xs text-muted-foreground font-mono bg-muted px-2.5 py-1.5 rounded truncate block overflow-hidden text-ellipsis group-hover:text-foreground transition-colors">
              {server.url || "Click to set URL"}
            </code>
            {!isConnected && (
              <Edit3 className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
            )}
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={editUrl}
              onChange={(e) => setEditUrl(e.target.value)}
              className="flex-1 text-xs font-mono px-2.5 py-2 rounded-md bg-muted border border-border text-foreground focus:border-primary/50 focus:outline-none"
              placeholder="Enter URL..."
              autoFocus
            />
            <button
              onClick={handleSaveUrl}
              className="p-1.5 rounded-md bg-primary/20 text-primary hover:bg-primary/30 transition-colors cursor-pointer"
            >
              <Check className="w-3 h-3" />
            </button>
            <button
              onClick={() => {
                setShowUrlEdit(false);
                setEditUrl(server.url);
              }}
              className="p-1.5 rounded-md bg-muted text-muted-foreground hover:bg-muted/80 transition-colors cursor-pointer"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>

      {/* Error */}
      {connectionState.error && (
        <div className="px-4 pb-4">
          <p className="text-sm text-destructive bg-destructive/10 px-3 py-2.5 rounded-lg border border-destructive/20">
            {connectionState.error}
          </p>
        </div>
      )}

      {/* Expanded Tools */}
      {expanded && isConnected && tools.length > 0 && (
        <div className="px-4 pb-4 border-t border-border">
          <div className="pt-3 flex flex-wrap gap-1.5">
            {tools.slice(0, 12).map((tool) => (
              <span
                key={tool.name}
                className="px-2 py-0.5 text-[11px] bg-muted/60 text-muted-foreground rounded font-mono"
                title={tool.description}
              >
                {tool.name.replace(/^[^:]+:/, "")}
              </span>
            ))}
            {tools.length > 12 && (
              <span className="px-2 py-0.5 text-[11px] text-muted-foreground/70">
                +{tools.length - 12} more
              </span>
            )}
          </div>
        </div>
      )}

      {/* MCP360 Tool Categories - Simple list */}
      {isMCP360 && !isConnected && (
        <div className="px-4 pb-4 border-t border-border">
          <div className="pt-3 flex items-start justify-between gap-4">
            <div className="flex-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-2">
                100+ Tools Available
              </p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Web Scraping · Keyword Research · IP Info · Google Search ·
                YouTube · Maps · Shopping · News · Trends
              </p>
            </div>
            <a
              href="https://mcp360.ai"
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              Visit
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// MCP Connection Hook Wrapper
// ============================================
function MCPConnection({
  server,
  onStateChange,
  onToolsChange,
}: {
  server: MCPServerConfig;
  onStateChange: (
    id: string,
    state: { isConnected: boolean; isLoading: boolean; error?: string },
  ) => void;
  onToolsChange: (
    id: string,
    tools: Array<{ name: string; description?: string }>,
  ) => void;
}) {
  const {
    state,
    isConnected,
    isLoading,
    toolDefinitions,
    connect,
    disconnect,
  } = useMCPTools({
    name: server.id,
    transport: "http",
    url: server.url,
    autoConnect: false,
    prefixToolNames: true,
  });

  useEffect(() => {
    onStateChange(server.id, {
      isConnected,
      isLoading,
      error: state.error || undefined,
    });
  }, [isConnected, isLoading, state.error, server.id, onStateChange]);

  useEffect(() => {
    onToolsChange(server.id, toolDefinitions);
  }, [toolDefinitions, server.id, onToolsChange]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      (window as unknown as Record<string, unknown>)[
        `mcp_${server.id}_connect`
      ] = connect;
      (window as unknown as Record<string, unknown>)[
        `mcp_${server.id}_disconnect`
      ] = disconnect;
    }
  }, [connect, disconnect, server.id]);

  return null;
}

// ============================================
// Main Sidebar Component
// ============================================
export function MCPConfigSidebar() {
  const [servers, setServers] = useState<MCPServerConfig[]>(DEFAULT_SERVERS);
  const [connectionStates, setConnectionStates] = useState<
    Record<string, { isConnected: boolean; isLoading: boolean; error?: string }>
  >({});
  const [serverTools, setServerTools] = useState<
    Record<string, Array<{ name: string; description?: string }>>
  >({});
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newUrl, setNewUrl] = useState("");

  const handleStateChange = useCallback(
    (
      id: string,
      state: { isConnected: boolean; isLoading: boolean; error?: string },
    ) => {
      setConnectionStates((prev) => ({ ...prev, [id]: state }));
    },
    [],
  );

  const handleToolsChange = useCallback(
    (id: string, tools: Array<{ name: string; description?: string }>) => {
      setServerTools((prev) => ({ ...prev, [id]: tools }));
    },
    [],
  );

  const connectServer = (id: string) => {
    const fn = (window as unknown as Record<string, () => void>)[
      `mcp_${id}_connect`
    ];
    if (fn) fn();
  };

  const disconnectServer = (id: string) => {
    const fn = (window as unknown as Record<string, () => void>)[
      `mcp_${id}_disconnect`
    ];
    if (fn) fn();
  };

  const addServer = () => {
    if (newName && newUrl) {
      setServers((prev) => [
        ...prev,
        {
          id: `custom-${Date.now()}`,
          name: newName,
          description: "Custom MCP Server",
          url: newUrl,
          icon: <Server className="w-4 h-4" />,
          enabled: true,
        },
      ]);
      setNewName("");
      setNewUrl("");
      setShowAddForm(false);
    }
  };

  const updateServerUrl = useCallback((id: string, newUrl: string) => {
    setServers((prev) =>
      prev.map((s) => (s.id === id ? { ...s, url: newUrl } : s)),
    );
  }, []);

  // Show all servers (even without URL so user can set it)
  const serversWithUrl = servers.filter((s) => s.url);

  return (
    <aside className="w-[400px] flex flex-col overflow-hidden">
      {/* Header */}

      {/* Invisible MCP Hook Wrappers */}
      {serversWithUrl.map((server) => (
        <MCPConnection
          key={server.id}
          server={server}
          onStateChange={handleStateChange}
          onToolsChange={handleToolsChange}
        />
      ))}

      {/* Server List */}
      <div className="flex-1 overflow-y-auto p-5 space-y-3">
        {/* Section Label */}
        <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium px-1 mb-2">
          Available MCP Servers
        </p>

        {servers.map((server) => (
          <MCPServerCard
            key={server.id}
            server={server}
            connectionState={
              connectionStates[server.id] || {
                isConnected: false,
                isLoading: false,
              }
            }
            tools={serverTools[server.id] || []}
            onConnect={() => connectServer(server.id)}
            onDisconnect={() => disconnectServer(server.id)}
            onUrlChange={(url) => updateServerUrl(server.id, url)}
          />
        ))}

        {/* Add Server Form */}
        {showAddForm && (
          <div className="p-4 bg-card rounded-xl border border-border space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Add Custom Server
              </span>
              <button
                onClick={() => setShowAddForm(false)}
                className="p-1.5 hover:bg-muted rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
            </div>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Server name"
              className="w-full px-3 py-3 text-sm rounded-lg border border-border bg-muted text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none transition-all"
            />
            <input
              type="text"
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              placeholder="URL (e.g. /api/mcp)"
              className="w-full px-3 py-3 text-sm rounded-lg border border-border bg-muted text-foreground placeholder:text-muted-foreground font-mono focus:border-primary/50 focus:outline-none transition-all"
            />
            <button
              onClick={addServer}
              disabled={!newName || !newUrl}
              className="w-full py-3 text-sm font-semibold bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              Add Server
            </button>
          </div>
        )}

        {/* Add Server Button */}
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="w-full py-3 text-sm font-medium bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground rounded-lg border border-border transition-all flex items-center justify-center gap-2 cursor-pointer"
        >
          <Plus
            className={`w-4 h-4 transition-transform duration-200 ${showAddForm ? "rotate-45" : ""}`}
          />
          {showAddForm ? "Cancel" : "Add Server"}
        </button>
      </div>
    </aside>
  );
}
