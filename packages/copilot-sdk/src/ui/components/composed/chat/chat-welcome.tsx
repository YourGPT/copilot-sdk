"use client";

import React, { useState, useCallback, useRef, useId } from "react";
import { cn } from "../../../lib/utils";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputActions,
  PromptInputAction,
} from "../../ui/prompt-input";
import { Button } from "../../ui/button";
import { Loader } from "../../ui/loader";
import {
  PlusIcon,
  ArrowUpIcon,
  StopIcon,
  XIcon,
  ArrowUpRightIcon,
} from "../../icons";
import CopilotSDKLogo from "../../icons/copilot-sdk-logo";
import type {
  WelcomeConfig,
  PendingAttachment,
  MessageAttachment,
} from "./types";
import type { Thread } from "../../../../core/types/thread";

// Constants
const DEFAULT_MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const DEFAULT_ALLOWED_TYPES = ["image/*", "application/pdf"];

// Default welcome config values
const DEFAULT_TITLE = "How can I help you today?";
const DEFAULT_SUBTITLE = "Ask anything and get it done.";
const DEFAULT_SUGGESTIONS_LABEL = "Try AI Copilot";
const DEFAULT_RECENT_CHATS_LABEL = "Recent chats";
const DEFAULT_MAX_RECENT_CHATS = 3;
const DEFAULT_VIEW_MORE_LABEL = "View more..";

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

export interface ChatWelcomeProps {
  /** Welcome screen configuration */
  config?: WelcomeConfig;
  /** Suggestions to show */
  suggestions?: string[];
  /** Recent threads for the recent chats section */
  recentThreads?: Thread[];
  /** Called when user sends a message */
  onSendMessage: (message: string, attachments?: MessageAttachment[]) => void;
  /** Called when user selects a recent thread */
  onSelectThread?: (threadId: string) => void;
  /** Called when user deletes a recent thread */
  onDeleteThread?: (threadId: string) => void;
  /** Called when user clicks "View more" */
  onViewMoreThreads?: () => void;
  /** Whether AI is currently generating */
  isLoading?: boolean;
  /** Called when user stops generation */
  onStop?: () => void;
  /** Placeholder for input */
  placeholder?: string;
  /** Whether attachments are enabled */
  attachmentsEnabled?: boolean;
  /** Tooltip when attachments are disabled */
  attachmentsDisabledTooltip?: string;
  /** Maximum file size in bytes */
  maxFileSize?: number;
  /** Allowed file types */
  allowedFileTypes?: string[];
  /** Custom attachment processor */
  processAttachment?: (file: File) => Promise<MessageAttachment>;
  /** Custom class names */
  classNames?: {
    root?: string;
    hero?: string;
    input?: string;
    suggestions?: string;
    recentChats?: string;
  };
}

export function ChatWelcome({
  config,
  suggestions = [],
  recentThreads = [],
  onSendMessage,
  onSelectThread,
  onDeleteThread,
  onViewMoreThreads,
  isLoading = false,
  onStop,
  placeholder = "Type a message...",
  attachmentsEnabled = true,
  attachmentsDisabledTooltip = "Attachments not supported by this model",
  maxFileSize = DEFAULT_MAX_FILE_SIZE,
  allowedFileTypes = DEFAULT_ALLOWED_TYPES,
  processAttachment: processAttachmentProp,
  classNames = {},
}: ChatWelcomeProps) {
  const [input, setInput] = useState("");
  const [pendingAttachments, setPendingAttachments] = useState<
    PendingAttachment[]
  >([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileInputId = useId();

  // Extract config values with defaults
  const title = config?.title ?? DEFAULT_TITLE;
  const subtitle = config?.subtitle ?? DEFAULT_SUBTITLE;
  const logo = config?.logo;
  const suggestionsLabel =
    config?.suggestionsLabel ?? DEFAULT_SUGGESTIONS_LABEL;
  const showRecentChats = config?.showRecentChats ?? true;
  const recentChatsLabel =
    config?.recentChatsLabel ?? DEFAULT_RECENT_CHATS_LABEL;
  const maxRecentChats = config?.maxRecentChats ?? DEFAULT_MAX_RECENT_CHATS;
  const viewMoreLabel = config?.viewMoreLabel ?? DEFAULT_VIEW_MORE_LABEL;

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

        // Process attachment
        try {
          let attachment: MessageAttachment;

          if (processAttachmentProp) {
            attachment = await processAttachmentProp(file);
          } else {
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

    onSendMessage(input, attachments.length > 0 ? attachments : undefined);

    // Cleanup
    pendingAttachments.forEach((att) => URL.revokeObjectURL(att.previewUrl));
    setPendingAttachments([]);
    setInput("");
  }, [input, isLoading, onSendMessage, pendingAttachments]);

  const handleSuggestionClick = useCallback(
    (suggestion: string) => {
      onSendMessage(suggestion);
    },
    [onSendMessage],
  );

  // Compute accept string from allowed types
  const acceptString = allowedFileTypes.join(",");

  // Determine which threads to show
  const visibleThreads = showRecentChats
    ? recentThreads.slice(0, maxRecentChats)
    : [];
  const hasMoreThreads = recentThreads.length > maxRecentChats;

  return (
    <div
      className={cn(
        "flex flex-1 flex-col items-center justify-center px-4 py-8 overflow-auto",
        classNames.root,
      )}
    >
      {/* Hero Section */}
      <div
        className={cn(
          "flex flex-col items-center text-center mb-8",
          classNames.hero,
        )}
      >
        {/* Logo */}
        {logo ? (
          <img
            src={logo}
            alt="Logo"
            className="size-12 rounded-lg object-contain mb-4"
          />
        ) : (
          <div className="mb-4">
            <CopilotSDKLogo className="h-12 w-auto" />
          </div>
        )}
        {/* Title */}
        <h1 className="text-xl font-semibold text-foreground mb-2">{title}</h1>
        {/* Subtitle */}
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>

      {/* Input - Centered */}
      <div className={cn("w-full max-w-lg mb-6", classNames.input)}>
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
                  <div className="csdk-attachment-loading absolute inset-0 bg-background/80 rounded-lg flex items-center justify-center">
                    <Loader variant="dots" size="sm" />
                  </div>
                )}
                {/* Error overlay */}
                {att.status === "error" && (
                  <div className="csdk-attachment-error absolute inset-0 bg-destructive/20 rounded-lg flex items-center justify-center">
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

      {/* Suggestions */}
      {suggestions.length > 0 && (
        <div
          className={cn("w-full max-w-lg mb-6 px-3", classNames.suggestions)}
        >
          <p className="text-xs font-medium text-muted-foreground mb-2">
            {suggestionsLabel}
          </p>
          <div className="">
            {suggestions.map((suggestion, index) => (
              <button
                key={index}
                type="button"
                onClick={() => handleSuggestionClick(suggestion)}
                className="group w-full cursor-pointer font-medium text-left py-2 text-sm hover:text-foreground text-foreground/70 transition-colors flex items-center gap-2"
              >
                <span>{suggestion}</span>
                <ArrowUpRightIcon className="size-4 opacity-0 translate-y-1 group-hover:opacity-[0.6] group-hover:translate-y-0 transition-all duration-200" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
