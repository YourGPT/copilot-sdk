"use client";

import { useState, useEffect } from "react";
import { CopilotProvider } from "@yourgpt/copilot-sdk/react";
import { CopilotChat } from "@yourgpt/copilot-sdk/ui";
import { ExternalLink, Github, Search, Globe, Zap } from "lucide-react";

export default function WebSearchDemo() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div className="dark h-screen flex bg-[var(--background)] text-[var(--foreground)]">
      {/* Left Sidebar */}
      <aside className="w-80 flex-none border-r border-[var(--border)] flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-[var(--border)]">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-[var(--primary)]/10">
              <Search className="w-5 h-5 text-[var(--primary)]" />
            </div>
            <div>
              <h1 className="text-base font-semibold">Web Search Demo</h1>
              <p className="text-xs text-[var(--muted-foreground)]">
                AI with real-time web search
              </p>
            </div>
          </div>
        </div>

        {/* Features */}
        <div className="p-5 border-b border-[var(--border)]">
          <label className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wider mb-3 block">
            Features
          </label>

          <div className="space-y-3">
            <div className="flex gap-3">
              <Zap className="w-4 h-4 text-[var(--primary)] mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium">No Extra API Key Needed</p>
                <p className="text-xs text-[var(--muted-foreground)]">
                  Uses OpenAI or Google native search
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <Globe className="w-4 h-4 text-[var(--primary)] mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium">Multi-Provider Support</p>
                <p className="text-xs text-[var(--muted-foreground)]">
                  Native + Tavily, Serper, Brave, Exa
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <Search className="w-4 h-4 text-[var(--primary)] mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium">Real-time Information</p>
                <p className="text-xs text-[var(--muted-foreground)]">
                  Current news, prices, events
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Try asking */}
        <div className="p-5 flex-1">
          <label className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wider mb-3 block">
            Try asking
          </label>

          <div className="space-y-2">
            {[
              "What are the latest AI news?",
              "What's the weather in New York?",
              "Who won the most recent Super Bowl?",
              "What's the current price of Bitcoin?",
            ].map((question, i) => (
              <div
                key={i}
                className="px-3 py-2 text-sm bg-[var(--muted)] rounded-md text-[var(--muted-foreground)]"
              >
                {question}
              </div>
            ))}
          </div>
        </div>

        {/* Footer Links */}
        <div className="p-5 border-t border-[var(--border)] space-y-2">
          <a
            href="https://tavily.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
          >
            <ExternalLink className="h-4 w-4" />
            Get Tavily API Key
          </a>
          <a
            href="https://github.com/YourGPT/copilot-sdk"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
          >
            <Github className="h-4 w-4" />
            View on GitHub
          </a>
        </div>
      </aside>

      {/* Right Side - Chat */}
      <main className="flex-1 min-w-0">
        <CopilotProvider runtimeUrl="/api/chat" maxIterations={5}>
          <CopilotChat
            showHeader
            showThreadPicker
            className="h-full"
            welcomeMessage="Hi! I can search the web for real-time information. Ask me about current events, news, prices, or anything that needs up-to-date data."
          />
        </CopilotProvider>
      </main>
    </div>
  );
}
