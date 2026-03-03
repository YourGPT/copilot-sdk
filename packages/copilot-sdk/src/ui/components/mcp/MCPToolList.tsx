"use client";

import * as React from "react";
import { cn } from "../../lib/utils";
import type { MCPToolDefinition } from "../../../mcp/types";

export interface MCPToolListProps {
  /** List of MCP tools */
  tools: MCPToolDefinition[];
  /** Custom class name */
  className?: string;
  /** Maximum tools to show (rest are collapsed) */
  maxVisible?: number;
  /** Show tool input schema */
  showSchema?: boolean;
  /** On tool click callback */
  onToolClick?: (tool: MCPToolDefinition) => void;
  /** Empty state message */
  emptyMessage?: string;
}

/**
 * MCP tool list display
 *
 * Shows available tools from an MCP server with their descriptions.
 */
export function MCPToolList({
  tools,
  className,
  maxVisible = 10,
  showSchema = false,
  onToolClick,
  emptyMessage = "No tools available",
}: MCPToolListProps) {
  const [expanded, setExpanded] = React.useState(false);

  if (tools.length === 0) {
    return (
      <div className={cn("text-sm text-muted-foreground py-2", className)}>
        {emptyMessage}
      </div>
    );
  }

  const visibleTools = expanded ? tools : tools.slice(0, maxVisible);
  const hiddenCount = tools.length - maxVisible;

  return (
    <div className={cn("space-y-1", className)}>
      {visibleTools.map((tool) => (
        <MCPToolItem
          key={tool.name}
          tool={tool}
          showSchema={showSchema}
          onClick={onToolClick ? () => onToolClick(tool) : undefined}
        />
      ))}

      {hiddenCount > 0 && !expanded && (
        <button
          onClick={() => setExpanded(true)}
          className="text-xs text-primary hover:underline py-1"
        >
          Show {hiddenCount} more tools...
        </button>
      )}

      {expanded && tools.length > maxVisible && (
        <button
          onClick={() => setExpanded(false)}
          className="text-xs text-primary hover:underline py-1"
        >
          Show less
        </button>
      )}
    </div>
  );
}

export interface MCPToolItemProps {
  /** Tool definition */
  tool: MCPToolDefinition;
  /** Show input schema details */
  showSchema?: boolean;
  /** Click handler */
  onClick?: () => void;
  /** Custom class name */
  className?: string;
}

/**
 * Single MCP tool item display
 */
export function MCPToolItem({
  tool,
  showSchema = false,
  onClick,
  className,
}: MCPToolItemProps) {
  const [schemaExpanded, setSchemaExpanded] = React.useState(false);
  const hasParams =
    tool.inputSchema?.properties &&
    Object.keys(tool.inputSchema.properties).length > 0;

  return (
    <div
      className={cn(
        "p-2 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors",
        onClick && "cursor-pointer",
        className,
      )}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="font-mono text-xs font-medium text-foreground truncate">
            {tool.name}
          </div>
          {tool.description && (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
              {tool.description}
            </p>
          )}
        </div>

        {showSchema && hasParams && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setSchemaExpanded(!schemaExpanded);
            }}
            className="text-xs text-muted-foreground hover:text-foreground shrink-0"
          >
            {schemaExpanded ? "Hide" : "Params"}
          </button>
        )}
      </div>

      {showSchema && schemaExpanded && hasParams && (
        <div className="mt-2 pt-2 border-t border-border/50">
          <div className="space-y-1">
            {Object.entries(tool.inputSchema.properties || {}).map(
              ([name, prop]) => (
                <div key={name} className="text-xs">
                  <span className="font-mono text-primary">{name}</span>
                  {prop.type && (
                    <span className="text-muted-foreground ml-1">
                      (
                      {Array.isArray(prop.type)
                        ? prop.type.join(" | ")
                        : prop.type}
                      )
                    </span>
                  )}
                  {tool.inputSchema.required?.includes(name) && (
                    <span className="text-red-500 ml-1">*</span>
                  )}
                  {prop.description && (
                    <p className="text-muted-foreground ml-2 mt-0.5">
                      {prop.description}
                    </p>
                  )}
                </div>
              ),
            )}
          </div>
        </div>
      )}
    </div>
  );
}
