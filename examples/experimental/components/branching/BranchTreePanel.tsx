"use client";

import { useCopilot } from "@yourgpt/copilot-sdk/react";
import { cn } from "@/lib/utils";
import type { UIMessage } from "@yourgpt/copilot-sdk/react";
import type { BranchInfo } from "@yourgpt/copilot-sdk";

// ============================================
// BranchTreePanel
// ============================================

/**
 * Live branch tree visualization.
 *
 * Renders all messages across all branches (not just the visible path).
 * Active path nodes are highlighted green; inactive nodes are dimmed.
 * Clicking any node calls switchBranch() to navigate to that branch.
 */
export function BranchTreePanel() {
  const { messages, getAllMessages, getBranchInfo, switchBranch, hasBranches } =
    useCopilot();

  const allMessages = getAllMessages();
  const visibleIds = new Set(messages.map((m) => m.id));

  return (
    <div className="h-full flex flex-col text-xs">
      {/* Header */}
      <div className="px-3 py-2.5 border-b shrink-0">
        <div className="font-semibold text-sm">Branch Tree</div>
        <div className="text-muted-foreground mt-0.5 flex items-center gap-1.5 flex-wrap">
          <span>{allMessages.length} total</span>
          <span>·</span>
          <span>{messages.length} visible</span>
          {hasBranches && (
            <>
              <span>·</span>
              <span className="text-violet-600 dark:text-violet-400 font-medium">
                branched ✦
              </span>
            </>
          )}
        </div>
      </div>

      {/* Tree */}
      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {allMessages.length === 0 ? (
          <p className="text-center text-muted-foreground p-6 leading-relaxed">
            Send a message to see the tree.
            <br />
            <span className="opacity-60">
              Edit or regenerate to create branches.
            </span>
          </p>
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
      <div className="px-3 py-2 border-t shrink-0 text-muted-foreground flex gap-4">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-green-500 inline-block shrink-0" />
          active
        </span>
        <span className="flex items-center gap-1.5 opacity-50">
          <span className="w-2 h-2 rounded-full bg-zinc-400 inline-block shrink-0" />
          inactive
        </span>
      </div>
    </div>
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
        const preview = content.slice(0, 28);
        const truncated = content.length > 28;

        return (
          <div key={msg.id}>
            <button
              onClick={() => switchBranch(msg.id)}
              className={cn(
                "w-full text-left rounded px-2 py-1 transition-colors font-mono leading-snug",
                "hover:bg-muted",
                isActive ? "text-foreground" : "text-muted-foreground opacity-50",
              )}
              style={{ paddingLeft: `${8 + depth * 14}px` }}
              title={content}
            >
              {/* Active indicator dot */}
              <span
                className={cn(
                  "inline-block w-1.5 h-1.5 rounded-full mr-1.5 align-middle shrink-0",
                  isActive ? "bg-green-500" : "bg-zinc-400",
                )}
              />

              {/* Role badge */}
              <span
                className={cn(
                  "text-[10px] uppercase font-bold mr-1",
                  msg.role === "user"
                    ? "text-blue-500"
                    : "text-orange-500",
                  !isActive && "opacity-60",
                )}
              >
                {msg.role === "user" ? "U" : "A"}
              </span>

              {/* Content preview */}
              <span className="text-[11px]">
                {preview || "(empty)"}
                {truncated ? "…" : ""}
              </span>

              {/* Sibling count badge */}
              {branchInfo && (
                <span className="ml-1 text-[10px] text-violet-500 font-medium">
                  ×{branchInfo.totalSiblings}
                </span>
              )}
            </button>

            {/* Recurse into this message's children */}
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
