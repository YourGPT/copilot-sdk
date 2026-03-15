"use client";

import { useCopilot } from "@yourgpt/copilot-sdk/react";
import { cn } from "@/lib/utils";
import type { UIMessage } from "@yourgpt/copilot-sdk/react";
import type { BranchInfo } from "@yourgpt/copilot-sdk";

// ============================================
// BranchTreePanel
// ============================================

export function BranchTreePanel() {
  const { messages, getAllMessages, getBranchInfo, switchBranch, hasBranches } =
    useCopilot();

  const allMessages = getAllMessages();
  const visibleIds = new Set(messages.map((m) => m.id));

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@600;700&family=JetBrains+Mono:wght@400;500&display=swap');

        .btp-root {
          height: 100%;
          display: flex;
          flex-direction: column;
          font-size: 11px;
        }

        .btp-header {
          padding: 12px 14px 10px;
          border-bottom: 1px solid rgba(255,255,255,0.055);
          flex-shrink: 0;
        }

        .btp-header-title {
          font-family: 'Syne', system-ui, sans-serif;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: #475569;
          margin-bottom: 8px;
        }

        .btp-stats {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-wrap: wrap;
        }

        .btp-stat-chip {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 2px 7px;
          border-radius: 5px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.07);
          font-family: 'JetBrains Mono', monospace;
          font-size: 10px;
          color: #64748b;
        }

        .btp-stat-chip-value {
          color: #94a3b8;
          font-weight: 500;
        }

        .btp-branched-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 2px 7px;
          border-radius: 5px;
          background: rgba(99,102,241,0.1);
          border: 1px solid rgba(99,102,241,0.2);
          font-size: 10px;
          font-weight: 600;
          color: #818cf8;
          letter-spacing: 0.02em;
        }

        .btp-tree {
          flex: 1;
          overflow-y: auto;
          padding: 8px 6px;
          scrollbar-width: thin;
          scrollbar-color: rgba(255,255,255,0.07) transparent;
        }

        .btp-tree::-webkit-scrollbar { width: 3px; }
        .btp-tree::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.07); border-radius: 99px; }

        .btp-empty {
          text-align: center;
          color: #334155;
          padding: 28px 16px;
          line-height: 1.6;
          font-size: 11px;
        }

        .btp-node-wrap {
          position: relative;
        }

        .btp-connector-v {
          position: absolute;
          border-left: 1px solid rgba(255,255,255,0.06);
          top: 0;
          bottom: 0;
          pointer-events: none;
        }

        .btp-connector-h {
          position: absolute;
          border-bottom: 1px solid rgba(255,255,255,0.06);
          top: 10px;
          width: 8px;
          pointer-events: none;
        }

        .btp-node-btn {
          width: 100%;
          text-align: left;
          border-radius: 5px;
          padding: 4px 8px 4px 8px;
          transition: background 0.12s, opacity 0.12s;
          font-family: 'JetBrains Mono', 'Fira Mono', monospace;
          font-size: 10.5px;
          line-height: 1.4;
          display: flex;
          align-items: center;
          gap: 5px;
          cursor: pointer;
          background: transparent;
          border: none;
          outline: none;
          position: relative;
          color: inherit;
        }

        .btp-node-btn:hover {
          background: rgba(255,255,255,0.04);
        }

        .btp-node-btn.active {
          color: #e2e8f0;
        }

        .btp-node-btn.inactive {
          color: #334155;
          opacity: 0.7;
        }

        .btp-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          flex-shrink: 0;
          transition: box-shadow 0.15s;
        }

        .btp-dot.active-dot {
          background: #4ade80;
          box-shadow: 0 0 5px rgba(74,222,128,0.5);
        }

        .btp-dot.inactive-dot {
          background: #1e293b;
          border: 1px solid #334155;
        }

        .btp-role-badge {
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 0.05em;
          flex-shrink: 0;
          width: 14px;
          text-align: center;
        }

        .btp-role-user { color: #38bdf8; }
        .btp-role-ai { color: #fb923c; }

        .btp-preview {
          flex: 1;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-size: 10.5px;
        }

        .btp-siblings-badge {
          font-size: 9px;
          font-weight: 600;
          color: #6366f1;
          background: rgba(99,102,241,0.1);
          border: 1px solid rgba(99,102,241,0.2);
          padding: 0px 4px;
          border-radius: 3px;
          flex-shrink: 0;
          font-family: 'JetBrains Mono', monospace;
        }

        .btp-legend {
          padding: 8px 14px;
          border-top: 1px solid rgba(255,255,255,0.055);
          flex-shrink: 0;
          display: flex;
          gap: 14px;
        }

        .btp-legend-item {
          display: flex;
          align-items: center;
          gap: 5px;
          font-size: 10px;
          color: #334155;
        }

        .btp-legend-dot-active {
          width: 6px; height: 6px; border-radius: 50%;
          background: #4ade80;
          box-shadow: 0 0 4px rgba(74,222,128,0.4);
        }

        .btp-legend-dot-inactive {
          width: 6px; height: 6px; border-radius: 50%;
          background: #1e293b;
          border: 1px solid #334155;
        }
      `}</style>

      <div className="btp-root">
        {/* Header */}
        <div className="btp-header">
          <div className="btp-header-title">Branch Tree</div>
          <div className="btp-stats">
            <div className="btp-stat-chip">
              <span className="btp-stat-chip-value">{allMessages.length}</span>
              total
            </div>
            <div className="btp-stat-chip">
              <span className="btp-stat-chip-value">{messages.length}</span>
              visible
            </div>
            {hasBranches && (
              <div className="btp-branched-badge">✦ branched</div>
            )}
          </div>
        </div>

        {/* Tree */}
        <div className="btp-tree">
          {allMessages.length === 0 ? (
            <div className="btp-empty">
              Send a message to see the tree.
              <br />
              <span style={{ opacity: 0.5 }}>
                Edit or regenerate to branch.
              </span>
            </div>
          ) : (
            <TreeNodes
              allMessages={allMessages}
              parentId={null}
              depth={0}
              visibleIds={visibleIds}
              getBranchInfo={getBranchInfo}
              switchBranch={switchBranch}
            />
          )}
        </div>

        {/* Legend */}
        <div className="btp-legend">
          <div className="btp-legend-item">
            <div className="btp-legend-dot-active" />
            active
          </div>
          <div className="btp-legend-item">
            <div className="btp-legend-dot-inactive" />
            inactive
          </div>
        </div>
      </div>
    </>
  );
}

// ============================================
// TreeNodes — recursive renderer
// ============================================

interface TreeNodesProps {
  allMessages: UIMessage[];
  parentId: string | null;
  depth: number;
  visibleIds: Set<string>;
  getBranchInfo: (id: string) => BranchInfo | null;
  switchBranch: (id: string) => void;
}

function TreeNodes({
  allMessages,
  parentId,
  depth,
  visibleIds,
  getBranchInfo,
  switchBranch,
}: TreeNodesProps) {
  const children = allMessages.filter((m) =>
    parentId === null
      ? m.parentId === null || m.parentId === undefined
      : m.parentId === parentId,
  );

  if (children.length === 0) return null;

  return (
    <>
      {children.map((msg) => {
        const isActive = visibleIds.has(msg.id);
        const branchInfo = getBranchInfo(msg.id);
        const content = msg.content ?? "";
        const preview = content.slice(0, 26);
        const truncated = content.length > 26;
        const indentPx = depth * 14;

        return (
          <div key={msg.id} className="btp-node-wrap">
            {/* Tree connector lines */}
            {depth > 0 && (
              <>
                <div
                  className="btp-connector-v"
                  style={{ left: `${indentPx - 7}px` }}
                />
                <div
                  className="btp-connector-h"
                  style={{ left: `${indentPx - 7}px`, width: "9px" }}
                />
              </>
            )}

            <button
              onClick={() => switchBranch(msg.id)}
              className={cn("btp-node-btn", isActive ? "active" : "inactive")}
              style={{ paddingLeft: `${8 + indentPx}px` }}
              title={content}
            >
              <span
                className={cn(
                  "btp-dot",
                  isActive ? "active-dot" : "inactive-dot",
                )}
              />
              <span
                className={cn(
                  "btp-role-badge",
                  msg.role === "user" ? "btp-role-user" : "btp-role-ai",
                )}
              >
                {msg.role === "user" ? "U" : "A"}
              </span>
              <span className="btp-preview">
                {preview || "(empty)"}
                {truncated ? "…" : ""}
              </span>
              {branchInfo && (
                <span className="btp-siblings-badge">
                  ×{branchInfo.totalSiblings}
                </span>
              )}
            </button>

            <TreeNodes
              allMessages={allMessages}
              parentId={msg.id}
              depth={depth + 1}
              visibleIds={visibleIds}
              getBranchInfo={getBranchInfo}
              switchBranch={switchBranch}
            />
          </div>
        );
      })}
    </>
  );
}
