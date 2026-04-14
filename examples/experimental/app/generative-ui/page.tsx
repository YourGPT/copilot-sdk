"use client";

import { CopilotProvider } from "@yourgpt/copilot-sdk/react";
import { CopilotChat } from "@yourgpt/copilot-sdk/ui";
import { useGenerativeUI } from "@yourgpt/copilot-sdk/experimental";
import Link from "next/link";
import "@yourgpt/copilot-sdk/ui/styles.css";

const PROMPT_SUGGESTIONS = [
  "Build a shadcn-style analytics dashboard with a Chart.js bar chart of monthly revenue and 3 KPI stat cards",
  "Show a shadcn card grid of the top 5 programming languages with usage %, trend badge, and color",
  "Render a Chart.js doughnut chart of browser market share with a legend",
  "Give me a stat dashboard of key web metrics",
  "Show me a table of the top 10 S&P 500 companies by market cap",
  "Create a card for Elon Musk with key facts",
  "Build a shadcn pricing page with 3 tiers, feature lists, and a highlighted popular plan",
  "Show a line chart of BTC price over the last 6 months",
  "Render a Chart.js radar chart comparing React, Vue, Angular, and Svelte across 5 metrics",
];

function GenerativeUIChatInner() {
  useGenerativeUI({ name: "render_ui" });

  return (
    <CopilotChat
      className="h-full"
      placeholder="Ask for dashboards, charts, tables, cards…"
      showHeader
      header={{ name: "Generative UI" }}
      loaderVariant="wave"
      showUserAvatar
    />
  );
}

export default function GenerativeUIPage() {
  return (
    <>
      <style>{`
        .gui-root {
          background-color: #080b12;
          background-image:
            radial-gradient(ellipse 80% 50% at 10% -10%, rgba(16,185,129,0.08) 0%, transparent 55%),
            radial-gradient(ellipse 70% 45% at 90% 110%, rgba(59,130,246,0.07) 0%, transparent 55%);
          font-family: system-ui, -apple-system, sans-serif;
        }
        .gui-accent-line {
          height: 3px;
          background: linear-gradient(90deg,
            transparent 0%,
            rgba(16,185,129,0.35) 20%,
            rgba(52,211,153,0.65) 50%,
            rgba(59,130,246,0.4) 80%,
            transparent 100%);
          flex-shrink: 0;
        }
        .gui-header {
          background: rgba(8,11,18,0.85);
          backdrop-filter: blur(16px);
          border-bottom: 1px solid rgba(255,255,255,0.055);
          flex-shrink: 0;
        }
        .gui-back {
          display: flex;
          align-items: center;
          gap: 5px;
          color: #475569;
          font-size: 12px;
          text-decoration: none;
          transition: color 0.15s;
        }
        .gui-back:hover { color: #94a3b8; }
        .gui-divider {
          width: 1px;
          height: 16px;
          background: rgba(255,255,255,0.08);
          flex-shrink: 0;
        }
        .gui-badge {
          font-size: 10px;
          font-weight: 600;
          padding: 2px 8px;
          border-radius: 999px;
          background: rgba(16,185,129,0.1);
          border: 1px solid rgba(16,185,129,0.25);
          color: #34d399;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }
        .gui-sidebar {
          width: 256px;
          flex-shrink: 0;
          background: rgba(255,255,255,0.015);
          border-right: 1px solid rgba(255,255,255,0.055);
          display: flex;
          flex-direction: column;
          gap: 0;
          overflow-y: auto;
        }
        .gui-sidebar-title {
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #334155;
          padding: 16px 16px 8px;
        }
        .gui-prompt-btn {
          width: 100%;
          text-align: left;
          padding: 9px 16px;
          font-size: 12px;
          color: #64748b;
          background: transparent;
          border: none;
          cursor: pointer;
          border-bottom: 1px solid rgba(255,255,255,0.03);
          transition: background 0.1s, color 0.1s;
          line-height: 1.4;
        }
        .gui-prompt-btn:hover {
          background: rgba(255,255,255,0.03);
          color: #94a3b8;
        }
      `}</style>

      <div className="gui-root h-screen flex flex-col">
        <div className="gui-accent-line" />

        {/* Header */}
        <header className="gui-header flex items-center gap-3.5 px-5 py-3">
          <Link href="/" className="gui-back">
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

          <div className="gui-divider" />

          <div className="flex items-center gap-2.5">
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#34d399"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
            <span
              style={{
                fontWeight: 700,
                fontSize: 14,
                letterSpacing: "-0.02em",
                color: "#e2e8f0",
              }}
            >
              Generative UI
            </span>
          </div>

          <span className="gui-badge ml-1">Experimental</span>

          <div className="ml-auto" style={{ fontSize: 11, color: "#334155" }}>
            HTML · Tailwind · Chart.js
          </div>
        </header>

        {/* Two-panel layout */}
        <div className="flex-1 flex min-h-0">
          <CopilotProvider runtimeUrl="/api/chat/generative-ui">
            {/* Left: Prompt suggestions */}
            <div className="gui-sidebar hidden lg:flex flex-col">
              <p className="gui-sidebar-title">Try asking…</p>
              {PROMPT_SUGGESTIONS.map((prompt) => (
                <button
                  key={prompt}
                  className="gui-prompt-btn"
                  onClick={() => {
                    // Find the CopilotChat input and populate it
                    const input = document.querySelector<HTMLTextAreaElement>(
                      "textarea[placeholder]",
                    );
                    if (input) {
                      const nativeInputValueSetter =
                        Object.getOwnPropertyDescriptor(
                          window.HTMLTextAreaElement.prototype,
                          "value",
                        )?.set;
                      nativeInputValueSetter?.call(input, prompt);
                      input.dispatchEvent(
                        new Event("input", { bubbles: true }),
                      );
                      input.focus();
                    }
                  }}
                >
                  {prompt}
                </button>
              ))}
            </div>

            {/* Right: Chat */}
            <div className="flex-1 min-w-0">
              <GenerativeUIChatInner />
            </div>
          </CopilotProvider>
        </div>
      </div>
    </>
  );
}
