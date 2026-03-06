"use client";

import { useState, useEffect } from "react";
import { CopilotProvider } from "@yourgpt/copilot-sdk/react";
import { CopilotChat, useCopilotChatContext } from "@yourgpt/copilot-sdk/ui";
import {
  Search,
  MessageSquare,
  Database,
  CheckCircle2,
  XCircle,
  Settings,
} from "lucide-react";

// ============================================
// Configuration Panel
// ============================================

function ConfigPanel({
  apiKey,
  setApiKey,
  fromEnv,
}: {
  apiKey: string;
  setApiKey: (key: string) => void;
  fromEnv: boolean;
}) {
  const [showKey, setShowKey] = useState(false);
  const isConfigured = apiKey.length > 0;

  return (
    <div className="h-full flex flex-col bg-gray-50 p-6">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-600 to-purple-700 flex items-center justify-center mx-auto mb-4">
          <Database className="w-7 h-7 text-white" />
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-1">
          Knowledge Base Demo
        </h1>
        <p className="text-sm text-gray-500">YourGPT Copilot SDK</p>
      </div>

      {/* Config Card */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
            <Settings className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">API Configuration</h3>
            <p className="text-xs text-gray-500">YourGPT Knowledge Base Key</p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="relative">
            <input
              type={showKey ? "text" : "password"}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Enter your YourGPT API key..."
              className="w-full px-3 py-2.5 pr-20 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
            <button
              onClick={() => setShowKey(!showKey)}
              className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 text-xs text-gray-500 hover:text-gray-700"
            >
              {showKey ? "Hide" : "Show"}
            </button>
          </div>

          <div className="flex items-center gap-2 text-sm">
            {isConfigured ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                <span className="text-green-600">API key configured</span>
              </>
            ) : (
              <>
                <XCircle className="w-4 h-4 text-amber-500" />
                <span className="text-amber-600">Enter API key to enable</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Env indicator */}
      {fromEnv && (
        <div className="bg-blue-50 rounded-xl border border-blue-200 p-3 mb-4">
          <p className="text-xs text-blue-700">
            Loaded from{" "}
            <code className="font-mono bg-blue-100 px-1 rounded">
              YOURGPT_KB_API_KEY
            </code>
          </p>
        </div>
      )}

      {/* Code Example */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
        <h4 className="font-medium text-gray-900 mb-2 text-sm">Usage</h4>
        <pre className="text-xs bg-gray-50 p-3 rounded-lg overflow-x-auto text-gray-700">
          {`<CopilotProvider
  runtimeUrl="/api/chat"
  knowledgeBase={{
    apiKey: "your-key",
    limit: 10,
  }}
/>`}
        </pre>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Footer */}
      <p className="text-xs text-gray-400 text-center">
        Get your API key from{" "}
        <a
          href="https://app.yourgpt.ai"
          target="_blank"
          rel="noopener noreferrer"
          className="text-purple-600 hover:underline"
        >
          YourGPT Dashboard
        </a>
      </p>
    </div>
  );
}

// ============================================
// Suggestion Chips
// ============================================

function SuggestionChip({ label }: { label: string }) {
  const { send } = useCopilotChatContext();
  return (
    <button
      onClick={() => send(label)}
      className="px-3 py-1.5 text-xs bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-full transition-colors cursor-pointer whitespace-nowrap"
    >
      {label}
    </button>
  );
}

// ============================================
// Chat Panel
// ============================================

function ChatPanel({ isConfigured }: { isConfigured: boolean }) {
  return (
    <CopilotChat.Root
      persistence={false}
      className="h-full flex flex-col"
      showPoweredBy={false}
    >
      {/* Home View */}
      <CopilotChat.HomeView className="flex-1 flex flex-col">
        <div className="px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-600 to-purple-700 flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1">
              <h2 className="text-sm font-semibold text-gray-900">
                KB Assistant
              </h2>
              <p className="text-xs text-gray-500">
                {isConfigured ? "Knowledge Base enabled" : "Configure API key"}
              </p>
            </div>
          </div>
        </div>

        <div className="flex-1 flex flex-col p-5 gap-5">
          {/* Welcome */}
          <div className="bg-purple-50 rounded-xl p-4 border border-purple-100">
            <div className="flex items-start gap-3">
              <Search className="w-5 h-5 text-purple-600 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-gray-900 mb-1">
                  Ask about your knowledge base
                </p>
                <p className="text-xs text-gray-600 leading-relaxed">
                  The AI will search your trained documents using the hidden{" "}
                  <code className="bg-purple-100 px-1 rounded">
                    search_knowledge
                  </code>{" "}
                  tool.
                </p>
              </div>
            </div>
          </div>

          {/* Suggestions */}
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">
              Try asking
            </p>
            <div className="flex flex-wrap gap-2">
              <SuggestionChip label="What can you help me with?" />
              <SuggestionChip label="How do I get started?" />
              <SuggestionChip label="What features are available?" />
              <SuggestionChip label="Tell me about pricing" />
            </div>
          </div>

          <div className="flex-1" />

          <CopilotChat.Input placeholder="Ask about your knowledge base..." />
        </div>
      </CopilotChat.HomeView>

      {/* Chat View */}
      <CopilotChat.ChatView>
        <CopilotChat.Header className="flex items-center gap-3 px-5 py-3 border-b border-gray-100">
          <CopilotChat.BackButton className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600 transition-colors cursor-pointer">
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </CopilotChat.BackButton>
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-600 to-purple-700 flex items-center justify-center">
            <MessageSquare className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-semibold text-gray-900">
              KB Assistant
            </h2>
            <CopilotChat.ThreadPicker size="sm" />
          </div>
        </CopilotChat.Header>
      </CopilotChat.ChatView>
    </CopilotChat.Root>
  );
}

// ============================================
// Main Component
// ============================================

export function KnowledgeBaseDemo({
  initialApiKey,
}: {
  initialApiKey: string;
}) {
  const [apiKey, setApiKey] = useState(initialApiKey);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const savedKey = localStorage.getItem("yourgpt_kb_api_key");
    if (savedKey) {
      setApiKey(savedKey);
    }
  }, []);

  useEffect(() => {
    if (mounted && apiKey && apiKey !== initialApiKey) {
      localStorage.setItem("yourgpt_kb_api_key", apiKey);
    }
  }, [apiKey, mounted, initialApiKey]);

  if (!mounted) return null;

  const isConfigured = apiKey.length > 0;

  return (
    <div className="flex h-screen">
      {/* Left: Config Panel - 50% */}
      <div className="w-1/2 border-r border-gray-200">
        <ConfigPanel
          apiKey={apiKey}
          setApiKey={setApiKey}
          fromEnv={!!initialApiKey && apiKey === initialApiKey}
        />
      </div>

      {/* Right: Chat Panel - 50% */}
      <div className="w-1/2 bg-white">
        <CopilotProvider
          runtimeUrl="/api/chat"
          knowledgeBase={
            apiKey
              ? {
                  apiKey,
                  limit: 10,
                }
              : undefined
          }
          systemPrompt={`You are a helpful AI assistant with access to a knowledge base.

When users ask questions:
1. Use the search_knowledge tool to find relevant information
2. Synthesize the information into a helpful response
3. If no relevant information is found, acknowledge this

Be concise and helpful.`}
        >
          <ChatPanel isConfigured={isConfigured} />
        </CopilotProvider>
      </div>
    </div>
  );
}
