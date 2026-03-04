"use client";

import { useState } from "react";
import {
  ChevronRight,
  Loader2,
  Terminal,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
} from "lucide-react";
import type { ToolRendererProps } from "@yourgpt/copilot-sdk/ui";

/**
 * MCP Tool Renderer - Collapsible card for displaying MCP tool executions
 * Similar to Claude's tool execution display
 */
export function MCPToolRenderer({ execution }: ToolRendererProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const isLoading =
    execution.status === "pending" || execution.status === "executing";
  const isError = execution.status === "error" || execution.status === "failed";
  const isCompleted = execution.status === "completed";

  // Format tool name (remove prefix if present)
  const displayName = execution.name.includes(":")
    ? execution.name.split(":").slice(1).join(":")
    : execution.name;

  // Copy result to clipboard
  const copyResult = () => {
    const text = isError
      ? execution.error || "Error"
      : JSON.stringify(execution.result, null, 2);
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Format JSON for display
  const formatJson = (data: unknown) => {
    try {
      return JSON.stringify(data, null, 2);
    } catch {
      return String(data);
    }
  };

  return (
    <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 overflow-hidden">
      {/* Header - Always visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-zinc-800/30 transition-colors cursor-pointer"
      >
        {/* Status Icon */}
        <div
          className={`w-8 h-8 rounded-lg flex items-center justify-center ${
            isLoading
              ? "bg-amber-500/10 text-amber-400"
              : isError
                ? "bg-red-500/10 text-red-400"
                : "bg-emerald-500/10 text-emerald-400"
          }`}
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : isError ? (
            <XCircle className="w-4 h-4" />
          ) : (
            <CheckCircle2 className="w-4 h-4" />
          )}
        </div>

        {/* Tool Info */}
        <div className="flex-1 text-left">
          <div className="flex items-center gap-2">
            <Terminal className="w-3.5 h-3.5 text-zinc-500" />
            <span className="text-sm font-medium text-zinc-200">
              {displayName}
            </span>
            {execution.source === "mcp" && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/20 text-primary font-medium">
                MCP
              </span>
            )}
          </div>
          <p className="text-xs text-zinc-500 mt-0.5">
            {isLoading ? "Executing..." : isError ? "Failed" : "Completed"}
          </p>
        </div>

        {/* Expand Arrow */}
        <ChevronRight
          className={`w-4 h-4 text-zinc-500 transition-transform duration-200 ${
            isExpanded ? "rotate-90" : ""
          }`}
        />
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t border-zinc-800/50">
          {/* Arguments Section */}
          {execution.args && Object.keys(execution.args).length > 0 && (
            <div className="px-4 py-3 border-b border-zinc-800/50">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
                  Arguments
                </span>
              </div>
              <pre className="text-xs text-zinc-400 bg-zinc-950/50 rounded-lg p-3 overflow-x-auto font-mono">
                {formatJson(execution.args)}
              </pre>
            </div>
          )}

          {/* Result/Error Section */}
          <div className="px-4 py-3">
            <div className="flex items-center justify-between mb-2">
              <span
                className={`text-[10px] font-semibold uppercase tracking-wider ${
                  isError ? "text-red-400" : "text-zinc-500"
                }`}
              >
                {isError ? "Error" : "Result"}
              </span>
              {(isCompleted || isError) && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    copyResult();
                  }}
                  className="flex items-center gap-1 text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
                >
                  {copied ? (
                    <>
                      <Check className="w-3 h-3" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      Copy
                    </>
                  )}
                </button>
              )}
            </div>

            {isLoading ? (
              <div className="flex items-center gap-2 text-sm text-zinc-500">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Running tool...</span>
              </div>
            ) : isError ? (
              <pre className="text-xs text-red-400 bg-red-950/30 rounded-lg p-3 overflow-x-auto font-mono border border-red-900/30">
                {execution.error || "Unknown error"}
              </pre>
            ) : (
              <pre className="text-xs text-zinc-400 bg-zinc-950/50 rounded-lg p-3 overflow-x-auto font-mono max-h-64 overflow-y-auto">
                {formatJson(execution.result)}
              </pre>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
