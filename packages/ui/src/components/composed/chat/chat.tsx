"use client";

import React, { useState, useCallback, useRef, useId } from "react";
import { cn } from "../../../lib/utils";
import {
  ChatContainerRoot,
  ChatContainerContent,
  ChatContainerScrollAnchor,
} from "../../ui/chat-container";
import { ScrollButton } from "../../ui/scroll-button";
import { Message, MessageAvatar } from "../../ui/message";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputActions,
  PromptInputAction,
} from "../../ui/prompt-input";
import { Loader } from "../../ui/loader";
import { Button } from "../../ui/button";
import { StopIcon, PlusIcon, ArrowUpIcon, XIcon } from "../../icons";
import { ChatHeader } from "./chat-header";
import { Suggestions } from "./suggestions";
import { DefaultMessage } from "./default-message";
import type { ChatProps, PendingAttachment } from "./types";
import type { ToolExecutionData } from "../tools";

// Constants
const DEFAULT_MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const DEFAULT_ALLOWED_TYPES = ["image/*", "application/pdf"];

/**
 * Get attachment type from MIME type
 */
function getAttachmentType(
  mimeType: string,
): "image" | "file" | "audio" | "video" {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("audio/")) return "audio";
  if (mimeType.startsWith("video/")) return "video";
  return "file";
}

/**
 * Convert file to base64 data URL
 */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("Failed to read file"));
      }
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

/**
 * Generate unique attachment ID
 */
function generateAttachmentId(): string {
  return `att_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export function Chat({
  // Core
  messages = [],
  onSendMessage,
  onStop,
  isLoading = false,
  // Labels
  placeholder = "Type a message...",
  welcomeMessage,
  title,
  // Header
  showHeader = false,
  onClose,
  // Appearance
  showPoweredBy = true,
  showUserAvatar = false,
  userAvatar = { fallback: "U" },
  assistantAvatar = { fallback: "AI" },
  loaderVariant = "typing",
  fontSize = "sm",
  // Attachments
  maxFileSize = DEFAULT_MAX_FILE_SIZE,
  allowedFileTypes = DEFAULT_ALLOWED_TYPES,
  attachmentsEnabled = true,
  attachmentsDisabledTooltip = "Attachments not supported by this model",
  processAttachment: processAttachmentProp,
  // Suggestions
  suggestions = [],
  onSuggestionClick,
  // Tool Executions
  isProcessing = false,
  toolRenderers,
  onApproveToolExecution,
  onRejectToolExecution,
  // Follow-up Questions
  showFollowUps = true,
  followUpClassName,
  followUpButtonClassName,
  // Custom rendering
  renderMessage,
  renderInput,
  renderHeader,
  // Styling
  className,
  classNames = {},
}: ChatProps) {
  const [input, setInput] = useState("");
  const [pendingAttachments, setPendingAttachments] = useState<
    PendingAttachment[]
  >([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileInputId = useId(); // Unique ID for this Chat instance's file input

  // Check if file type is allowed
  const isFileTypeAllowed = useCallback(
    (file: File): boolean => {
      for (const type of allowedFileTypes) {
        if (type.endsWith("/*")) {
          const category = type.slice(0, -2);
          if (file.type.startsWith(category + "/")) return true;
        } else if (file.type === type) {
          return true;
        }
      }
      return false;
    },
    [allowedFileTypes],
  );

  // Handle file selection
  const handleFileSelect = useCallback(
    async (files: FileList | null) => {
      if (!files || !attachmentsEnabled) return;

      for (const file of Array.from(files)) {
        // Validate file size
        if (file.size > maxFileSize) {
          const sizeMB = (maxFileSize / (1024 * 1024)).toFixed(0);
          console.warn(`File ${file.name} exceeds ${sizeMB}MB limit`);
          continue;
        }

        // Validate file type
        if (!isFileTypeAllowed(file)) {
          console.warn(`File type ${file.type} is not allowed`);
          continue;
        }

        const id = generateAttachmentId();
        const previewUrl = URL.createObjectURL(file);

        // Add as processing
        setPendingAttachments((prev) => [
          ...prev,
          {
            id,
            file,
            previewUrl,
            attachment: {
              type: getAttachmentType(file.type),
              data: "",
              mimeType: file.type,
              filename: file.name,
            },
            status: "processing",
          },
        ]);

        // Process attachment (cloud upload or base64 conversion)
        try {
          let attachment: {
            type: "image" | "file" | "audio" | "video";
            data?: string;
            url?: string;
            mimeType: string;
            filename?: string;
          };

          if (processAttachmentProp) {
            // Use provided processor (e.g., cloud storage upload)
            attachment = await processAttachmentProp(file);
          } else {
            // Default: convert to base64
            const data = await fileToBase64(file);
            attachment = {
              type: getAttachmentType(file.type),
              data,
              mimeType: file.type,
              filename: file.name,
            };
          }

          setPendingAttachments((prev) =>
            prev.map((att) =>
              att.id === id
                ? { ...att, status: "ready" as const, attachment }
                : att,
            ),
          );
        } catch (error) {
          setPendingAttachments((prev) =>
            prev.map((att) =>
              att.id === id
                ? {
                    ...att,
                    status: "error" as const,
                    error: "Failed to process file",
                  }
                : att,
            ),
          );
        }
      }
    },
    [attachmentsEnabled, maxFileSize, isFileTypeAllowed, processAttachmentProp],
  );

  // Handle file input change
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      handleFileSelect(e.target.files);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    [handleFileSelect],
  );

  // Remove pending attachment
  const removePendingAttachment = useCallback((id: string) => {
    setPendingAttachments((prev) => {
      const att = prev.find((a) => a.id === id);
      if (att) {
        URL.revokeObjectURL(att.previewUrl);
      }
      return prev.filter((a) => a.id !== id);
    });
  }, []);

  // Drag and drop handlers
  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (attachmentsEnabled) {
        setIsDragging(true);
      }
    },
    [attachmentsEnabled],
  );

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      if (attachmentsEnabled) {
        handleFileSelect(e.dataTransfer.files);
      }
    },
    [attachmentsEnabled, handleFileSelect],
  );

  const handleSubmit = useCallback(() => {
    const hasContent = input.trim();
    const hasAttachments = pendingAttachments.some(
      (att) => att.status === "ready",
    );

    if ((!hasContent && !hasAttachments) || isLoading) return;

    // Get ready attachments
    const attachments = pendingAttachments
      .filter((att) => att.status === "ready")
      .map((att) => att.attachment);

    onSendMessage?.(input, attachments.length > 0 ? attachments : undefined);

    // Cleanup
    pendingAttachments.forEach((att) => URL.revokeObjectURL(att.previewUrl));
    setPendingAttachments([]);
    setInput("");
  }, [input, isLoading, onSendMessage, pendingAttachments]);

  const handleSuggestionClick = useCallback(
    (suggestion: string) => {
      if (onSuggestionClick) {
        onSuggestionClick(suggestion);
      } else {
        onSendMessage?.(suggestion);
      }
    },
    [onSuggestionClick, onSendMessage],
  );

  // Compute accept string from allowed types
  const acceptString = allowedFileTypes.join(",");

  return (
    <div
      className={cn(
        "flex h-full flex-col bg-background relative",
        className,
        classNames.root,
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-50 bg-primary/10 border-2 border-dashed border-primary flex items-center justify-center">
          <div className="text-primary font-medium text-lg">
            Drop files here
          </div>
        </div>
      )}
      {/* Header */}
      {showHeader &&
        (renderHeader ? (
          renderHeader()
        ) : (
          <ChatHeader
            title={title}
            onClose={onClose}
            className={classNames.header}
          />
        ))}

      {/* Messages */}
      <ChatContainerRoot
        className={cn("relative flex-1", classNames.container)}
      >
        <ChatContainerContent
          className={cn("gap-4 p-4", classNames.messageList)}
        >
          {/* Welcome message */}
          {messages.length === 0 && (
            <div className="py-8 text-center text-muted-foreground">
              {welcomeMessage || "Send a message to start the conversation"}
            </div>
          )}

          {/* Messages */}
          {messages.map((message, index) => {
            const isLastMessage = index === messages.length - 1;
            const isEmptyAssistant =
              message.role === "assistant" && !message.content?.trim();

            // Check if message has tool_calls or toolExecutions
            const hasToolCalls =
              message.tool_calls && message.tool_calls.length > 0;
            const hasToolExecutions =
              message.toolExecutions && message.toolExecutions.length > 0;

            // Check if this message has pending tool approvals
            const hasPendingApprovals = message.toolExecutions?.some(
              (exec) => exec.approvalStatus === "required",
            );

            if (isEmptyAssistant) {
              if (hasToolCalls || hasToolExecutions) {
                // Has tools - continue to render
              } else if (isLastMessage && hasPendingApprovals) {
                // Has pending approvals - continue to render
              } else if (isLastMessage && isLoading && !isProcessing) {
                // Show streaming loader
                return (
                  <Message key={message.id} className="flex gap-2">
                    <MessageAvatar
                      src={assistantAvatar.src || ""}
                      alt="Assistant"
                      fallback={assistantAvatar.fallback}
                      className="bg-primary text-primary-foreground"
                    />
                    <div className="rounded-lg bg-muted px-4 py-2">
                      <Loader variant={loaderVariant} size="sm" />
                    </div>
                  </Message>
                );
              } else {
                // Hide empty assistant messages
                return null;
              }
            }

            // Check for saved executions in metadata (historical)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const savedExecutions = (message as any).metadata
              ?.toolExecutions as ToolExecutionData[] | undefined;
            const messageToolExecutions =
              message.toolExecutions || savedExecutions;

            const messageWithExecutions = messageToolExecutions
              ? { ...message, toolExecutions: messageToolExecutions }
              : message;

            // Handle follow-up click - use onSendMessage if available
            const handleFollowUpClick = (question: string) => {
              if (onSuggestionClick) {
                onSuggestionClick(question);
              } else {
                onSendMessage?.(question);
              }
            };

            return renderMessage ? (
              <React.Fragment key={message.id}>
                {renderMessage(messageWithExecutions, index)}
              </React.Fragment>
            ) : (
              <DefaultMessage
                key={message.id}
                message={messageWithExecutions}
                userAvatar={userAvatar}
                assistantAvatar={assistantAvatar}
                showUserAvatar={showUserAvatar}
                userMessageClassName={classNames.userMessage}
                assistantMessageClassName={classNames.assistantMessage}
                size={fontSize}
                isLastMessage={isLastMessage}
                isLoading={isLoading}
                toolRenderers={toolRenderers}
                onApproveToolExecution={onApproveToolExecution}
                onRejectToolExecution={onRejectToolExecution}
                showFollowUps={showFollowUps}
                onFollowUpClick={handleFollowUpClick}
                followUpClassName={followUpClassName}
                followUpButtonClassName={followUpButtonClassName}
              />
            );
          })}

          {/* "Continuing..." loader - shown after tool completion while waiting for server */}
          {isProcessing && (
            <Message className="flex gap-2">
              <MessageAvatar
                src={assistantAvatar?.src || ""}
                alt="Assistant"
                fallback={assistantAvatar?.fallback || "AI"}
                className="bg-primary text-primary-foreground"
              />
              <div className="rounded-lg bg-muted px-4 py-2 flex items-center gap-2">
                <Loader variant="dots" size="sm" />
                <span className="text-sm text-muted-foreground">
                  Continuing...
                </span>
              </div>
            </Message>
          )}

          {/* Loading indicator for non-streaming - when last message is user and waiting for response */}
          {isLoading &&
            !isProcessing &&
            (() => {
              const lastMessage = messages[messages.length - 1];
              // Show loader if last message is from user (non-streaming doesn't create empty assistant message)
              if (lastMessage?.role === "user") {
                return (
                  <Message className="flex gap-2">
                    <MessageAvatar
                      src={assistantAvatar?.src || ""}
                      alt="Assistant"
                      fallback={assistantAvatar?.fallback || "AI"}
                      className="bg-primary text-primary-foreground"
                    />
                    <div className="rounded-lg bg-muted px-4 py-2">
                      <Loader variant={loaderVariant} size="sm" />
                    </div>
                  </Message>
                );
              }
              return null;
            })()}

          <ChatContainerScrollAnchor />
        </ChatContainerContent>

        {/* Scroll to bottom button */}
        <div className="absolute right-4 bottom-4">
          <ScrollButton className="shadow-sm" />
        </div>
      </ChatContainerRoot>

      {/* Suggestions */}
      {suggestions.length > 0 && !isLoading && (
        <Suggestions
          suggestions={suggestions}
          onSuggestionClick={handleSuggestionClick}
          className={classNames.suggestions}
        />
      )}

      {/* Input */}
      {renderInput ? (
        renderInput()
      ) : (
        <div className={cn("p-2", classNames.input)}>
          {/* Pending Attachments Preview */}
          {pendingAttachments.length > 0 && (
            <div className="flex flex-wrap gap-2 p-2 mb-2 bg-muted/30 rounded-lg">
              {pendingAttachments.map((att) => (
                <div key={att.id} className="relative group">
                  {att.attachment.type === "image" ? (
                    <img
                      src={att.previewUrl}
                      alt={att.file.name}
                      className="w-16 h-16 object-cover rounded-lg border"
                    />
                  ) : (
                    <div className="w-16 h-16 bg-muted rounded-lg border flex flex-col items-center justify-center p-1">
                      <svg
                        className="w-6 h-6 text-muted-foreground"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                      <span className="text-[10px] text-muted-foreground truncate w-full text-center mt-1">
                        {att.file.name.length > 10
                          ? att.file.name.slice(0, 8) + "..."
                          : att.file.name}
                      </span>
                    </div>
                  )}
                  {/* Loading overlay */}
                  {att.status === "processing" && (
                    <div className="absolute inset-0 bg-background/80 rounded-lg flex items-center justify-center">
                      <Loader variant="dots" size="sm" />
                    </div>
                  )}
                  {/* Error overlay */}
                  {att.status === "error" && (
                    <div className="absolute inset-0 bg-destructive/20 rounded-lg flex items-center justify-center">
                      <span className="text-destructive text-xs">Error</span>
                    </div>
                  )}
                  {/* Remove button */}
                  <button
                    onClick={() => removePendingAttachment(att.id)}
                    className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                    type="button"
                  >
                    <XIcon className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <PromptInput
            value={input}
            onValueChange={setInput}
            isLoading={isLoading}
            onSubmit={handleSubmit}
            className=""
          >
            <PromptInputTextarea placeholder={placeholder} />
            <PromptInputActions className="flex justify-between">
              <div>
                <PromptInputAction
                  tooltip={
                    attachmentsEnabled
                      ? "Attach files"
                      : attachmentsDisabledTooltip
                  }
                >
                  <label
                    htmlFor={fileInputId}
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-2xl",
                      attachmentsEnabled
                        ? "hover:bg-secondary-foreground/10 cursor-pointer"
                        : "opacity-50 cursor-not-allowed",
                    )}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept={acceptString}
                      onChange={handleInputChange}
                      className="hidden"
                      id={fileInputId}
                      disabled={!attachmentsEnabled}
                    />
                    <PlusIcon className="text-primary size-5" />
                  </label>
                </PromptInputAction>
              </div>
              <PromptInputAction tooltip={isLoading ? "Stop" : "Send"}>
                {isLoading ? (
                  <Button
                    size="sm"
                    variant="destructive"
                    className="rounded-full size-9"
                    onClick={onStop}
                  >
                    <StopIcon className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    className="rounded-full size-9"
                    onClick={handleSubmit}
                    disabled={
                      !input.trim() &&
                      !pendingAttachments.some((att) => att.status === "ready")
                    }
                  >
                    <ArrowUpIcon className="h-4 w-4" />
                  </Button>
                )}
              </PromptInputAction>
            </PromptInputActions>
          </PromptInput>
        </div>
      )}
    </div>
  );
}
