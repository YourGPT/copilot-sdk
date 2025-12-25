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
import type { ChatMessage, MessageAttachment } from "./types";

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
  onApproveToolExecution,
  onRejectToolExecution,
}: DefaultMessageProps) {
  const isUser = message.role === "user";
  const isStreaming = isLastMessage && isLoading;

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

  // Separate tool executions into those needing approval and others
  const pendingApprovalTools = message.toolExecutions?.filter(
    (exec) => exec.approvalStatus === "required",
  );
  const otherTools = message.toolExecutions?.filter(
    (exec) => exec.approvalStatus !== "required",
  );

  // Convert tool executions to ToolStepData format (for non-pending tools)
  const toolSteps = otherTools?.map((exec) => ({
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

        {/* Tool Approval Confirmations (with permission options) */}
        {pendingApprovalTools && pendingApprovalTools.length > 0 && (
          <div className="mb-2 space-y-2">
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

        {/* Tool Steps (compact display) */}
        {toolSteps && toolSteps.length > 0 && (
          <div className="mb-2 rounded-lg bg-muted/50 px-3 py-2">
            <ToolSteps steps={toolSteps} />
          </div>
        )}

        {/* Message Content - only show if there's content */}
        {message.content?.trim() && (
          <MessageContent
            className={cn(
              "rounded-lg px-4 py-2 bg-muted",
              assistantMessageClassName,
            )}
            markdown
            size={size}
          >
            {message.content}
          </MessageContent>
        )}

        {/* Image Attachments */}
        {message.attachments && message.attachments.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {message.attachments.map((attachment, index) => (
              <AttachmentPreview key={index} attachment={attachment} />
            ))}
          </div>
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

  // Image preview
  const src = attachment.data.startsWith("data:")
    ? attachment.data
    : `data:${attachment.mimeType};base64,${attachment.data}`;

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
