"use client";

import React, {
  useState,
  useCallback,
  useRef,
  useId,
  createContext,
  useContext,
} from "react";
import { cn } from "../../../lib/utils";
import {
  ChatContainerRoot,
  ChatContainerContent,
  ChatContainerScrollAnchor,
} from "../../ui/chat-container";
import { ScrollButton } from "../../ui/scroll-button";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputActions,
  PromptInputAction,
} from "../../ui/prompt-input";
import { Loader } from "../../ui/loader";
import { Button } from "../../ui/button";
import {
  StopIcon,
  PlusIcon,
  ArrowUpIcon,
  XIcon,
  ChevronLeftIcon,
} from "../../icons";
import { ChatHeader } from "./chat-header";
import { Suggestions } from "./suggestions";
import { DefaultMessage } from "./default-message";
import { ChatWelcome } from "./chat-welcome";
import type { ChatProps, PendingAttachment, MessageAttachment } from "./types";
import type { ToolExecutionData } from "../tools";
import type { Thread } from "../../../../core/types/thread";
import { ThreadPicker, type ThreadPickerProps } from "../../ui/thread-picker";
import { MessageActionsProvider } from "./message-actions-context";
import {
  MessageActions,
  CopyAction,
  EditAction,
  FeedbackAction,
  Action as MessageAction,
} from "./message-actions-compound";

// ============================================================================
// Internal Context for Compound Components
// ============================================================================

interface CopilotChatInternalContext {
  view: "home" | "chat";
  send: (message: string, attachments?: MessageAttachment[]) => void;
  isLoading: boolean;
  onStop?: () => void;
  attachmentsEnabled: boolean;
  placeholder: string;
  // Messages (for Chat.MessageList primitive)
  messages: import("./types").ChatMessage[];
  registeredTools?: import("../../../../core").ToolDefinition[];
  // Thread management
  onNewChat?: () => void;
  threads?: Thread[];
  currentThreadId?: string | null;
  onSwitchThread?: (id: string) => void;
  onDeleteThread?: (id: string) => void;
  isThreadBusy?: boolean;
}

const CopilotChatContext = createContext<CopilotChatInternalContext | null>(
  null,
);

/**
 * Hook to access CopilotChat internal context.
 * Must be used within CopilotChat compound components.
 */
export const useCopilotChatContext = () => {
  const ctx = useContext(CopilotChatContext);
  if (!ctx) {
    throw new Error(
      "useCopilotChatContext must be used within CopilotChat. " +
        "Make sure you're using CopilotChat.Home, CopilotChat.Input, etc. inside <CopilotChat>",
    );
  }
  return ctx;
};

// ============================================================================
// Compound Components
// ============================================================================

/**
 * HomeView slot - renders only when there are no messages (home view).
 * Use this to create a custom welcome/home screen.
 */
export interface HomeViewProps {
  children: React.ReactNode;
  className?: string;
}

function HomeView({ children, className }: HomeViewProps) {
  const { view } = useCopilotChatContext();
  if (view !== "home") return null;
  return (
    <div
      className={cn(
        "csdk-chat-home-view flex flex-1 flex-col overflow-auto",
        className,
      )}
    >
      <div className="flex flex-col w-full">{children}</div>
    </div>
  );
}

// Alias for backward compatibility
export type { HomeViewProps as HomeProps };
const Home = HomeView;

/**
 * ChatView slot - renders only when there are messages (chat view).
 * Use this for custom chat UI layouts. If no children, renders default chat UI.
 *
 * When Header/Footer are placed inside ChatView (instead of at root level),
 * they only show in chat view - view-specific by composition!
 *
 * @example View-specific header
 * ```tsx
 * <CopilotChat.ChatView>
 *   <CopilotChat.Header>Only shows in chat view!</CopilotChat.Header>
 * </CopilotChat.ChatView>
 * ```
 */
export interface ChatViewProps {
  children?: React.ReactNode;
  className?: string;
}

function ChatView({ children, className }: ChatViewProps) {
  const { view } = useCopilotChatContext();
  if (view !== "chat") return null;

  // If children provided, render them in a minimal wrapper (no flex-1, user controls layout)
  if (children) {
    return (
      <div className={cn("csdk-chat-view flex flex-col", className)}>
        {children}
      </div>
    );
  }

  // Marker for parent to render default chat content
  return null;
}

// Internal marker to identify ChatView without children
ChatView.displayName = "ChatView";

/**
 * Check if ChatView children consist only of Header/Footer components.
 * If so, we should still render default chat content alongside them.
 */
function chatViewHasOnlyLayoutChildren(
  chatViewElement: React.ReactElement | undefined,
): boolean {
  if (!chatViewElement?.props?.children) return false;

  const childArray = React.Children.toArray(chatViewElement.props.children);
  if (childArray.length === 0) return false;

  // Check if ALL children are Header or Footer
  return childArray.every(
    (child) =>
      React.isValidElement(child) &&
      (child.type === Header || child.type === Footer),
  );
}

/**
 * Header slot - renders header content.
 * Can be placed at root level (shows in both views) or inside HomeView/ChatView (view-specific).
 */
export interface HeaderProps {
  children: React.ReactNode;
  className?: string;
}

function Header({ children, className }: HeaderProps) {
  return <div className={cn("csdk-chat-header", className)}>{children}</div>;
}

/**
 * Footer slot - renders footer content.
 * Can be placed at root level (shows in both views) or inside HomeView/ChatView (view-specific).
 */
export interface FooterProps {
  children: React.ReactNode;
  className?: string;
}

function Footer({ children, className }: FooterProps) {
  return <div className={cn("csdk-chat-footer", className)}>{children}</div>;
}

/**
 * Input component that auto-connects to CopilotChat context.
 * Handles sending messages without manual wiring.
 */
export interface InputProps {
  placeholder?: string;
  className?: string;
}

function Input({ placeholder: placeholderProp, className }: InputProps) {
  const {
    send,
    isLoading,
    onStop,
    placeholder: defaultPlaceholder,
  } = useCopilotChatContext();
  const [value, setValue] = useState("");

  const handleSubmit = useCallback(() => {
    if (value.trim() && !isLoading) {
      send(value.trim());
      setValue("");
    }
  }, [value, isLoading, send]);

  return (
    <PromptInput
      value={value}
      onValueChange={setValue}
      isLoading={isLoading}
      onSubmit={handleSubmit}
      className={cn("csdk-compound-input", className)}
    >
      <PromptInputTextarea
        placeholder={placeholderProp ?? defaultPlaceholder}
      />
      <PromptInputActions className="justify-end">
        <PromptInputAction tooltip={isLoading ? "Stop" : "Send"}>
          {isLoading ? (
            <Button
              size="sm"
              variant="destructive"
              className="csdk-button-stop rounded-full size-9"
              onClick={onStop}
            >
              <StopIcon className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              size="sm"
              className="csdk-button-send rounded-full size-9"
              onClick={handleSubmit}
              disabled={!value.trim()}
            >
              <ArrowUpIcon className="h-4 w-4" />
            </Button>
          )}
        </PromptInputAction>
      </PromptInputActions>
    </PromptInput>
  );
}

/**
 * Suggestions component that auto-connects to CopilotChat context.
 * Clicking a suggestion sends it as a message.
 */
export interface SuggestionsCompoundProps {
  items: string[];
  label?: string;
  className?: string;
  buttonClassName?: string;
}

function SuggestionsCompound({
  items,
  label,
  className,
  buttonClassName,
}: SuggestionsCompoundProps) {
  const { send } = useCopilotChatContext();

  if (items.length === 0) return null;

  return (
    <div className={cn("csdk-compound-suggestions", className)}>
      {label && (
        <span className="text-sm text-muted-foreground mb-2 block">
          {label}
        </span>
      )}
      <div className="flex flex-wrap gap-2">
        {items.map((item, i) => (
          <button
            key={i}
            onClick={() => send(item)}
            className={cn(
              "csdk-followup-button px-3 py-1.5 text-sm rounded-full border",
              "bg-background hover:bg-accent transition-colors",
              buttonClassName,
            )}
          >
            {item}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * BackButton component that starts a new chat and returns to home view.
 * Auto-connects to CopilotChat context for thread management.
 */
export interface BackButtonProps {
  className?: string;
  children?: React.ReactNode;
  /** Override disabled state (combines with isThreadBusy from context) */
  disabled?: boolean;
  /** Accessible label for screen readers */
  "aria-label"?: string;
}

function BackButton({
  className,
  children,
  disabled,
  "aria-label": ariaLabel = "Start new chat",
}: BackButtonProps) {
  const { onNewChat, isThreadBusy } = useCopilotChatContext();

  if (!onNewChat) return null;

  return (
    <button
      type="button"
      onClick={onNewChat}
      disabled={disabled || isThreadBusy}
      aria-label={ariaLabel}
      className={cn(
        "csdk-back-button flex items-center gap-1 text-sm",
        "hover:bg-accent rounded px-2 py-1",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        className,
      )}
    >
      {children || (
        <>
          <ChevronLeftIcon className="h-4 w-4" />
          <span>New Chat</span>
        </>
      )}
    </button>
  );
}

/**
 * ThreadPicker compound wrapper that auto-connects to CopilotChat context.
 * Only renders when persistence is enabled (thread functions available).
 */
export type ThreadPickerCompoundProps = Omit<
  ThreadPickerProps,
  | "value"
  | "threads"
  | "onSelect"
  | "onNewThread"
  | "onDeleteThread"
  | "disabled"
>;

function ThreadPickerCompound(props: ThreadPickerCompoundProps) {
  const {
    threads,
    currentThreadId,
    onSwitchThread,
    onNewChat,
    onDeleteThread,
    isThreadBusy,
  } = useCopilotChatContext();

  // Only render if persistence is enabled (thread functions available)
  if (!threads || !onSwitchThread) return null;

  return (
    <ThreadPicker
      {...props}
      value={currentThreadId}
      threads={threads}
      onSelect={onSwitchThread}
      onNewThread={onNewChat}
      onDeleteThread={onDeleteThread}
      disabled={isThreadBusy}
    />
  );
}

// ============================================================================
// Helper to detect compound children
// ============================================================================

function hasCompoundChild(
  children: React.ReactNode,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ...components: React.ComponentType<any>[]
): boolean {
  return React.Children.toArray(children).some(
    (child) =>
      React.isValidElement(child) &&
      components.includes(child.type as React.ComponentType),
  );
}

/**
 * Find a specific compound child by type
 */
function findCompoundChild(
  children: React.ReactNode,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  component: React.ComponentType<any>,
): React.ReactElement | undefined {
  return React.Children.toArray(children).find(
    (child) => React.isValidElement(child) && child.type === component,
  ) as React.ReactElement | undefined;
}

/**
 * Filter compound children by types
 */
function filterCompoundChildren(
  children: React.ReactNode,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ...components: React.ComponentType<any>[]
): React.ReactElement[] {
  return React.Children.toArray(children).filter(
    (child) =>
      React.isValidElement(child) &&
      components.includes(child.type as React.ComponentType),
  ) as React.ReactElement[];
}

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

function ChatComponent({
  // Core
  messages = [],
  onSendMessage,
  onStop,
  isLoading = false,
  // Compound children
  children,
  // Labels
  placeholder = "Type a message...",
  welcomeMessage,
  title,
  // Header
  showHeader = false,
  header,
  threadPicker,
  // Deprecated header props (backwards compat)
  logo,
  name,
  onClose,
  // Appearance
  showPoweredBy = true,
  showUserAvatar = false,
  userAvatar: userAvatarProp,
  assistantAvatar: assistantAvatarProp,
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
  // Welcome Screen
  welcome,
  recentThreads = [],
  onSelectThread,
  onDeleteThread,
  onViewMoreThreads,
  // Tool Executions
  isProcessing = false,
  registeredTools,
  toolRenderers,
  mcpToolRenderer,
  fallbackToolRenderer,
  onApproveToolExecution,
  onRejectToolExecution,
  // Follow-up Questions
  showFollowUps = true,
  followUpClassName,
  followUpButtonClassName,
  // Citations/Sources
  citations,
  // Custom rendering
  messageView,
  renderMessage,
  wrapMessage,
  renderInput,
  renderHeader,
  // Avatar grouping
  groupConsecutiveMessages = false,
  // Styling
  className,
  classNames = {},
  // Thread management for compound components
  onNewChat,
  threads,
  currentThreadId,
  onSwitchThread,
  isThreadBusy,
  // Branching
  getBranchInfo,
  onSwitchBranch,
  onEditMessage,
}: ChatProps) {
  // Merge avatar props with defaults (so user can pass partial config)
  const userAvatar = { fallback: "U", ...userAvatarProp };
  const assistantAvatar = { fallback: "AI", ...assistantAvatarProp };

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

  // Determine view state
  const view = messages.length === 0 ? "home" : "chat";

  // Check if user provided custom compound components
  const hasCustomHome = hasCompoundChild(children, Home, HomeView);
  const hasCustomChatView = hasCompoundChild(children, ChatView);
  const hasCustomLayout = hasCustomHome || hasCustomChatView;

  // Extract root-level Header/Footer (shown in both views)
  const rootHeader = findCompoundChild(children, Header);
  const rootFooter = findCompoundChild(children, Footer);

  // Get view-specific children
  const viewChildren = filterCompoundChildren(
    children,
    HomeView,
    Home,
    ChatView,
  );

  // Behavior children: non-layout compound types (MessageActions registrars, custom hook components)
  // These always mount so their useLayoutEffect registrations run regardless of view state.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const layoutTypes: any[] = [HomeView, Home, ChatView, Header, Footer];
  const behaviorChildren = React.Children.toArray(children).filter(
    (child) =>
      React.isValidElement(child) &&
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      !layoutTypes.includes(child.type as any),
  ) as React.ReactElement[];

  // Check if ChatView has no children or only Header/Footer children (should render default)
  const chatViewElement = findCompoundChild(children, ChatView);
  const chatViewNeedsDefault =
    chatViewElement &&
    (!chatViewElement.props.children ||
      chatViewHasOnlyLayoutChildren(chatViewElement));

  // Determine if we should show the default welcome screen
  const showDefaultWelcome =
    view === "home" && !hasCustomHome && welcome !== false;

  // Get welcome config (could be object or undefined/true)
  const welcomeConfig = typeof welcome === "object" ? welcome : undefined;

  // Stable send function reference
  const send = useCallback(
    (message: string, attachments?: MessageAttachment[]) => {
      onSendMessage?.(message, attachments);
    },
    [onSendMessage],
  );

  // Context value for compound components (memoized to prevent unnecessary re-renders)
  const contextValue: CopilotChatInternalContext = React.useMemo(
    () => ({
      view,
      send,
      isLoading,
      onStop,
      attachmentsEnabled,
      placeholder,
      // Messages for Chat.MessageList primitive
      messages,
      registeredTools,
      // Thread management - passed from connected-chat
      onNewChat,
      threads,
      currentThreadId,
      onSwitchThread,
      onDeleteThread,
      isThreadBusy,
    }),
    [
      view,
      send,
      isLoading,
      onStop,
      attachmentsEnabled,
      placeholder,
      messages,
      registeredTools,
      onNewChat,
      threads,
      currentThreadId,
      onSwitchThread,
      onDeleteThread,
      isThreadBusy,
    ],
  );

  return (
    <MessageActionsProvider>
      <CopilotChatContext.Provider value={contextValue}>
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
            <div className="csdk-dropzone-overlay absolute inset-0 z-50 bg-primary/10 border-2 border-dashed border-primary flex items-center justify-center">
              <div className="text-primary font-medium text-lg">
                Drop files here
              </div>
            </div>
          )}
          {/* Built-in Header (from showHeader prop) */}
          {showHeader &&
            (renderHeader ? (
              renderHeader()
            ) : (
              <ChatHeader
                logo={header?.logo ?? logo}
                name={header?.name ?? name}
                title={title}
                threadPicker={threadPicker}
                onClose={header?.onClose ?? onClose}
                className={classNames.header}
              />
            ))}

          {/* Root-level custom Header (shows in both views) */}
          {rootHeader}

          {/* Behavior children — always mounted (MessageActions registrars, hook components) */}
          {behaviorChildren.length > 0 && behaviorChildren}

          {/* Custom compound children - view components self-filter based on current view */}
          {hasCustomLayout && viewChildren}

          {showDefaultWelcome ? (
            /* Default Welcome Screen (centered input) */
            <ChatWelcome
              config={welcomeConfig}
              suggestions={suggestions}
              recentThreads={recentThreads}
              onSendMessage={(msg, attachments) =>
                onSendMessage?.(msg, attachments)
              }
              onSelectThread={onSelectThread}
              onDeleteThread={onDeleteThread}
              onViewMoreThreads={onViewMoreThreads}
              isLoading={isLoading}
              onStop={onStop}
              placeholder={placeholder}
              attachmentsEnabled={attachmentsEnabled}
              attachmentsDisabledTooltip={attachmentsDisabledTooltip}
              maxFileSize={maxFileSize}
              allowedFileTypes={allowedFileTypes}
              processAttachment={processAttachmentProp}
            />
          ) : null}

          {/* Normal Chat UI (messages + input at bottom) - show when there are messages */}
          {/* Renders when: view is chat AND (no explicit ChatView OR ChatView needs default content) */}
          {view === "chat" && (!hasCustomChatView || chatViewNeedsDefault) && (
            <>
              {/* Messages wrapper - relative for scroll button positioning */}
              <div className="flex-1 min-h-0 flex flex-col">
                <ChatContainerRoot
                  className={cn("flex-1 relative", classNames.container)}
                >
                  <ChatContainerContent
                    className={cn("gap-4 p-4", classNames.messageList)}
                  >
                    {/* Welcome message */}
                    {messages.length === 0 && (
                      <div className="py-8 text-center text-muted-foreground">
                        {welcomeMessage ||
                          "Send a message to start the conversation"}
                      </div>
                    )}

                    {/* Messages */}
                    {(() => {
                      const messageElements = messages.map((message, index) => {
                        const isLastMessage = index === messages.length - 1;

                        const GROUP_THRESHOLD_MS = 5 * 60 * 1000;
                        const shouldHideAvatar = (() => {
                          if (!groupConsecutiveMessages || index === 0)
                            return false;
                          let prevIdx = index - 1;
                          while (prevIdx >= 0) {
                            const prev = messages[prevIdx];
                            const isToolMsg = prev.role === "tool";
                            const isInvisibleSystem =
                              prev.role === "system" &&
                              // eslint-disable-next-line @typescript-eslint/no-explicit-any
                              (prev.metadata as Record<string, unknown>)
                                ?.type !== "compaction-marker";
                            if (!isToolMsg && !isInvisibleSystem) break;
                            prevIdx--;
                          }
                          if (prevIdx < 0) return false;
                          const prevVisible = messages[prevIdx];
                          if (prevVisible.role !== message.role) return false;
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          const curTs = (message as any).timestamp as
                            | number
                            | undefined;
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          const prevTs = (prevVisible as any).timestamp as
                            | number
                            | undefined;
                          if (
                            curTs &&
                            prevTs &&
                            curTs - prevTs > GROUP_THRESHOLD_MS
                          )
                            return false;
                          return true;
                        })();

                        const isEmptyAssistant =
                          message.role === "assistant" &&
                          !message.content?.trim();

                        // Check if message has tool_calls or toolExecutions
                        const hasToolCalls =
                          message.tool_calls && message.tool_calls.length > 0;
                        const hasToolExecutions =
                          message.toolExecutions &&
                          message.toolExecutions.length > 0;

                        // Check if this message has pending tool approvals
                        const hasPendingApprovals =
                          message.toolExecutions?.some(
                            (exec) => exec.approvalStatus === "required",
                          );

                        // Hide empty assistant messages that aren't loading and have no content to show
                        if (isEmptyAssistant) {
                          const shouldShowMessage =
                            hasToolCalls ||
                            hasToolExecutions ||
                            hasPendingApprovals ||
                            (isLastMessage && (isLoading || isProcessing));

                          if (!shouldShowMessage) {
                            return null;
                          }
                          // Otherwise, continue to render via DefaultMessage
                        }

                        // Check for saved executions in metadata (historical)
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        const savedExecutions = (message as any).metadata
                          ?.toolExecutions as ToolExecutionData[] | undefined;
                        const messageToolExecutions =
                          message.toolExecutions || savedExecutions;

                        const messageWithExecutions = messageToolExecutions
                          ? {
                              ...message,
                              toolExecutions: messageToolExecutions,
                            }
                          : message;

                        // Handle follow-up click - use onSendMessage if available
                        const handleFollowUpClick = (question: string) => {
                          if (onSuggestionClick) {
                            onSuggestionClick(question);
                          } else {
                            onSendMessage?.(question);
                          }
                        };

                        if (renderMessage) {
                          return (
                            <React.Fragment key={message.id}>
                              {renderMessage(messageWithExecutions, index)}
                            </React.Fragment>
                          );
                        }

                        const defaultMsg = (
                          <DefaultMessage
                            key={message.id}
                            message={messageWithExecutions}
                            userAvatar={
                              shouldHideAvatar && message.role === "user"
                                ? { ...userAvatar, className: "invisible" }
                                : userAvatar
                            }
                            assistantAvatar={
                              shouldHideAvatar && message.role === "assistant"
                                ? { ...assistantAvatar, className: "invisible" }
                                : assistantAvatar
                            }
                            showUserAvatar={showUserAvatar}
                            userMessageClassName={classNames.userMessage}
                            assistantMessageClassName={
                              classNames.assistantMessage
                            }
                            size={fontSize}
                            isLastMessage={isLastMessage}
                            isLoading={isLoading}
                            isProcessing={isProcessing}
                            loaderVariant={loaderVariant}
                            registeredTools={registeredTools}
                            toolRenderers={toolRenderers}
                            mcpToolRenderer={mcpToolRenderer}
                            fallbackToolRenderer={fallbackToolRenderer}
                            onApproveToolExecution={onApproveToolExecution}
                            onRejectToolExecution={onRejectToolExecution}
                            showFollowUps={showFollowUps}
                            onFollowUpClick={handleFollowUpClick}
                            followUpClassName={followUpClassName}
                            followUpButtonClassName={followUpButtonClassName}
                            citations={
                              citations === false
                                ? { enabled: false }
                                : citations
                            }
                            branchInfo={
                              message.role === "user"
                                ? (getBranchInfo?.(message.id) ?? null)
                                : null
                            }
                            onSwitchBranch={onSwitchBranch}
                            onEditMessage={onEditMessage}
                          />
                        );

                        return wrapMessage ? (
                          <React.Fragment key={message.id}>
                            {wrapMessage(
                              defaultMsg,
                              messageWithExecutions,
                              index,
                            )}
                          </React.Fragment>
                        ) : (
                          defaultMsg
                        );
                      });
                      return messageView?.children
                        ? messageView.children({ messages, messageElements })
                        : messageElements;
                    })()}

                    {/* Loading indicator for non-streaming - when last message is user and no assistant message yet */}
                    {isLoading &&
                      !isProcessing &&
                      messages.length > 0 &&
                      messages[messages.length - 1]?.role === "user" && (
                        <DefaultMessage
                          message={{
                            id: "loading-placeholder",
                            role: "assistant",
                            content: "",
                          }}
                          userAvatar={userAvatar}
                          assistantAvatar={assistantAvatar}
                          showUserAvatar={false}
                          size={fontSize}
                          isLastMessage={true}
                          isLoading={true}
                          isProcessing={false}
                          loaderVariant={loaderVariant}
                        />
                      )}

                    <ChatContainerScrollAnchor />
                  </ChatContainerContent>

                  {/* Scroll to bottom button - inside ChatContainerRoot for context, outside ChatContainerContent so it doesn't scroll */}
                  <div className="csdk-scroll-btn-layer absolute inset-0 pointer-events-none z-10 flex items-end justify-end p-4">
                    <ScrollButton className="shadow-md pointer-events-auto" />
                  </div>
                </ChatContainerRoot>
              </div>

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
                <div className={cn("p-2 pt-0", classNames.input)}>
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
                              <span className="text-destructive text-xs">
                                Error
                              </span>
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
                              "csdk-button-attach flex h-8 w-8 items-center justify-center rounded-2xl",
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
                            className="csdk-button-stop rounded-full size-9"
                            onClick={onStop}
                          >
                            <StopIcon className="h-4 w-4" />
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            className="csdk-button-send rounded-full size-9"
                            onClick={handleSubmit}
                            disabled={
                              !input.trim() &&
                              !pendingAttachments.some(
                                (att) => att.status === "ready",
                              )
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
            </>
          )}

          {/* Root-level custom Footer (shows in both views) */}
          {rootFooter}
        </div>
      </CopilotChatContext.Provider>
    </MessageActionsProvider>
  );
}

// ============================================================================
// Attach Compound Components & Export
// ============================================================================

/**
 * Chat component with compound component pattern.
 *
 * @example Default usage (backward compatible)
 * ```tsx
 * <Chat messages={messages} onSendMessage={send} />
 * ```
 *
 * @example Custom home screen with compound components
 * ```tsx
 * <Chat messages={messages} onSendMessage={send}>
 *   <Chat.Home className="items-center gap-6 p-8">
 *     <h1>Welcome!</h1>
 *     <Chat.Input placeholder="Ask anything..." />
 *     <Chat.Suggestions items={["Help", "Pricing"]} />
 *   </Chat.Home>
 * </Chat>
 * ```
 *
 * @example Full layout composition (new pattern)
 * ```tsx
 * <Chat.Root messages={messages} onSendMessage={send}>
 *   <Chat.Header>Custom Header</Chat.Header>
 *   <Chat.HomeView className="gap-6 p-8">
 *     <h1>Welcome!</h1>
 *     <Chat.Input />
 *   </Chat.HomeView>
 *   <Chat.ChatView />
 *   <Chat.Footer>Custom Footer</Chat.Footer>
 * </Chat.Root>
 * ```
 *
 * @example View-specific header with navigation (new pattern)
 * ```tsx
 * <Chat.Root messages={messages} onSendMessage={send}>
 *   <Chat.HomeView>
 *     <h1>Welcome!</h1>
 *   </Chat.HomeView>
 *   <Chat.ChatView>
 *     <Chat.Header className="flex items-center justify-between p-3 border-b">
 *       <Chat.BackButton />
 *       <Chat.ThreadPicker />
 *     </Chat.Header>
 *   </Chat.ChatView>
 * </Chat.Root>
 * ```
 */
export const Chat = Object.assign(ChatComponent, {
  Root: ChatComponent, // Alias for layout composition pattern
  Home, // Backward compat alias
  HomeView, // New name
  ChatView,
  Header,
  Footer,
  Input,
  Suggestions: SuggestionsCompound,
  BackButton, // Navigation: start new chat
  ThreadPicker: ThreadPickerCompound, // Thread switching
  // Message actions compound components
  MessageActions,
  CopyAction,
  EditAction,
  FeedbackAction,
  Action: MessageAction,
});

// Re-export compound components for direct access and TypeScript declarations
export {
  HomeView,
  Home,
  ChatView,
  Header,
  Footer,
  Input as ChatInput,
  SuggestionsCompound as ChatSuggestions,
  BackButton,
  ThreadPickerCompound as ChatThreadPicker,
};
