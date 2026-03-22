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
import { Loader } from "../../ui/loader";
import { MCPUIFrameList } from "../../ui/mcp-ui-frame";
import type {
  ChatMessage,
  MessageAttachment,
  ToolRenderers,
  ToolRendererProps,
  CitationConfig,
} from "./types";
import type { ToolDefinition, ToolRenderProps } from "../../../../core";
import CopilotSDKLogo from "../../icons/copilot-sdk-logo";
import { SourceGroup, type SourceItem } from "../../ui/source";
import { BranchNavigator } from "../../ui/branch-navigator";
import type { BranchInfo } from "../../../../chat/branching";
import { useMessageActionsContext } from "./message-actions-context";
import { CheckIcon, CopyIcon } from "./message-actions-compound";

// ─── FloatingActions ──────────────────────────────────────────────────────────

function FloatingActions({
  message,
  role,
  align = "left",
  onEdit,
}: {
  message: ChatMessage;
  role: "user" | "assistant";
  align?: "left" | "right";
  onEdit?: () => void;
}) {
  const ctx = useMessageActionsContext();
  const [copiedId, setCopiedId] = React.useState<string | null>(null);

  if (!ctx) return null;
  const actions = ctx.getActions(role);
  if (actions.length === 0) return null;

  return (
    <div
      className={cn(
        "flex items-center gap-0.5 mt-1",
        "opacity-0 group-hover/message:opacity-100 transition-opacity duration-150",
        align === "right" ? "justify-end" : "justify-start",
      )}
    >
      {actions.map((action) => {
        const isHidden =
          typeof action.hidden === "function"
            ? action.hidden({ message })
            : action.hidden;
        if (isHidden) return null;

        const isCopied = copiedId === action.id;

        return (
          <button
            key={action.id}
            type="button"
            title={action.tooltip}
            aria-label={action.tooltip}
            className={cn(
              "flex items-center justify-center size-6 rounded-md",
              "text-muted-foreground hover:text-foreground hover:bg-muted",
              "transition-colors",
              action.className,
            )}
            onClick={() => {
              if (action.id === "edit" && onEdit) {
                onEdit();
                return;
              }
              if (action.id === "copy") {
                navigator.clipboard.writeText(message.content ?? "");
                setCopiedId("copy");
                setTimeout(() => setCopiedId(null), 1500);
                return;
              }
              action.onClick({ message });
            }}
          >
            {action.id === "copy" && isCopied ? <CheckIcon /> : action.icon}
          </button>
        );
      })}
    </div>
  );
}

type DefaultMessageProps = {
  message: ChatMessage;
  userAvatar: {
    src?: string;
    fallback?: string;
    component?: React.ReactNode;
    className?: string;
  };
  assistantAvatar: {
    src?: string;
    fallback?: string;
    component?: React.ReactNode;
    className?: string;
  };
  showUserAvatar?: boolean;
  userMessageClassName?: string;
  assistantMessageClassName?: string;
  /** Font size variant: 'sm' (14px), 'base' (16px), 'lg' (18px) */
  size?: "sm" | "base" | "lg";
  /** Whether this is the last message (for streaming state) */
  isLastMessage?: boolean;
  /** Whether the chat is currently loading/streaming */
  isLoading?: boolean;
  /** Whether waiting for server after tool completion */
  isProcessing?: boolean;
  /** Loader variant for typing indicator */
  loaderVariant?:
    | "dots"
    | "typing"
    | "wave"
    | "terminal"
    | "text-blink"
    | "text-shimmer"
    | "loading-dots";
  /** Registered tools (for accessing tool's render function) */
  registeredTools?: ToolDefinition[];
  /** Custom renderers for tool results (Generative UI) - fallback when tool has no render prop */
  toolRenderers?: ToolRenderers;
  /** Catch-all renderer for MCP tools (tools with source: "mcp") */
  mcpToolRenderer?: React.ComponentType<ToolRendererProps>;
  /** Catch-all renderer for any tool not matched by toolRenderers */
  fallbackToolRenderer?: React.ComponentType<ToolRendererProps>;
  /** Called when user approves a tool execution */
  onApproveToolExecution?: (
    executionId: string,
    extraData?: Record<string, unknown>,
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
  /** Citation/Sources configuration */
  citations?: CitationConfig;

  // ============================================
  // Branching
  // ============================================

  /**
   * Branch navigation info for this message.
   * When non-null and totalSiblings > 1, the BranchNavigator is shown.
   */
  branchInfo?: BranchInfo | null;
  /**
   * Called when the user navigates to a sibling branch.
   * Receives the message ID to switch to.
   */
  onSwitchBranch?: (messageId: string) => void;
  /**
   * Called when the user submits an edited message.
   * Triggers a new branch from the same parent as messageId.
   */
  onEditMessage?: (messageId: string, newContent: string) => void;
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
  isProcessing = false,
  loaderVariant = "typing",
  registeredTools,
  toolRenderers,
  mcpToolRenderer,
  fallbackToolRenderer,
  onApproveToolExecution,
  onRejectToolExecution,
  showFollowUps = true,
  onFollowUpClick,
  followUpClassName,
  followUpButtonClassName,
  citations = { enabled: true },
  branchInfo,
  onSwitchBranch,
  onEditMessage,
}: DefaultMessageProps) {
  const isUser = message.role === "user";
  const isCompactionMarker =
    message.role === "system" &&
    (message.metadata as Record<string, unknown>)?.type === "compaction-marker";
  const isStreaming = isLastMessage && isLoading;

  // Inline-edit state (user messages only)
  const [isEditing, setIsEditing] = React.useState(false);
  const [editValue, setEditValue] = React.useState(message.content ?? "");
  const editRef = React.useRef<HTMLTextAreaElement>(null);

  const startEdit = React.useCallback(() => {
    setEditValue(message.content ?? "");
    setIsEditing(true);
    // Focus textarea on next frame
    requestAnimationFrame(() => editRef.current?.focus());
  }, [message.content]);

  const cancelEdit = React.useCallback(() => {
    setIsEditing(false);
  }, []);

  const submitEdit = React.useCallback(() => {
    const trimmed = editValue.trim();
    if (!trimmed || !onEditMessage) return;
    onEditMessage(message.id, trimmed);
    setIsEditing(false);
  }, [editValue, message.id, onEditMessage]);

  const handleEditKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        submitEdit();
      }
      if (e.key === "Escape") {
        cancelEdit();
      }
    },
    [submitEdit, cancelEdit],
  );

  // Whether branching UI should be shown for this message
  const showBranchNav =
    isUser && branchInfo && branchInfo.totalSiblings > 1 && onSwitchBranch;
  const showEditBtn = isUser && !!onEditMessage && !isLoading;

  // Render compaction marker divider
  if (isCompactionMarker) {
    const tokensSaved = (message.metadata as Record<string, unknown>)
      ?.tokensSaved as number | undefined;
    return (
      <div className="flex items-center gap-3 py-2 px-1 my-1">
        <div className="flex-1 h-px bg-border" />
        <span className="text-[11px] text-muted-foreground whitespace-nowrap flex items-center gap-1.5">
          <svg
            className="size-3 opacity-60"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19 9l-7 7-7-7"
            />
          </svg>
          {tokensSaved
            ? `Earlier conversation summarized · ~${tokensSaved.toLocaleString()} tokens saved`
            : "Earlier conversation summarized"}
        </span>
        <div className="flex-1 h-px bg-border" />
      </div>
    );
  }

  // Parse follow-up questions from assistant messages
  const { cleanContent: contentWithoutFollowUps, followUps } =
    React.useMemo(() => {
      if (isUser || !message.content) {
        return { cleanContent: message.content, followUps: [] };
      }
      return parseFollowUps(message.content);
    }, [message.content, isUser]);

  // Strip "Sources:" line from AI response (we show them as chips instead)
  const cleanContent = React.useMemo(() => {
    if (!contentWithoutFollowUps) return contentWithoutFollowUps;
    // Remove lines like "Sources: [link](url), ..." or "**Sources:** ..."
    return contentWithoutFollowUps
      .replace(/\n*\*{0,2}Sources:?\*{0,2}\s*(\[.+?\]\(.+?\)[,\s]*)+$/gi, "")
      .trim();
  }, [contentWithoutFollowUps]);

  // Only show follow-ups on the last assistant message when not loading
  const shouldShowFollowUps =
    showFollowUps &&
    !isUser &&
    isLastMessage &&
    !isLoading &&
    followUps.length > 0 &&
    onFollowUpClick;

  // Extract sources from web_search tool results OR native citations
  const sources = React.useMemo((): SourceItem[] => {
    if (isUser || !citations.enabled) return [];

    const extractedSources: SourceItem[] = [];

    // Helper to add source without duplicates
    const addSource = (url: string, title?: string, description?: string) => {
      if (url && !extractedSources.find((s) => s.href === url)) {
        extractedSources.push({
          href: url,
          title: title || getDomainFromUrl(url),
          description,
        });
      }
    };

    // 1. Check for native web search citations (from metadata.citations)
    const nativeCitations = (
      message.metadata as {
        citations?: Array<{ url: string; title?: string; citedText?: string }>;
      }
    )?.citations;
    if (nativeCitations && Array.isArray(nativeCitations)) {
      nativeCitations.forEach((citation) => {
        addSource(citation.url, citation.title, citation.citedText);
      });
    }

    // 2. Check tool executions for web_search results (custom tool fallback)
    message.toolExecutions?.forEach((exec) => {
      if (
        exec.name === "web_search" &&
        exec.status === "completed" &&
        exec.result
      ) {
        const result = exec.result as Record<string, unknown>;

        // Pattern 1: result.data.results (standard format from our providers)
        const dataObj = result.data as Record<string, unknown> | undefined;
        if (dataObj?.results && Array.isArray(dataObj.results)) {
          (
            dataObj.results as Array<{
              url: string;
              title?: string;
              content?: string;
            }>
          ).forEach((r) => {
            addSource(r.url, r.title, r.content);
          });
        }

        // Pattern 2: result.results directly
        if (result.results && Array.isArray(result.results)) {
          (
            result.results as Array<{
              url: string;
              title?: string;
              content?: string;
            }>
          ).forEach((r) => {
            addSource(r.url, r.title, r.content);
          });
        }

        // Pattern 3: result.data is WebSearchResponse (results at data level)
        if (dataObj && !dataObj.results && dataObj.query) {
          const response = dataObj as {
            results?: Array<{ url: string; title?: string; content?: string }>;
          };
          if (response.results && Array.isArray(response.results)) {
            response.results.forEach((r) => {
              addSource(r.url, r.title, r.content);
            });
          }
        }
      }
    });

    return extractedSources;
  }, [message.metadata, message.toolExecutions, isUser, citations.enabled]);

  // Helper to extract domain from URL
  function getDomainFromUrl(url: string): string {
    try {
      return new URL(url).hostname.replace("www.", "");
    } catch {
      return url;
    }
  }

  const shouldShowSources = citations.enabled && sources.length > 0;

  // User message - right aligned, avatar optional
  if (isUser) {
    const hasAttachments =
      message.attachments && message.attachments.length > 0;

    return (
      <Message
        className={cn(
          "csdk-message csdk-user-message flex gap-2 group/user-msg group/message justify-end",
        )}
      >
        <div className="flex flex-col items-end max-w-[80%] min-w-0">
          {/* Edit mode: inline textarea */}
          {isEditing ? (
            <div className="flex flex-col gap-1.5 w-full min-w-[200px]">
              <textarea
                ref={editRef}
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={handleEditKeyDown}
                rows={Math.max(2, (editValue.match(/\n/g) || []).length + 1)}
                className={cn(
                  "csdk-edit-textarea w-full rounded-lg px-3 py-2 text-sm resize-none",
                  "bg-primary text-primary-foreground placeholder:text-primary-foreground/50",
                  "focus:outline-none focus:ring-2 focus:ring-primary-foreground/30",
                  userMessageClassName,
                )}
              />
              <div className="flex gap-1.5 justify-end">
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="csdk-edit-cancel px-3 py-1 text-xs rounded-md bg-muted text-muted-foreground hover:bg-muted/80 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={submitEdit}
                  disabled={!editValue.trim()}
                  className="csdk-edit-submit px-3 py-1 text-xs rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                  Send
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Text content */}
              {message.content && (
                <div className="relative">
                  <MessageContent
                    className={cn(
                      "csdk-message-user rounded-lg px-4 py-2 bg-primary text-primary-foreground",
                      userMessageClassName,
                    )}
                    markdown
                    size={size}
                  >
                    {message.content}
                  </MessageContent>
                  {/* Edit button — hover reveal */}
                  {showEditBtn && (
                    <button
                      type="button"
                      onClick={startEdit}
                      aria-label="Edit message"
                      className={cn(
                        "csdk-edit-btn absolute -left-7 top-1/2 -translate-y-1/2",
                        "size-6 flex items-center justify-center rounded-full",
                        "text-muted-foreground bg-background border border-border shadow-sm",
                        "opacity-0 group-hover/user-msg:opacity-100 transition-opacity",
                        "hover:text-foreground hover:bg-muted",
                      )}
                    >
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    </button>
                  )}
                </div>
              )}
              {/* Image Attachments */}
              {hasAttachments && (
                <div className="mt-2 flex flex-wrap gap-2 justify-end">
                  {message.attachments!.map((attachment, index) => (
                    <AttachmentPreview key={index} attachment={attachment} />
                  ))}
                </div>
              )}
              {/* Branch Navigator */}
              {showBranchNav && (
                <BranchNavigator
                  siblingIndex={branchInfo!.siblingIndex}
                  totalSiblings={branchInfo!.totalSiblings}
                  hasPrevious={branchInfo!.hasPrevious}
                  hasNext={branchInfo!.hasNext}
                  onPrevious={() =>
                    onSwitchBranch!(
                      branchInfo!.siblingIds[branchInfo!.siblingIndex - 1],
                    )
                  }
                  onNext={() =>
                    onSwitchBranch!(
                      branchInfo!.siblingIds[branchInfo!.siblingIndex + 1],
                    )
                  }
                  className="mt-1"
                />
              )}
              {/* Floating actions for user messages */}
              <FloatingActions
                message={message}
                role="user"
                align="right"
                onEdit={onEditMessage ? startEdit : undefined}
              />
            </>
          )}
        </div>
        {showUserAvatar && (
          <MessageAvatar
            src={userAvatar.src}
            alt="User"
            fallback={userAvatar.fallback}
            className={userAvatar.className}
          >
            {userAvatar.component}
          </MessageAvatar>
        )}
      </Message>
    );
  }

  // Helper: check if a tool execution is hidden (shouldn't appear in UI)
  // Checks both: 1) execution's hidden flag (from server), 2) registered tool's hidden flag
  const isToolHidden = (exec: { name: string; hidden?: boolean }): boolean => {
    // Check execution's own hidden flag first (from server's action:start event)
    if (exec.hidden === true) return true;
    // Then check registered tool definition
    const toolDef = registeredTools?.find((t) => t.name === exec.name);
    return toolDef?.hidden === true;
  };

  // Separate tool executions into categories (excluding hidden tools)
  const pendingApprovalTools = message.toolExecutions?.filter(
    (exec) => exec.approvalStatus === "required" && !isToolHidden(exec),
  );
  const completedTools = message.toolExecutions?.filter(
    (exec) => exec.approvalStatus !== "required" && !isToolHidden(exec),
  );

  // Helper: check if tool has any custom render (toolRenderers, mcpToolRenderer, fallbackToolRenderer, or tool.render)
  const hasCustomRender = (toolName: string, execSource?: string): boolean => {
    if (toolRenderers?.[toolName]) return true;
    const toolDef = registeredTools?.find((t) => t.name === toolName);
    // Check if mcpToolRenderer applies (MCP tool with catch-all renderer)
    if (mcpToolRenderer && (execSource === "mcp" || toolDef?.source === "mcp"))
      return true;
    if (fallbackToolRenderer) return true;
    if (toolDef?.render) return true;
    return false;
  };

  // Split completed tools: those with custom render vs default ToolSteps
  const toolsWithCustomRender = completedTools?.filter((exec) =>
    hasCustomRender(exec.name, exec.source),
  );
  const toolsWithoutCustomRender = completedTools?.filter(
    (exec) => !hasCustomRender(exec.name, exec.source),
  );

  // Check for native web search citations (from metadata, not custom tool)
  const hasNativeCitations = !!(message.metadata as { citations?: unknown[] })
    ?.citations?.length;

  // Convert tools without custom render to ToolStepData format
  // Hide web_search tool step when we have native citations (already shown as chips)
  const toolSteps = toolsWithoutCustomRender
    ?.filter((exec) => !(exec.name === "web_search" && hasNativeCitations))
    .map((exec) => ({
      id: exec.id,
      name: exec.name,
      args: exec.args,
      status: exec.status,
      result: exec.result,
      error: exec.error,
    }));

  // Assistant message - left aligned with avatar
  return (
    <Message className="csdk-message csdk-assistant-message flex gap-2 group/message">
      <MessageAvatar
        src={assistantAvatar.src}
        alt="Assistant"
        fallback={assistantAvatar.fallback}
        fallbackIcon={
          !assistantAvatar.src &&
          !assistantAvatar.fallback &&
          !assistantAvatar.component ? (
            <CopilotSDKLogo className="size-5" />
          ) : undefined
        }
        className={cn("bg-muted", assistantAvatar.className)}
      >
        {assistantAvatar.component}
      </MessageAvatar>
      <div className="min-w-0 max-w-[80%] w-fit">
        {/* Reasoning/Thinking (collapsible, above content) */}
        {message.thinking && (
          <SimpleReasoning
            content={message.thinking}
            isStreaming={isStreaming}
            className="mb-2"
          />
        )}

        {/* Show loader when processing after tool execution (only for last message with no tools yet) */}
        {isLastMessage &&
        isProcessing &&
        !completedTools?.length &&
        !pendingApprovalTools?.length ? (
          <div className="rounded-lg bg-muted px-4 py-2">
            <Loader variant="dots" size="sm" />
          </div>
        ) : /* Show streaming loader when loading with no content and no tools */
        isLastMessage &&
          isLoading &&
          !cleanContent?.trim() &&
          !toolsWithCustomRender?.length &&
          !toolsWithoutCustomRender?.length &&
          !pendingApprovalTools?.length ? (
          <div className="rounded-lg bg-muted px-4 py-2">
            <Loader variant={loaderVariant} size="sm" />
          </div>
        ) : (
          <>
            {/* Message Content - show FIRST (AI's words before tool calls) */}
            {cleanContent?.trim() && (
              <MessageContent
                className={cn(
                  "csdk-message-assistant rounded-lg px-4 py-2 bg-muted",
                  assistantMessageClassName,
                )}
                markdown
                size={size}
              >
                {cleanContent}
              </MessageContent>
            )}

            {/* Custom Tool Renderers - Priority: tool.render > fallbackToolRenderer > toolRenderers */}
            {toolsWithCustomRender && toolsWithCustomRender.length > 0 && (
              <div className={cn("space-y-2", cleanContent?.trim() && "mt-2")}>
                {toolsWithCustomRender.map((exec) => {
                  const toolDef = registeredTools?.find(
                    (t) => t.name === exec.name,
                  );

                  // PRIORITY 1: tool's own render function (defined in useTool)
                  if (toolDef?.render) {
                    let status: ToolRenderProps["status"] = "pending";
                    if (exec.status === "executing") status = "executing";
                    else if (exec.status === "completed") status = "completed";
                    else if (
                      exec.status === "error" ||
                      exec.status === "failed" ||
                      exec.status === "rejected"
                    )
                      status = "error";

                    const renderProps: ToolRenderProps = {
                      status,
                      args: exec.args,
                      result: exec.result,
                      error: exec.error,
                      toolCallId: exec.id,
                      toolName: exec.name,
                    };
                    const output = toolDef.render(
                      renderProps,
                    ) as React.ReactNode;
                    if (output != null) {
                      return (
                        <React.Fragment key={exec.id}>{output}</React.Fragment>
                      );
                    }
                  }

                  // PRIORITY 2: mcpToolRenderer (catch-all for MCP tools)
                  if (
                    mcpToolRenderer &&
                    (exec.source === "mcp" || toolDef?.source === "mcp")
                  ) {
                    const MCPRenderer = mcpToolRenderer;
                    return (
                      <MCPRenderer
                        key={exec.id}
                        execution={{
                          id: exec.id,
                          name: exec.name,
                          args: exec.args,
                          status: exec.status,
                          result: exec.result,
                          error: exec.error,
                          source: exec.source || toolDef?.source,
                        }}
                      />
                    );
                  }

                  // PRIORITY 3: toolRenderers map (app-level explicit renderer — static, always available)
                  const Renderer = toolRenderers?.[exec.name];
                  if (Renderer) {
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
                          source: exec.source,
                        }}
                      />
                    );
                  }

                  // PRIORITY 4: fallbackToolRenderer (catch-all for any unmatched tool)
                  if (fallbackToolRenderer) {
                    const FallbackRenderer = fallbackToolRenderer;
                    return (
                      <FallbackRenderer
                        key={exec.id}
                        execution={{
                          id: exec.id,
                          name: exec.name,
                          args: exec.args,
                          status: exec.status,
                          result: exec.result,
                          error: exec.error,
                          source: exec.source,
                        }}
                      />
                    );
                  }

                  // Shouldn't reach here since we filtered, but fallback
                  return null;
                })}
              </div>
            )}

            {/* Tool Steps (default display for tools without custom renderers) */}
            {toolSteps && toolSteps.length > 0 && (
              <div
                className={cn(
                  "rounded-lg bg-muted/50 px-3 py-2",
                  cleanContent?.trim() && "mt-2",
                )}
              >
                <ToolSteps steps={toolSteps} />
              </div>
            )}

            {/* MCP-UI Resources - Interactive components from MCP tools (excluding hidden) */}
            {message.toolExecutions
              ?.filter((exec) => !isToolHidden(exec))
              .map((exec) => {
                const uiResources = exec.result?._uiResources;
                if (!uiResources || uiResources.length === 0) return null;
                return (
                  <MCPUIFrameList
                    key={`${exec.id}-ui`}
                    resources={uiResources}
                    className="mt-2"
                  />
                );
              })}

            {/* Processing indicator below completed tools (AI is continuing after tool execution) */}
            {isLastMessage &&
              isProcessing &&
              completedTools &&
              completedTools.length > 0 && (
                <div className="mt-2 rounded-lg bg-muted px-4 py-2">
                  <Loader variant="dots" size="sm" />
                </div>
              )}

            {/* Tool Approval Confirmations - Priority: toolRenderers > tool.render > default */}
            {pendingApprovalTools && pendingApprovalTools.length > 0 && (
              <div className="mt-2 space-y-2">
                {pendingApprovalTools.map((tool) => {
                  // Approval callbacks for custom renders
                  const approvalCallbacks = {
                    onApprove: (extraData?: Record<string, unknown>) =>
                      onApproveToolExecution?.(tool.id, extraData),
                    onReject: (reason?: string) =>
                      onRejectToolExecution?.(tool.id, reason),
                    message: tool.approvalMessage,
                  };

                  // PRIORITY 1: toolRenderers (app-level override)
                  const CustomRenderer = toolRenderers?.[tool.name];
                  if (CustomRenderer) {
                    return (
                      <CustomRenderer
                        key={tool.id}
                        execution={tool}
                        approval={approvalCallbacks}
                      />
                    );
                  }

                  // PRIORITY 2: tool's own render function
                  const toolDef = registeredTools?.find(
                    (t) => t.name === tool.name,
                  );
                  if (toolDef?.render) {
                    const renderProps: ToolRenderProps = {
                      status: "approval-required",
                      args: tool.args,
                      result: tool.result,
                      error: tool.error,
                      toolCallId: tool.id,
                      toolName: tool.name,
                      approval: approvalCallbacks,
                    };
                    const output = toolDef.render(
                      renderProps,
                    ) as React.ReactNode;
                    return (
                      <React.Fragment key={tool.id}>{output}</React.Fragment>
                    );
                  }

                  // PRIORITY 3: Default PermissionConfirmation
                  return (
                    <PermissionConfirmation
                      key={tool.id}
                      state="pending"
                      toolName={tool.approvalTitle ?? tool.name}
                      message={
                        tool.approvalMessage ||
                        `This tool wants to execute. Do you approve?`
                      }
                      onApprove={(permissionLevel) =>
                        onApproveToolExecution?.(
                          tool.id,
                          undefined,
                          permissionLevel,
                        )
                      }
                      onReject={(permissionLevel) =>
                        onRejectToolExecution?.(
                          tool.id,
                          undefined,
                          permissionLevel,
                        )
                      }
                    />
                  );
                })}
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

            {/* Sources/Citations - Rendered below message content as chips */}
            {shouldShowSources && (
              <SourceGroup
                sources={sources}
                label={citations.label}
                showFavicon={citations.showFavicon ?? true}
                numbered={citations.numbered ?? false}
                maxVisible={citations.maxVisible ?? 6}
                className={cn("mt-2", citations.className)}
              />
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

            {/* Floating actions for assistant messages */}
            <FloatingActions message={message} role="assistant" align="left" />
          </>
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
