"use client";

import { useState, useEffect } from "react";
import { CopilotProvider } from "@yourgpt/copilot-sdk/react";
import { CopilotChat } from "@yourgpt/copilot-sdk/ui";
import {
  ChevronDown,
  ChevronRight,
  Search,
  Globe,
  FileText,
  Sparkles,
  ExternalLink,
  Github,
  Check,
  Power,
} from "lucide-react";

interface MCPServer {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  enabled: boolean;
  url?: string;
  tools: string[];
}

export default function WebSearchDemo() {
  const [mounted, setMounted] = useState(false);
  const [mcpExpanded, setMcpExpanded] = useState(true);
  const [mcpServers, setMcpServers] = useState<MCPServer[]>([
    {
      id: "web-search",
      name: "Web Search",
      description: "Search the web for real-time information",
      icon: <Search className="w-4 h-4" />,
      enabled: true,
      tools: ["search", "news", "images"],
    },
    {
      id: "web-scraper",
      name: "Web Scraper",
      description: "Extract content from any webpage",
      icon: <FileText className="w-4 h-4" />,
      enabled: false,
      tools: ["scrape", "extract", "parse"],
    },
  ]);

  useEffect(() => {
    setMounted(true);
  }, []);

  const toggleMCP = (id: string) => {
    setMcpServers((servers) =>
      servers.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s)),
    );
  };

  const enabledServers = mcpServers.filter((s) => s.enabled);

  // Build MCP config based on enabled servers
  const mcpConfig =
    enabledServers.length > 0
      ? enabledServers.map((server) => ({
          name: server.id,
          transport: "sse" as const,
          url: server.url || `https://mcp.example.io/${server.id}/sse`,
        }))
      : undefined;

  if (!mounted) return null;

  return (
    <div className="dark min-h-screen bg-[#0a0a0a] text-white">
      {/* Subtle grid pattern background */}
      <div
        className="fixed inset-0 opacity-[0.02] pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
          `,
          backgroundSize: "40px 40px",
        }}
      />

      {/* Main Layout */}
      <div className="relative flex h-screen">
        {/* Left Side - Chat Widget Demo */}
        <div className="w-[420px] flex-none border-r border-white/10 flex flex-col bg-[#0a0a0a]">
          {/* Widget Header */}
          <div className="p-6 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-black" />
              </div>
              <div>
                <h1 className="text-lg font-medium tracking-tight">
                  Web Search Widget
                </h1>
                <p className="text-xs text-white/50 font-mono uppercase tracking-widest">
                  Real-time AI Assistant
                </p>
              </div>
            </div>
          </div>

          {/* MCP Settings - Collapsible */}
          <div className="border-b border-white/10">
            <button
              onClick={() => setMcpExpanded(!mcpExpanded)}
              className="w-full px-6 py-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono uppercase tracking-widest text-white/50">
                  MCP Tools
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 bg-white/10 text-white/70">
                  {enabledServers.length} ACTIVE
                </span>
              </div>
              {mcpExpanded ? (
                <ChevronDown className="w-4 h-4 text-white/50" />
              ) : (
                <ChevronRight className="w-4 h-4 text-white/50" />
              )}
            </button>

            {/* MCP Cards */}
            <div
              className={`overflow-hidden transition-all duration-300 ${
                mcpExpanded ? "max-h-[400px] opacity-100" : "max-h-0 opacity-0"
              }`}
            >
              <div className="px-6 pb-6 space-y-3">
                {mcpServers.map((server) => (
                  <div
                    key={server.id}
                    className={`border transition-all duration-200 ${
                      server.enabled
                        ? "border-white/20 bg-white/[0.03]"
                        : "border-white/5 bg-transparent"
                    }`}
                  >
                    <div className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-8 h-8 flex items-center justify-center transition-colors ${
                              server.enabled
                                ? "bg-white text-black"
                                : "bg-white/10 text-white/50"
                            }`}
                          >
                            {server.icon}
                          </div>
                          <div>
                            <h3 className="text-sm font-medium">
                              {server.name}
                            </h3>
                            <p className="text-xs text-white/40 mt-0.5">
                              {server.description}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => toggleMCP(server.id)}
                          className={`w-8 h-8 flex items-center justify-center border transition-all ${
                            server.enabled
                              ? "border-white bg-white text-black"
                              : "border-white/20 bg-transparent text-white/50 hover:border-white/40"
                          }`}
                        >
                          {server.enabled ? (
                            <Check className="w-4 h-4" />
                          ) : (
                            <Power className="w-3 h-3" />
                          )}
                        </button>
                      </div>

                      {/* Tools */}
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {server.tools.map((tool) => (
                          <span
                            key={tool}
                            className={`text-[10px] font-mono uppercase px-2 py-1 transition-colors ${
                              server.enabled
                                ? "bg-white/10 text-white/70"
                                : "bg-white/5 text-white/30"
                            }`}
                          >
                            {tool}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Chat Widget */}
          <div className="flex-1 min-h-0">
            <CopilotProvider
              key={enabledServers.map((s) => s.id).join("-")}
              runtimeUrl="/api/chat"
              maxIterations={5}
              mcpServers={mcpConfig}
            >
              <CopilotChat
                className="h-full"
                welcomeMessage={
                  enabledServers.length > 0
                    ? `Web search is ready. I can search the web and ${
                        enabledServers.find((s) => s.id === "web-scraper")
                          ? "scrape webpages"
                          : "find real-time information"
                      } for you.`
                    : "Enable MCP tools above to unlock web search capabilities."
                }
              />
            </CopilotProvider>
          </div>
        </div>

        {/* Right Side - Website Demo Area */}
        <div className="flex-1 flex flex-col bg-[#080808]">
          {/* Demo Header */}
          <div className="px-8 py-6 border-b border-white/5 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-mono uppercase tracking-widest text-white/50">
                Integration Preview
              </h2>
              <p className="text-xs text-white/30 mt-1">
                Your website with embedded AI search widget
              </p>
            </div>
            <div className="flex items-center gap-3">
              <a
                href="https://github.com/YourGPT/copilot-sdk"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 border border-white/10 text-xs font-mono uppercase tracking-wider text-white/50 hover:text-white hover:border-white/30 transition-colors"
              >
                <Github className="w-3.5 h-3.5" />
                Source
              </a>
              <a
                href="https://docs.yourgpt.ai"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 bg-white text-black text-xs font-mono uppercase tracking-wider hover:bg-white/90 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Docs
              </a>
            </div>
          </div>

          {/* Demo Content - Simulated Website */}
          <div className="flex-1 p-8 overflow-auto">
            <div className="max-w-4xl mx-auto space-y-8">
              {/* Hero Section */}
              <div className="border border-white/5 p-12 text-center">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 border border-white/10 text-xs font-mono uppercase tracking-widest text-white/50 mb-6">
                  <Globe className="w-3 h-3" />
                  Your Website
                </div>
                <h1 className="text-4xl font-light tracking-tight mb-4">
                  Welcome to Your Platform
                </h1>
                <p className="text-white/40 max-w-xl mx-auto text-sm leading-relaxed">
                  This is a simulation of how the web search widget would appear
                  embedded in your actual website. The widget on the left
                  provides AI-powered search capabilities.
                </p>
              </div>

              {/* Feature Cards */}
              <div className="grid grid-cols-3 gap-4">
                {[
                  {
                    title: "Real-time Search",
                    desc: "Search the web for current information, news, and data.",
                    icon: <Search className="w-5 h-5" />,
                  },
                  {
                    title: "Multi-Provider",
                    desc: "Supports Tavily, Serper, Brave, and native search.",
                    icon: <Globe className="w-5 h-5" />,
                  },
                  {
                    title: "MCP Protocol",
                    desc: "Connect any MCP-compatible search or scraping service.",
                    icon: <Sparkles className="w-5 h-5" />,
                  },
                ].map((feature, i) => (
                  <div
                    key={i}
                    className="border border-white/5 p-6 hover:border-white/10 transition-colors group"
                  >
                    <div className="w-10 h-10 border border-white/10 flex items-center justify-center text-white/40 group-hover:text-white/60 group-hover:border-white/20 transition-colors mb-4">
                      {feature.icon}
                    </div>
                    <h3 className="text-sm font-medium mb-2">
                      {feature.title}
                    </h3>
                    <p className="text-xs text-white/40 leading-relaxed">
                      {feature.desc}
                    </p>
                  </div>
                ))}
              </div>

              {/* Sample Prompts */}
              <div className="border border-white/5 p-8">
                <h3 className="text-xs font-mono uppercase tracking-widest text-white/50 mb-4">
                  Try These Queries
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    "What are the latest AI news?",
                    "Current Bitcoin price",
                    "Weather in New York today",
                    "Recent tech acquisitions",
                    "Top trending GitHub repos",
                    "Latest SpaceX launch updates",
                  ].map((prompt, i) => (
                    <div
                      key={i}
                      className="px-4 py-3 bg-white/[0.02] border border-white/5 text-sm text-white/60 hover:text-white hover:border-white/10 transition-colors cursor-pointer"
                    >
                      "{prompt}"
                    </div>
                  ))}
                </div>
              </div>

              {/* Code Preview */}
              <div className="border border-white/5">
                <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
                  <span className="text-xs font-mono uppercase tracking-widest text-white/50">
                    Quick Start
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 bg-white/5 text-white/40">
                    page.tsx
                  </span>
                </div>
                <pre className="p-6 text-xs font-mono text-white/60 overflow-x-auto">
                  {`import { CopilotProvider } from "@yourgpt/copilot-sdk/react";
import { CopilotChat } from "@yourgpt/copilot-sdk/ui";

export default function App() {
  return (
    <CopilotProvider runtimeUrl="/api/chat">
      <CopilotChat
        welcomeMessage="How can I help you today?"
      />
    </CopilotProvider>
  );
}`}
                </pre>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
