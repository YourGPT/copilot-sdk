"use client";

import { CopilotProvider } from "@yourgpt/copilot-sdk/react";
import { CopilotChat } from "@yourgpt/copilot-sdk/ui";
import { BranchTreePanel } from "@/components/branching/BranchTreePanel";
import Link from "next/link";
import "@yourgpt/copilot-sdk/ui/styles.css";

export default function BranchingPage() {
  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="flex items-center gap-4 px-4 py-3 border-b shrink-0">
        <Link
          href="/"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Back
        </Link>
        <h1 className="text-sm font-semibold">Conversation Branching Demo</h1>
        <span className="text-xs bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 px-2 py-0.5 rounded-full font-mono">
          feat/branching
        </span>
        <p className="text-xs text-muted-foreground ml-auto hidden sm:block">
          Edit a message ✏ or regenerate to branch · Click nodes in the tree to
          switch variants
        </p>
      </header>

      {/* Two-panel layout inside a single CopilotProvider */}
      <div className="flex-1 flex min-h-0">
        <CopilotProvider runtimeUrl="/api/chat/branching">
          {/* Left: Branch Tree Visualization */}
          <div className="w-72 shrink-0 border-r flex flex-col overflow-hidden bg-card">
            <BranchTreePanel />
          </div>

          {/* Right: CopilotChat with full branching UI */}
          <div className="flex-1 min-w-0">
            <CopilotChat
              className="h-full"
              placeholder="Send a message, then edit ✏ or regenerate to branch…"
              showHeader
              header={{ name: "Branching Chat" }}
              showUserAvatar
            />
          </div>
        </CopilotProvider>
      </div>
    </div>
  );
}
