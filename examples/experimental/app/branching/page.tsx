"use client";

import { CopilotProvider } from "@yourgpt/copilot-sdk/react";
import { CopilotChat } from "@yourgpt/copilot-sdk/ui";
import { BranchTreePanel } from "@/components/branching/BranchTreePanel";
import Link from "next/link";
import "@yourgpt/copilot-sdk/ui/styles.css";

export default function BranchingPage() {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');

        .bp-root {
          background-color: #07090f;
          background-image:
            radial-gradient(ellipse 90% 60% at 15% -5%, rgba(99,102,241,0.10) 0%, transparent 55%),
            radial-gradient(ellipse 70% 50% at 85% 105%, rgba(139,92,246,0.07) 0%, transparent 55%);
          font-family: system-ui, -apple-system, sans-serif;
        }

        .bp-accent-line {
          height: 3px;
          background: linear-gradient(90deg,
            transparent 0%,
            rgba(99,102,241,0.4) 20%,
            rgba(167,139,250,0.7) 50%,
            rgba(99,102,241,0.4) 80%,
            transparent 100%);
          flex-shrink: 0;
        }

        .bp-header {
          background: rgba(7, 9, 15, 0.85);
          backdrop-filter: blur(16px);
          border-bottom: 1px solid rgba(255,255,255,0.055);
          flex-shrink: 0;
        }

        .bp-back {
          display: flex;
          align-items: center;
          gap: 5px;
          color: #475569;
          font-size: 12px;
          text-decoration: none;
          transition: color 0.15s;
        }
        .bp-back:hover { color: #94a3b8; }

        .bp-divider {
          width: 1px;
          height: 16px;
          background: rgba(255,255,255,0.08);
          flex-shrink: 0;
        }

        .bp-logo-icon {
          width: 26px;
          height: 26px;
          border-radius: 7px;
          background: rgba(99,102,241,0.15);
          border: 1px solid rgba(99,102,241,0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .bp-logo-text {
          font-family: 'Syne', system-ui, sans-serif;
          font-weight: 700;
          font-size: 14px;
          letter-spacing: -0.02em;
          color: #e2e8f0;
        }

        .bp-branch-badge {
          font-family: 'JetBrains Mono', 'Fira Mono', monospace;
          font-size: 10.5px;
          font-weight: 500;
          padding: 2px 9px;
          border-radius: 999px;
          background: rgba(99,102,241,0.1);
          border: 1px solid rgba(99,102,241,0.22);
          color: #a5b4fc;
          letter-spacing: 0.01em;
        }

        .bp-hint {
          font-size: 11px;
          color: #334155;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .bp-hint-dot { color: #1e293b; }

        .bp-panel-left {
          width: 272px;
          flex-shrink: 0;
          background: rgba(255,255,255,0.015);
          border-right: 1px solid rgba(255,255,255,0.055);
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .bp-panel-right {
          flex: 1;
          min-width: 0;
        }
      `}</style>

      <div className="bp-root h-screen flex flex-col">
        {/* Top gradient accent line */}
        <div className="bp-accent-line" />

        {/* Header */}
        <header className="bp-header flex items-center gap-3.5 px-5 py-3">
          {/* Back */}
          <Link href="/" className="bp-back">
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M19 12H5M12 5l-7 7 7 7" />
            </svg>
            Back
          </Link>

          <div className="bp-divider" />

          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div className="bp-logo-icon">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 2L2 7l10 5 10-5-10-5z"
                  stroke="#818cf8"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M2 17l10 5 10-5"
                  stroke="#818cf8"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M2 12l10 5 10-5"
                  stroke="#a5b4fc"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <span className="bp-logo-text">Copilot SDK</span>
          </div>

          {/* Right hint */}
          <div className="ml-auto bp-hint hidden sm:flex">
            <svg
              width="11"
              height="11"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#4f46e5"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
            Edit to branch
            <span className="bp-hint-dot">·</span>
            Click tree nodes to switch
          </div>
        </header>

        {/* Two-panel layout */}
        <div className="flex-1 flex min-h-0">
          <CopilotProvider runtimeUrl="/api/chat/non-streaming">
            {/* Left: Branch Tree */}
            <div className="bp-panel-left">
              <BranchTreePanel />
            </div>

            {/* Right: Chat */}
            <div className="bp-panel-right">
              <CopilotChat
                className="h-full"
                placeholder="Send a message, then edit ✏ or regenerate to branch…"
                showHeader
                header={{ name: "AI Copilot" }}
                loaderVariant="wave"
                showUserAvatar
              />
            </div>
          </CopilotProvider>
        </div>
      </div>
    </>
  );
}
