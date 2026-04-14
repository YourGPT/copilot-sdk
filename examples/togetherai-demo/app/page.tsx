"use client";

import { useState, useMemo, useEffect } from "react";
import { CopilotProvider } from "@yourgpt/copilot-sdk/react";
import { CopilotChat } from "@yourgpt/copilot-sdk/ui";
import {
  MODEL_GROUPS,
  ALL_MODELS,
  DEFAULT_MODEL,
  FALLBACK_MODELS,
} from "@/lib/models";
import {
  ExternalLink,
  Github,
  Terminal,
  Copy,
  Check,
  ChevronDown,
  Shield,
} from "lucide-react";

export default function TogetherAIDemo() {
  const [mounted, setMounted] = useState(false);
  const [selectedModel, setSelectedModel] = useState(DEFAULT_MODEL);
  const [fallbackEnabled, setFallbackEnabled] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleCopy = () => {
    navigator.clipboard.writeText("TOGETHER_API_KEY=your-key-here");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const runtimeUrl = useMemo(() => {
    const params = new URLSearchParams();
    params.set("model", selectedModel);
    if (fallbackEnabled) params.set("fallback", "true");
    return `/api/chat?${params.toString()}`;
  }, [selectedModel, fallbackEnabled]);

  const selectedModelInfo = ALL_MODELS.find((m) => m.id === selectedModel);

  if (!mounted) return null;

  return (
    <div className="dark h-screen flex bg-background text-foreground">
      {/* Left Sidebar */}
      <aside className="w-80 flex-none border-r border-border flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary/10">
              <svg
                viewBox="0 0 24 24"
                className="w-5 h-5 text-primary"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v6l4 2" />
              </svg>
            </div>
            <div>
              <h1 className="text-base font-semibold">Together AI Demo</h1>
              <p className="text-xs text-muted-foreground">
                Open-source models via Copilot SDK
              </p>
            </div>
          </div>
        </div>

        {/* Model Selection */}
        <div className="p-5 border-b border-border">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3 block">
            Model
          </label>
          <div className="relative">
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="w-full h-9 px-3 pr-8 text-sm font-mono bg-background border border-border rounded-md appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {MODEL_GROUPS.map((group) => (
                <optgroup key={group.provider} label={group.provider}>
                  {group.models.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          </div>
          {selectedModelInfo && (
            <p className="mt-2 text-xs text-muted-foreground font-mono truncate">
              {selectedModelInfo.id}
            </p>
          )}
        </div>

        {/* Fallback Chain */}
        <div className="p-5 border-b border-border">
          <div className="flex items-center justify-between mb-3">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Fallback Chain
            </label>
            <button
              onClick={() => setFallbackEnabled(!fallbackEnabled)}
              className={`relative w-9 h-5 rounded-full transition-colors ${
                fallbackEnabled ? "bg-primary" : "bg-muted"
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                  fallbackEnabled ? "translate-x-4" : "translate-x-0"
                }`}
              />
            </button>
          </div>
          {fallbackEnabled ? (
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-xs text-emerald-400">
                <Shield className="h-3 w-3" />
                <span>Auto-failover enabled</span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                If the primary model fails, the request automatically falls
                through to the next model in the chain:
              </p>
              <div className="mt-2 space-y-1">
                {FALLBACK_MODELS.map((id, i) => (
                  <div
                    key={id}
                    className={`flex items-center gap-2 text-[11px] font-mono ${
                      id === selectedModel
                        ? "text-primary"
                        : "text-muted-foreground"
                    }`}
                  >
                    <span className="w-4 text-right text-[10px] opacity-50">
                      {i + 1}.
                    </span>
                    <span className="truncate">
                      {id === selectedModel ? `${id} (primary)` : id}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-[11px] text-muted-foreground">
              Enable to automatically try backup models when the primary model
              is unavailable or rate-limited.
            </p>
          )}
        </div>

        {/* Setup Guide */}
        <div className="p-5 flex-1">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3 block">
            Setup
          </label>

          <div className="space-y-4">
            {/* Step 1 */}
            <div className="flex gap-3">
              <div className="flex-none w-5 h-5 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center font-medium">
                1
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground">Get your API key</p>
                <a
                  href="https://api.together.xyz/settings/api-keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1"
                >
                  api.together.xyz/settings
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>

            {/* Step 2 */}
            <div className="flex gap-3">
              <div className="flex-none w-5 h-5 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center font-medium">
                2
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground">Add to .env.local</p>
                <div className="mt-2 relative">
                  <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-md font-mono text-xs text-muted-foreground">
                    <Terminal className="h-3 w-3 flex-none" />
                    <code className="truncate">TOGETHER_API_KEY=...</code>
                    <button
                      onClick={handleCopy}
                      className="flex-none ml-auto text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {copied ? (
                        <Check className="h-3.5 w-3.5 text-emerald-500" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Step 3 */}
            <div className="flex gap-3">
              <div className="flex-none w-5 h-5 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center font-medium">
                3
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground">
                  Restart the dev server
                </p>
                <div className="mt-2">
                  <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-md font-mono text-xs text-muted-foreground">
                    <Terminal className="h-3 w-3 flex-none" />
                    <code>pnpm dev</code>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Links */}
        <div className="p-5 border-t border-border space-y-2">
          <a
            href="https://api.together.xyz/models"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ExternalLink className="h-4 w-4" />
            Explore all models
          </a>
          <a
            href="https://github.com/YourGPT/copilot-sdk"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <Github className="h-4 w-4" />
            View on GitHub
          </a>
        </div>
      </aside>

      {/* Right Side - Chat */}
      <main className="flex-1 min-w-0">
        <CopilotProvider
          key={`${selectedModel}-${fallbackEnabled}`}
          runtimeUrl={runtimeUrl}
          maxIterations={5}
        >
          <CopilotChat className="h-full" />
        </CopilotProvider>
      </main>
    </div>
  );
}
