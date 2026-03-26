"use client";

import * as React from "react";
import * as ReactDOM from "react-dom";
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
              {/* Combined media + text bubble (WhatsApp/Telegram style) */}
              <div className="relative">
                {/* Images (if any) — in their own bubble */}
                {hasAttachments && (
                  <div
                    className={cn(
                      "csdk-message-media rounded-2xl overflow-hidden bg-primary p-[2px]",
                      !message.content && "max-w-[260px]",
                      message.content && "max-w-[280px] mb-[3px]",
                      userMessageClassName,
                    )}
                  >
                    <MessageMedia
                      attachments={message.attachments!}
                      hasText={!!message.content}
                      align="end"
                    />
                  </div>
                )}
                {/* Text content — same style as original, padding on MessageContent */}
                {message.content && (
                  <MessageContent
                    className={cn(
                      "csdk-message-user rounded-2xl px-4 py-2 bg-primary text-primary-foreground",
                      userMessageClassName,
                    )}
                    markdown
                    size={size}
                  >
                    {message.content}
                  </MessageContent>
                )}
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
                      "hover:text-foreground hover:bg-muted cursor-pointer",
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

            {/* Attachments (images + files) */}
            {message.attachments && message.attachments.length > 0 && (
              <div className="csdk-assistant-attachments mt-2">
                <MessageMedia
                  attachments={message.attachments}
                  hasText={!!message.content}
                  align="start"
                />
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

// ── Attachment helpers ──────────────────────────────────────────────────────

function getAttachmentSrc(attachment: MessageAttachment): string | null {
  if (attachment.url) return attachment.url;
  if (attachment.data) {
    return attachment.data.startsWith("data:")
      ? attachment.data
      : `data:${attachment.mimeType};base64,${attachment.data}`;
  }
  return null;
}

/**
 * Image lightbox — fullscreen view with CSS animation.
 * Uses portal to render at document root for proper z-index.
 *
 * Animation: backdrop fade-in 200ms ease-out, image scale 0.92→1 + fade.
 * Exit: backdrop fade-out 180ms ease-in, image scale 1→0.95 + fade.
 * Follows: staging-dim-background, easing-entrance-ease-out, easing-exit-ease-in, duration-small-state
 */
function ImageLightbox({
  src,
  alt,
  onClose,
}: {
  src: string;
  alt: string;
  onClose: () => void;
}) {
  const [closing, setClosing] = React.useState(false);
  const backdropRef = React.useRef<HTMLDivElement>(null);

  const handleClose = React.useCallback(() => {
    setClosing(true);
    // Wait for exit animation (180ms ease-in)
    setTimeout(onClose, 180);
  }, [onClose]);

  // Close on Escape
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [handleClose]);

  // Prevent body scroll
  React.useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const portal = (
    <div
      ref={backdropRef}
      className="csdk-lightbox csdk-lightbox-backdrop fixed inset-0 z-[9999] flex items-center justify-center cursor-zoom-out"
      onClick={handleClose}
      style={{
        animation: closing
          ? "csdk-lightbox-backdrop-out 180ms ease-in forwards"
          : "csdk-lightbox-backdrop-in 200ms ease-out forwards",
      }}
    >
      {/* Scrim — hardcoded dark, no theme vars */}
      <div
        className="csdk-lightbox-scrim absolute inset-0"
        style={{
          backgroundColor: "rgba(0, 0, 0, 0.88)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          animation: closing
            ? "csdk-lightbox-fade-out 180ms ease-in forwards"
            : "csdk-lightbox-fade-in 200ms ease-out forwards",
        }}
      />

      {/* Image */}
      <div
        className="csdk-lightbox-content relative z-10 max-w-[90vw] max-h-[90vh]"
        style={{
          animation: closing
            ? "csdk-lightbox-img-out 180ms ease-in forwards"
            : "csdk-lightbox-img-in 220ms cubic-bezier(0.22, 1, 0.36, 1) forwards",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={src}
          alt={alt}
          className="csdk-lightbox-image max-w-full max-h-[90vh] object-contain rounded-xl"
          style={{ boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)" }}
          draggable={false}
        />
        {/* Close button */}
        <button
          type="button"
          className="csdk-lightbox-close absolute -top-3 -right-3 size-8 flex items-center justify-center rounded-full shadow-lg transition-[background,transform] duration-150 cursor-pointer active:scale-95"
          style={{ backgroundColor: "rgba(255,255,255,0.9)" }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "rgba(255,255,255,1)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.9)";
          }}
          onClick={handleClose}
        >
          <svg
            className="size-4"
            style={{ color: "#333" }}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        </button>
      </div>

      {/* Keyframe styles (injected once) */}
      <style>{`
        @keyframes csdk-lightbox-fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes csdk-lightbox-fade-out { from { opacity: 1; } to { opacity: 0; } }
        @keyframes csdk-lightbox-img-in { from { opacity: 0; transform: scale(0.92); } to { opacity: 1; transform: scale(1); } }
        @keyframes csdk-lightbox-img-out { from { opacity: 1; transform: scale(1); } to { opacity: 0; transform: scale(0.95); } }
        @keyframes csdk-lightbox-backdrop-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes csdk-lightbox-backdrop-out { from { opacity: 1; } to { opacity: 0; } }
      `}</style>
    </div>
  );

  // Portal to body
  return typeof document !== "undefined"
    ? ReactDOM.createPortal(portal, document.body)
    : null;
}

/**
 * Single image thumbnail — auto-sized, clickable, opens lightbox.
 * Preserves aspect ratio. Max width constrained by bubble, height auto.
 * active:scale-[0.98] for press feedback (physics-active-state).
 */
function ImageThumb({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  const [expanded, setExpanded] = React.useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className={cn(
          "csdk-attachment-image relative overflow-hidden cursor-zoom-in",
          "transition-[opacity,transform] duration-150 hover:opacity-90 active:scale-[0.98]",
          className,
        )}
        style={{ backgroundColor: "#000" }}
      >
        <img
          src={src}
          alt={alt}
          className="w-full h-full object-cover"
          loading="lazy"
          draggable={false}
        />
      </button>
      {expanded && (
        <ImageLightbox src={src} alt={alt} onClose={() => setExpanded(false)} />
      )}
    </>
  );
}

/**
 * File attachment card — compact, non-image files
 */
function FileCard({ attachment }: { attachment: MessageAttachment }) {
  const iconType =
    attachment.type === "audio"
      ? "audio"
      : attachment.type === "video"
        ? "video"
        : "file";
  const colors = {
    audio: "text-emerald-500 bg-emerald-500/10",
    video: "text-purple-500 bg-purple-500/10",
    file: "text-blue-500 bg-blue-500/10",
  };
  const icons = {
    audio: (
      <path d="M9 18V5l12-2v13M6 18a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM18 16a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
    ),
    video: (
      <>
        <path d="m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.934a.5.5 0 0 0-.777-.416L16 11" />
        <rect width="14" height="12" x="2" y="6" rx="2" />
      </>
    ),
    file: (
      <>
        <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
        <path d="M14 2v4a2 2 0 0 0 2 2h4" />
      </>
    ),
  };

  const href =
    attachment.url ||
    (attachment.data?.startsWith("data:") ? attachment.data : null);

  return (
    <div
      className={cn(
        "csdk-attachment-file flex items-center gap-2 rounded-lg border border-border/50 bg-muted/30 px-2.5 py-2 min-w-0 max-w-full",
      )}
    >
      <div
        className={cn(
          "size-8 rounded-md flex items-center justify-center shrink-0",
          colors[iconType],
        )}
      >
        <svg
          className="size-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {icons[iconType]}
        </svg>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium truncate">
          {attachment.filename || "Attachment"}
        </p>
        <p className="text-[10px] text-muted-foreground uppercase">
          {attachment.mimeType?.split("/")[1] || attachment.type}
        </p>
      </div>
      {href && (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          download={attachment.filename}
          className="shrink-0 text-muted-foreground/50 hover:text-foreground transition-colors"
        >
          <svg
            className="size-3.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" x2="12" y1="15" y2="3" />
          </svg>
        </a>
      )}
    </div>
  );
}

/**
 * Image grid — WhatsApp/Telegram-style layout
 * 1 image: full width
 * 2 images: side by side
 * 3 images: 2 top + 1 bottom
 * 4+ images: 2x2 grid with +N overlay
 */
function ImageGrid({
  images,
  bubbleRadius,
}: {
  images: MessageAttachment[];
  bubbleRadius?: string;
}) {
  const srcs = images
    .map((img) => getAttachmentSrc(img))
    .filter(Boolean) as string[];
  if (srcs.length === 0) return null;

  // Concentric radius: inner = outer bubble radius (16px) minus padding (2px) = 14px
  const innerRadius = bubbleRadius ? `calc(${bubbleRadius} - 2px)` : "0.875rem";

  if (srcs.length === 1) {
    return (
      <div
        className="csdk-attachment-grid"
        style={{ borderRadius: innerRadius, overflow: "hidden" }}
      >
        <ImageThumb
          src={srcs[0]}
          alt={images[0].filename || "Image"}
          className="w-full"
        />
      </div>
    );
  }

  if (srcs.length === 2) {
    return (
      <div
        className="csdk-attachment-grid grid grid-cols-2 gap-[2px]"
        style={{ borderRadius: innerRadius, overflow: "hidden" }}
      >
        {srcs.map((src, i) => (
          <ImageThumb
            key={i}
            src={src}
            alt={images[i].filename || "Image"}
            className="aspect-square"
          />
        ))}
      </div>
    );
  }

  if (srcs.length === 3) {
    return (
      <div
        className="csdk-attachment-grid grid grid-cols-2 gap-[2px]"
        style={{ borderRadius: innerRadius, overflow: "hidden" }}
      >
        <ImageThumb
          src={srcs[0]}
          alt={images[0].filename || "Image"}
          className="col-span-2 max-h-[180px] min-h-[100px]"
        />
        <ImageThumb
          src={srcs[1]}
          alt={images[1].filename || "Image"}
          className="aspect-square"
        />
        <ImageThumb
          src={srcs[2]}
          alt={images[2].filename || "Image"}
          className="aspect-square"
        />
      </div>
    );
  }

  // 4+ images: 2x2 grid, last cell shows +N if more
  const showOverlay = srcs.length > 4;
  const gridSrcs = srcs.slice(0, 4);

  return (
    <div
      className="csdk-attachment-grid grid grid-cols-2 gap-[2px]"
      style={{ borderRadius: innerRadius, overflow: "hidden" }}
    >
      {gridSrcs.map((src, i) => (
        <div key={i} className="relative aspect-square">
          <ImageThumb
            src={src}
            alt={images[i].filename || "Image"}
            className="w-full h-full"
          />
          {i === 3 && showOverlay && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center pointer-events-none">
              <span className="text-white text-lg font-semibold">
                +{srcs.length - 4}
              </span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/**
 * MessageMedia — renders attachments in a message bubble.
 * Handles image-only, image+text, file cards, and mixed content.
 *
 * Layout follows WhatsApp/Telegram pattern:
 * - Images at top of bubble (no padding), text below with padding
 * - Files shown as compact cards below text
 */
function MessageMedia({
  attachments,
  hasText,
  align = "end",
}: {
  attachments: MessageAttachment[];
  hasText: boolean;
  align?: "start" | "end";
}) {
  const images = attachments.filter((a) => a.type === "image");
  const files = attachments.filter((a) => a.type !== "image");

  return (
    <>
      {images.length > 0 && (
        <div className={cn("csdk-attachment-images", hasText ? "mb-0" : "")}>
          <ImageGrid images={images} bubbleRadius="0.5rem" />
        </div>
      )}
      {files.length > 0 && (
        <div
          className={cn(
            "csdk-attachment-files flex flex-col gap-1",
            hasText || images.length > 0 ? "px-3 pb-2 pt-1" : "p-1.5",
            align === "end" ? "items-end" : "items-start",
          )}
        >
          {files.map((file, i) => (
            <FileCard key={i} attachment={file} />
          ))}
        </div>
      )}
    </>
  );
}
