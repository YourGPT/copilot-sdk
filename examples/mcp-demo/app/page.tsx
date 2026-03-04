"use client";

import { useState, useCallback } from "react";
import { CopilotProvider, useMCPUIIntents } from "@yourgpt/copilot-sdk/react";
import { CopilotChat, useCopilotChatContext } from "@yourgpt/copilot-sdk/ui";
import "@yourgpt/copilot-sdk/ui/styles.css";
import { MCPToolRenderer } from "./components/mcp-tool-renderer";
import { MCPConfigSidebar } from "./components/mcp-sidebar";
import {
  ChevronLeft,
  Zap,
  Mail,
  Search,
  Youtube,
  TrendingUp,
  MapPin,
  Newspaper,
  X,
  Sparkles,
} from "lucide-react";

// ============================================
// Types
// ============================================
interface Notification {
  id: string;
  message: string;
  level: string;
}

// ============================================
// Suggestion Card
// ============================================
function SuggestionCard({
  icon: Icon,
  label,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  const { send } = useCopilotChatContext();
  return (
    <button
      onClick={() => send(label)}
      className="group flex items-center gap-3 px-3.5 py-2.5 rounded-xl bg-muted/50 border border-border hover:bg-muted hover:border-border transition-all duration-200 text-left w-full cursor-pointer"
    >
      <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center group-hover:bg-primary/15 transition-all duration-200">
        <Icon className="w-3.5 h-3.5 text-primary" />
      </div>
      <span className="text-[13px] text-muted-foreground group-hover:text-foreground transition-colors">
        {label}
      </span>
    </button>
  );
}

function QuickSuggestions() {
  return (
    <div className="flex flex-col gap-2 w-full">
      <SuggestionCard
        icon={Youtube}
        label="Search YouTube for Next.js 15 tutorials"
      />
      <SuggestionCard
        icon={TrendingUp}
        label="Compare trends: React vs Vue vs Svelte"
      />
      <SuggestionCard
        icon={Search}
        label="Search latest AI agent frameworks 2024"
      />
      <SuggestionCard icon={Newspaper} label="Get tech news about OpenAI" />
      <SuggestionCard
        icon={MapPin}
        label="Find coworking spaces in San Francisco"
      />
    </div>
  );
}

// ============================================
// Toast Notification
// ============================================
function Toast({
  message,
  level,
  onDismiss,
}: {
  message: string;
  level: string;
  onDismiss: () => void;
}) {
  const colors: Record<string, string> = {
    success: "bg-emerald-500/90 border-emerald-400/30",
    error: "bg-red-500/90 border-red-400/30",
    warning: "bg-amber-500/90 border-amber-400/30",
    info: "bg-sky-500/90 border-sky-400/30",
  };
  return (
    <div
      className={`${colors[level] || colors.info} text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 text-sm border backdrop-blur-sm animate-slide-in`}
    >
      <span className="font-medium">{message}</span>
      <button
        onClick={onDismiss}
        className="hover:bg-white/20 rounded-lg w-6 h-6 flex items-center justify-center transition-colors cursor-pointer"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// ============================================
// Main Dashboard Content
// ============================================
function DashboardContent() {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const addNotification = useCallback(
    (message: string, level: string = "info") => {
      const id = Date.now().toString();
      setNotifications((prev) => [...prev, { id, message, level }]);
      setTimeout(
        () => setNotifications((prev) => prev.filter((n) => n.id !== id)),
        3000,
      );
    },
    [],
  );

  useMCPUIIntents({
    onIntent: useCallback(
      (action: string, data?: Record<string, unknown>) => {
        if (action === "add_to_cart") {
          addNotification(`Added ${data?.quantity}x item to cart!`, "success");
        }
      },
      [addNotification],
    ),
    onNotify: useCallback(
      (message: string, level?: string) => {
        addNotification(message, level || "info");
      },
      [addNotification],
    ),
  });

  return (
    <div className="h-screen w-screen bg-background flex p-4 gap-4">
      {/* Notifications */}
      {notifications.length > 0 && (
        <div className="fixed top-6 right-6 z-50 space-y-2">
          {notifications.map((n) => (
            <Toast
              key={n.id}
              message={n.message}
              level={n.level}
              onDismiss={() =>
                setNotifications((prev) => prev.filter((x) => x.id !== n.id))
              }
            />
          ))}
        </div>
      )}

      {/* Sidebar - Blends with base */}
      <MCPConfigSidebar />

      {/* Main Chat Panel - Boxed elevated panel */}
      <main className="flex-1 flex flex-col rounded-2xl bg-popover border border-border overflow-hidden min-h-0">
        <div className="flex-1 flex flex-col min-h-0">
          <CopilotChat.Root
            persistence={true}
            className="h-full flex flex-col min-h-0 bg-card"
            showPoweredBy={false}
            mcpToolRenderer={MCPToolRenderer}
          >
            {/* Home View */}
            <CopilotChat.HomeView className="flex-1 flex flex-col p-6">
              <div className="flex flex-col items-center justify-center gap-5 w-full max-w-lg mx-auto flex-1">
                {/* Logo */}
                <div className="relative">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center">
                    <Zap className="w-7 h-7 text-white" />
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 border-2 border-zinc-900 flex items-center justify-center">
                    <Sparkles className="w-2.5 h-2.5 text-white" />
                  </div>
                </div>

                {/* Title */}
                <div className="text-center space-y-1.5">
                  <h1 className="text-xl font-semibold text-foreground">
                    AI Assistant
                  </h1>
                  <p className="text-muted-foreground text-sm max-w-sm mx-auto">
                    Connect servers from the sidebar to unlock powerful tools
                  </p>
                </div>

                {/* Input */}
                <div className="w-full max-w-md mt-1">
                  <CopilotChat.Input placeholder="Ask something..." />
                </div>

                {/* Suggestions */}
                <div className="w-full max-w-md">
                  <p className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-widest mb-2.5 text-center">
                    Quick Actions
                  </p>
                  <QuickSuggestions />
                </div>
              </div>
            </CopilotChat.HomeView>

            {/* Chat View */}
            <CopilotChat.ChatView>
              <CopilotChat.Header className="flex items-center gap-3 px-5 py-3.5 border-b border-border bg-card">
                <CopilotChat.BackButton className="p-2 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                  <ChevronLeft className="w-4 h-4" />
                </CopilotChat.BackButton>
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center">
                  <Zap className="w-4.5 h-4.5 text-primary-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-sm font-medium text-foreground">
                    MCP Assistant
                  </h2>
                  <CopilotChat.ThreadPicker size="sm" />
                </div>
              </CopilotChat.Header>
            </CopilotChat.ChatView>
          </CopilotChat.Root>
        </div>
      </main>
    </div>
  );
}

// ============================================
// Main App
// ============================================
export default function Page() {
  return (
    <CopilotProvider
      runtimeUrl="/api/chat"
      systemPrompt={`You are a helpful assistant with MCP tools. Use the connected MCP tools to help users with:

- Email verification
- Web search (Google)
- YouTube video search
- Google Trends analysis
- Google Maps / Places lookup
- News search
- And more based on connected servers

Use appropriate tools for rich responses. Keep text concise.`}
    >
      <DashboardContent />
    </CopilotProvider>
  );
}
