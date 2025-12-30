"use client";

import * as React from "react";
import { cn } from "../../../lib/utils";
import { Message, MessageAvatar, MessageContent } from "../../ui/message";
import { SimpleReasoning } from "../../ui/reasoning";
import { ToolSteps } from "../../ui/tool-steps";
import {
  PermissionConfirmation,
  type PermissionLevel,
} from "../../ui/permission-confirmation";
import { FollowUpQuestions, parseFollowUps } from "../../ui/follow-up";
import type { ChatMessage, MessageAttachment, ToolRenderers } from "./types";

type DefaultMessageProps = {
  message: ChatMessage;
  userAvatar: { src?: string; fallback?: string };
  assistantAvatar: { src?: string; fallback?: string };
  showUserAvatar?: boolean;
  userMessageClassName?: string;
  assistantMessageClassName?: string;
  /** Font size variant: 'sm' (14px), 'base' (16px), 'lg' (18px) */
  size?: "sm" | "base" | "lg";
  /** Whether this is the last message (for streaming state) */
  isLastMessage?: boolean;
  /** Whether the chat is currently loading/streaming */
  isLoading?: boolean;
  /** Custom renderers for tool results (Generative UI) */
  toolRenderers?: ToolRenderers;
  /** Called when user approves a tool execution */
  onApproveToolExecution?: (
    executionId: string,
    permissionLevel?: PermissionLevel,
  ) => void;
  /** Called when user rejects a tool execution */
  onRejectToolExecution?: (
    executionId: string,
    reason?: string,
    permissionLevel?: PermissionLevel,
  ) => void;
  /** Show follow-up questions (default: true) */
  showFollowUps?: boolean;
  /** Called when a follow-up question is clicked */
  onFollowUpClick?: (question: string) => void;
  /** Custom class for follow-up container */
  followUpClassName?: string;
  /** Custom class for follow-up buttons */
  followUpButtonClassName?: string;
};

export function DefaultMessage({
  message,
  userAvatar,
  assistantAvatar,
  showUserAvatar = false,
  userMessageClassName,
  assistantMessageClassName,
  size = "sm",
  isLastMessage = false,
  isLoading = false,
  toolRenderers,
  onApproveToolExecution,
  onRejectToolExecution,
  showFollowUps = true,
  onFollowUpClick,
  followUpClassName,
  followUpButtonClassName,
}: DefaultMessageProps) {
  const isUser = message.role === "user";
  const isStreaming = isLastMessage && isLoading;

  // Parse follow-up questions from assistant messages
  const { cleanContent, followUps } = React.useMemo(() => {
    if (isUser || !message.content) {
      return { cleanContent: message.content, followUps: [] };
    }
    return parseFollowUps(message.content);
  }, [message.content, isUser]);

  // Only show follow-ups on the last assistant message when not loading
  const shouldShowFollowUps =
    showFollowUps &&
    !isUser &&
    isLastMessage &&
    !isLoading &&
    followUps.length > 0 &&
    onFollowUpClick;

  // User message - right aligned, avatar optional
  if (isUser) {
    const hasAttachments =
      message.attachments && message.attachments.length > 0;

    return (
      <Message
        className={cn(
          "flex gap-2",
          showUserAvatar ? "justify-end" : "justify-end",
        )}
      >
        <div className="flex flex-col items-end max-w-[80%]">
          {/* Text content */}
          {message.content && (
            <MessageContent
              className={cn(
                "rounded-lg px-4 py-2 bg-primary text-primary-foreground",
                userMessageClassName,
              )}
              size={size}
            >
              {message.content}
            </MessageContent>
          )}
          {/* Image Attachments */}
          {hasAttachments && (
            <div className="mt-2 flex flex-wrap gap-2 justify-end">
              {message.attachments!.map((attachment, index) => (
                <AttachmentPreview key={index} attachment={attachment} />
              ))}
            </div>
          )}
        </div>
        {showUserAvatar && (
          <MessageAvatar
            src={userAvatar.src || ""}
            alt="User"
            fallback={userAvatar.fallback}
          />
        )}
      </Message>
    );
  }

  // Separate tool executions into categories
  const pendingApprovalTools = message.toolExecutions?.filter(
    (exec) => exec.approvalStatus === "required",
  );
  const completedTools = message.toolExecutions?.filter(
    (exec) => exec.approvalStatus !== "required",
  );

  // Split completed tools into those with custom renderers and those without
  const toolsWithCustomRenderer = completedTools?.filter(
    (exec) => toolRenderers && toolRenderers[exec.name],
  );
  const toolsWithoutCustomRenderer = completedTools?.filter(
    (exec) => !toolRenderers || !toolRenderers[exec.name],
  );

  // Convert tools without custom renderers to ToolStepData format
  const toolSteps = toolsWithoutCustomRenderer?.map((exec) => ({
    id: exec.id,
    name: exec.name,
    args: exec.args,
    status: exec.status,
    result: exec.result,
    error: exec.error,
  }));

  // Assistant message - left aligned with avatar
  return (
    <Message className="flex gap-2">
      <MessageAvatar
        src={assistantAvatar.src || ""}
        alt="Assistant"
        fallback={assistantAvatar.fallback}
        className="bg-primary text-primary-foreground"
      />
      <div className="flex-1 min-w-0 max-w-[80%]">
        {/* Reasoning/Thinking (collapsible, above content) */}
        {message.thinking && (
          <SimpleReasoning
            content={message.thinking}
            isStreaming={isStreaming}
            className="mb-2"
          />
        )}

        {/* Message Content - show FIRST (AI's words before tool calls) */}
        {cleanContent?.trim() && (
          <MessageContent
            className={cn(
              "rounded-lg px-4 py-2 bg-muted",
              assistantMessageClassName,
            )}
            markdown
            size={size}
          >
            {cleanContent}
          </MessageContent>
        )}

        {/* Custom Tool Renderers (Generative UI) */}
        {toolsWithCustomRenderer && toolsWithCustomRenderer.length > 0 && (
          <div className="mt-2 space-y-2">
            {toolsWithCustomRenderer.map((exec) => {
              const Renderer = toolRenderers![exec.name];
              return (
                <Renderer
                  key={exec.id}
                  execution={{
                    id: exec.id,
                    name: exec.name,
                    args: exec.args,
                    status: exec.status,
                    result: exec.result,
                    error: exec.error,
                    approvalStatus: exec.approvalStatus,
                  }}
                />
              );
            })}
          </div>
        )}

        {/* Tool Steps (default display for tools without custom renderers) */}
        {toolSteps && toolSteps.length > 0 && (
          <div className="mt-2 rounded-lg bg-muted/50 px-3 py-2">
            <ToolSteps steps={toolSteps} />
          </div>
        )}

        {/* Tool Approval Confirmations (with permission options) - show last for pending tools */}
        {pendingApprovalTools && pendingApprovalTools.length > 0 && (
          <div className="mt-2 space-y-2">
            {pendingApprovalTools.map((tool) => (
              <PermissionConfirmation
                key={tool.id}
                state="pending"
                toolName={tool.name}
                message={
                  tool.approvalMessage ||
                  `This tool wants to execute. Do you approve?`
                }
                onApprove={(permissionLevel) =>
                  onApproveToolExecution?.(tool.id, permissionLevel)
                }
                onReject={(permissionLevel) =>
                  onRejectToolExecution?.(tool.id, undefined, permissionLevel)
                }
              />
            ))}
          </div>
        )}

        {/* Image Attachments */}
        {message.attachments && message.attachments.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {message.attachments.map((attachment, index) => (
              <AttachmentPreview key={index} attachment={attachment} />
            ))}
          </div>
        )}

        {/* Follow-up Questions */}
        {shouldShowFollowUps && (
          <FollowUpQuestions
            questions={followUps}
            onSelect={onFollowUpClick!}
            className={followUpClassName}
            buttonClassName={followUpButtonClassName}
          />
        )}
      </div>
    </Message>
  );
}

/**
 * Attachment preview component
 */
function AttachmentPreview({ attachment }: { attachment: MessageAttachment }) {
  const [expanded, setExpanded] = React.useState(false);

  if (attachment.type !== "image") {
    // For non-image attachments, show a simple file indicator
    return (
      <div className="flex items-center gap-2 rounded-lg border bg-muted/50 px-3 py-2 text-sm">
        <span className="text-muted-foreground">{attachment.type}</span>
        <span>{attachment.filename || "Attachment"}</span>
      </div>
    );
  }

  // Image preview - use URL if available, otherwise use base64 data
  let src: string;
  if (attachment.url) {
    src = attachment.url;
  } else if (attachment.data) {
    src = attachment.data.startsWith("data:")
      ? attachment.data
      : `data:${attachment.mimeType};base64,${attachment.data}`;
  } else {
    // No source available - shouldn't happen but handle gracefully
    return null;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="relative rounded-lg overflow-hidden border bg-muted/50 hover:opacity-90 transition-opacity"
      >
        <img
          src={src}
          alt={attachment.filename || "Image"}
          className="max-w-[200px] max-h-[150px] object-cover"
        />
      </button>

      {/* Fullscreen modal */}
      {expanded && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
          onClick={() => setExpanded(false)}
        >
          <div className="relative max-w-[90vw] max-h-[90vh]">
            <img
              src={src}
              alt={attachment.filename || "Image (expanded)"}
              className="max-w-full max-h-full object-contain rounded-lg"
            />
            <button
              type="button"
              className="absolute top-2 right-2 bg-white/90 rounded-full p-2 hover:bg-white transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                setExpanded(false);
              }}
            >
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
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>
      )}
    </>
  );
}
