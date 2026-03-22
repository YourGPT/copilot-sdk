"use client";

import { CopilotChat } from "@yourgpt/copilot-sdk/ui";
import { toast } from "sonner";
import type { CopilotTheme, LoaderVariant, AlphaConfig } from "@/lib/types";

export interface LayoutProps {
  theme: CopilotTheme;
  loaderVariant: LoaderVariant;
  alphaConfig: AlphaConfig;
}

export function DefaultLayout({
  theme,
  loaderVariant,
  alphaConfig,
}: LayoutProps) {
  const showEdit =
    alphaConfig.messageActions.editEnabled || alphaConfig.branchingEnabled;
  const hasAnyAction =
    alphaConfig.messageActions.copyEnabled ||
    showEdit ||
    alphaConfig.messageActions.feedbackEnabled;

  return (
    <div
      className="h-full"
      data-csdk-theme={theme === "default" ? undefined : theme}
    >
      <CopilotChat
        placeholder="Enter command..."
        className="h-full"
        showHeader
        header={{ name: "AI Copilot" }}
        showThreadPicker={alphaConfig.sessionPersistence}
        persistence={alphaConfig.sessionPersistence || undefined}
        loaderVariant={loaderVariant}
        assistantAvatar={{
          src: "https://api.dicebear.com/7.x/bottts/svg?seed=assistant",
        }}
        showUserAvatar
        userAvatar={{
          src: "https://api.dicebear.com/7.x/avataaars/svg?seed=user",
        }}
        messageView={
          alphaConfig.customMessageView
            ? {
                children: ({ messageElements }) => (
                  <>
                    {messageElements}
                    <div className="px-4 py-2 text-center">
                      <span className="text-[10px] text-zinc-400 dark:text-zinc-600 bg-zinc-100 dark:bg-zinc-800/50 px-2 py-0.5 rounded-full">
                        Custom messageView — rendered via alpha API
                      </span>
                    </div>
                  </>
                ),
              }
            : undefined
        }
      >
        {hasAnyAction && (
          <>
            {(alphaConfig.messageActions.copyEnabled ||
              alphaConfig.messageActions.feedbackEnabled) && (
              <CopilotChat.MessageActions role="assistant">
                {alphaConfig.messageActions.copyEnabled && (
                  <CopilotChat.CopyAction tooltip="Copy message" />
                )}
                {alphaConfig.messageActions.feedbackEnabled && (
                  <CopilotChat.FeedbackAction
                    onFeedback={(message, type) => {
                      toast.success(`Feedback: ${type}`, {
                        duration: 2000,
                        position: "top-center",
                      });
                    }}
                  />
                )}
              </CopilotChat.MessageActions>
            )}
            {showEdit && (
              <CopilotChat.MessageActions role="user">
                <CopilotChat.EditAction tooltip="Edit message" />
              </CopilotChat.MessageActions>
            )}
          </>
        )}
      </CopilotChat>
    </div>
  );
}
