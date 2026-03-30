"use client";

import { useTheme } from "next-themes";
import { CopilotChat, useCopilotChatContext } from "@yourgpt/copilot-sdk/ui";
import { toast } from "sonner";
import {
  Plus,
  Sun,
  Moon,
  ShoppingCart,
  Camera,
  ChevronLeft,
} from "lucide-react";
import type { LayoutProps } from "./DefaultLayout";

// Suggestion Card Component
function SuggestionCard({
  icon: Icon,
  label,
  message,
  iconBg,
  iconColor,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  message?: string;
  iconBg: string;
  iconColor: string;
}) {
  const { send } = useCopilotChatContext();

  return (
    <button
      onClick={() => send(message || label)}
      className="group w-full flex items-center gap-3 px-3 py-2.5 rounded-xl
                 bg-card/80 border border-border/50
                 hover:bg-card hover:border-border hover:shadow-md
                 transition-all duration-200 text-left"
    >
      <div
        className={`w-8 h-8 rounded-lg ${iconBg} flex items-center justify-center
                    group-hover:scale-105 transition-transform duration-200`}
      >
        <Icon className={`w-4 h-4 ${iconColor}`} />
      </div>
      <span className="text-sm text-foreground/90 group-hover:text-foreground">
        {label}
      </span>
    </button>
  );
}

// Custom Suggestions Grid
function CustomSuggestions() {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  return (
    <div className="w-full space-y-1.5">
      <SuggestionCard
        icon={Plus}
        label="Update counter"
        message="Increase the counter by 5"
        iconBg="bg-violet-500/15"
        iconColor="text-violet-400"
      />
      <SuggestionCard
        icon={isDark ? Sun : Moon}
        label={isDark ? "Light mode" : "Dark mode"}
        message={isDark ? "Switch to light mode" : "Switch to dark mode"}
        iconBg="bg-blue-500/15"
        iconColor="text-blue-400"
      />
      <SuggestionCard
        icon={ShoppingCart}
        label="Add to cart"
        message="Add 3 items to my cart"
        iconBg="bg-emerald-500/15"
        iconColor="text-emerald-400"
      />
      <SuggestionCard
        icon={Camera}
        label="Take screenshot"
        message="Take a screenshot of this page"
        iconBg="bg-amber-500/15"
        iconColor="text-amber-400"
      />
    </div>
  );
}

export function SaasLayout({ theme, loaderVariant, alphaConfig }: LayoutProps) {
  // Use supabase theme by default for this layout, unless a different theme is selected
  const effectiveTheme = theme === "default" ? "supabase" : theme;

  return (
    <div className="h-full" data-csdk-theme={effectiveTheme}>
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
              <CopilotChat.CopyAction />
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
            <CopilotChat.EditAction />
          </CopilotChat.MessageActions>
        )}
        {/* Home View - Custom welcome screen */}
        <CopilotChat.HomeView className="gap-4 p-6 bg-gradient-to-b from-primary/30 via-background to-background items-stretch w-full">
          {/* Logo */}
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center self-center mb-4">
            <svg
              className="w-8 h-8 text-primary"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
          </div>

          {/* Title */}
          <div className="text-center mb-3">
            <h2 className="text-xl font-semibold">Finance Assistant</h2>
            <p className="text-muted-foreground text-sm mt-1">
              Your smart banking copilot
            </p>
          </div>

          {/* Input + Suggestions grouped together */}
          <div className="w-full space-y-3">
            <CopilotChat.Input
              placeholder="Ask about your finances..."
              className="w-full"
            />
            <CustomSuggestions />
          </div>
        </CopilotChat.HomeView>

        {/* Chat View - Custom header */}
        <CopilotChat.ChatView className="items-stretch w-full">
          <CopilotChat.Header className="flex items-center gap-2 p-3 border-b bg-card/50">
            <CopilotChat.BackButton className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted/50">
              <ChevronLeft className="w-4 h-4" />
            </CopilotChat.BackButton>
            <div className="flex items-center gap-2 flex-1">
              <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                <svg
                  className="w-4 h-4 text-primary"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                </svg>
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-medium leading-tight">
                  Finance Assistant
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
