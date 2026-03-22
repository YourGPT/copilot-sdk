"use client";

import { useTheme } from "next-themes";
import { CopilotChat, useCopilotChatContext } from "@yourgpt/copilot-sdk/ui";
import { toast } from "sonner";
import {
  Camera,
  ScrollText,
  Plus,
  Sun,
  Moon,
  BookOpen,
  ExternalLink,
  Clock,
  ChevronLeft,
} from "lucide-react";
import type { LayoutProps } from "./DefaultLayout";

// Quick Action Chip - Compact suggestion button
function QuickActionChip({
  icon: Icon,
  label,
  message,
  accentColor,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  message?: string;
  accentColor: string;
}) {
  const { send } = useCopilotChatContext();

  return (
    <button
      onClick={() => send(message || label)}
      className="group flex items-center gap-2 px-3 py-2 rounded-full text-left transition-all duration-200 bg-muted/50 border border-border/50 hover:border-border hover:bg-muted hover:shadow-sm"
    >
      <div
        className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${accentColor} bg-current/10`}
      >
        <Icon className="w-3 h-3 text-current" />
      </div>
      <span className="text-xs font-medium text-foreground/80 group-hover:text-foreground">
        {label}
      </span>
    </button>
  );
}

// Help Article Link
function HelpArticle({
  title,
  readTime,
  href,
}: {
  title: string;
  readTime: string;
  href: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors"
    >
      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/15 transition-colors">
        <BookOpen className="w-4 h-4 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors line-clamp-1">
          {title}
        </p>
        <div className="flex items-center gap-1.5 mt-0.5">
          <Clock className="w-3 h-3 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">{readTime}</span>
        </div>
      </div>
      <ExternalLink className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity mt-0.5" />
    </a>
  );
}

// Support Home View Component
function SupportHome({ input }: { input?: React.ReactNode }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-primary/10 via-background to-background">
      {/* Header Section */}
      <div className="flex flex-col items-center px-4 pt-8 pb-4">
        {/* Logo */}
        <div className="relative mb-3">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-muted to-muted/50 border border-border/50 flex items-center justify-center shadow-sm">
            <svg
              className="w-8 h-8 text-foreground"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
          </div>
          {/* Status dot */}
          <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-emerald-500 border-2 border-background shadow-sm flex items-center justify-center">
            <div className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse" />
          </div>
        </div>

        {/* Title */}
        <h2 className="text-lg font-semibold text-foreground">Support AI</h2>
        <p className="text-muted-foreground text-sm mb-4">
          How can I help you today?
        </p>

        {/* Input - First */}
        {input && <div className="w-full">{input}</div>}
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {/* Quick Suggestions */}
        <div className="mb-6">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
            Quick actions
          </p>
          <div className="grid grid-cols-2 gap-2">
            <QuickActionChip
              icon={Camera}
              label="Take screenshot"
              message="Take a screenshot of this page"
              accentColor="text-rose-500"
            />
            <QuickActionChip
              icon={ScrollText}
              label="Check console"
              message="Check the console for any errors"
              accentColor="text-blue-500"
            />
            <QuickActionChip
              icon={Plus}
              label="Update counter"
              message="Increase the counter by 5"
              accentColor="text-emerald-500"
            />
            <QuickActionChip
              icon={isDark ? Sun : Moon}
              label={isDark ? "Light mode" : "Dark mode"}
              message={isDark ? "Switch to light mode" : "Switch to dark mode"}
              accentColor="text-violet-500"
            />
          </div>
        </div>

        {/* Help Articles */}
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
            Documentation
          </p>
          <div className="space-y-1 -mx-3">
            <HelpArticle
              title="Getting Started with Copilot SDK"
              readTime="3 min read"
              href="https://copilot-sdk.yourgpt.ai/docs"
            />
            <HelpArticle
              title="Configure LLM Providers"
              readTime="2 min read"
              href="https://copilot-sdk.yourgpt.ai/docs/providers"
            />
            <HelpArticle
              title="Using the LLM SDK"
              readTime="4 min read"
              href="https://copilot-sdk.yourgpt.ai/docs/llm-sdk"
            />
            <HelpArticle
              title="Building Copilot Tools"
              readTime="4 min read"
              href="https://copilot-sdk.yourgpt.ai/docs/tools"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export function SupportLayout({
  theme,
  loaderVariant,
  alphaConfig,
}: LayoutProps) {
  return (
    <div
      className="h-full"
      data-csdk-theme={theme === "default" ? undefined : theme}
    >
      <CopilotChat.Root
        persistence={alphaConfig.sessionPersistence || undefined}
        className="h-full"
        showPoweredBy={false}
        loaderVariant={loaderVariant}
        assistantAvatar={{
          src: "https://api.dicebear.com/7.x/bottts/svg?seed=assistant",
        }}
        showUserAvatar
        userAvatar={{
          src: "https://api.dicebear.com/7.x/avataaars/svg?seed=user",
        }}
      >
        {(alphaConfig.messageActions.copyEnabled ||
          alphaConfig.messageActions.feedbackEnabled) && (
          <CopilotChat.MessageActions role="assistant">
            {alphaConfig.messageActions.copyEnabled && (
              <CopilotChat.CopyAction tooltip="Copy message" />
            )}
            {alphaConfig.messageActions.feedbackEnabled && (
              <CopilotChat.FeedbackAction
                onFeedback={(message, type) =>
                  toast.success(`Feedback: ${type}`, {
                    duration: 2000,
                    position: "top-center",
                  })
                }
              />
            )}
          </CopilotChat.MessageActions>
        )}
        {(alphaConfig.messageActions.editEnabled ||
          alphaConfig.branchingEnabled) && (
          <CopilotChat.MessageActions role="user">
            <CopilotChat.EditAction tooltip="Edit message" />
          </CopilotChat.MessageActions>
        )}
        {/* Custom Home View */}
        <CopilotChat.HomeView className="!gap-0 !p-0">
          <SupportHome
            input={<CopilotChat.Input placeholder="Describe your issue..." />}
          />
        </CopilotChat.HomeView>

        {/* Custom Chat View */}
        <CopilotChat.ChatView>
          <CopilotChat.Header className="flex items-center gap-3 px-4 py-3 border-b bg-card/50">
            <CopilotChat.BackButton className="text-muted-foreground hover:text-foreground p-1.5 rounded-lg hover:bg-muted/50 transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </CopilotChat.BackButton>
            <div className="flex items-center gap-2.5 flex-1">
              {/* Logo */}
              <div className="w-8 h-8 rounded-lg bg-muted border border-border/50 flex items-center justify-center">
                <svg
                  className="w-5 h-5 text-foreground"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                </svg>
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-medium leading-tight">
                  Support AI
                </span>
                <CopilotChat.ThreadPicker size="sm" />
              </div>
            </div>
          </CopilotChat.Header>
        </CopilotChat.ChatView>
      </CopilotChat.Root>
    </div>
  );
}
