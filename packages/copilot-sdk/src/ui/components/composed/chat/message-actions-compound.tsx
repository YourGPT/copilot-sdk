"use client";

import React, {
  useLayoutEffect,
  useMemo,
  createContext,
  useContext,
} from "react";
import {
  useMessageActionsContext,
  type RegisteredAction,
} from "./message-actions-context";
import type { ChatMessage } from "./types";

// ─── Role sub-context ────────────────────────────────────────────────────────

const RoleContext = createContext<"user" | "assistant" | null>(null);

// ─── Built-in action icons ────────────────────────────────────────────────────

function CopyIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

function EditIcon() {
  return (
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
  );
}

function ThumbsUpIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M7 10v12" />
      <path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z" />
    </svg>
  );
}

function ThumbsDownIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M17 14V2" />
      <path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22a3.13 3.13 0 0 1-3-3.88Z" />
    </svg>
  );
}

// ─── CopyAction ───────────────────────────────────────────────────────────────

export interface CopyActionProps {
  tooltip?: string;
  className?: string;
}

/** Built-in copy-to-clipboard action. Use inside CopilotChat.MessageActions. */
export function CopyAction({ tooltip = "Copy", className }: CopyActionProps) {
  return null; // declarative marker — rendered by MessageActions
}
CopyAction.displayName = "CopyAction";

// ─── EditAction ───────────────────────────────────────────────────────────────

export interface EditActionProps {
  tooltip?: string;
  className?: string;
}

/** Built-in edit action for user messages. Use inside CopilotChat.MessageActions role="user". */
export function EditAction({ tooltip = "Edit", className }: EditActionProps) {
  return null;
}
EditAction.displayName = "EditAction";

// ─── FeedbackAction ───────────────────────────────────────────────────────────

export interface FeedbackActionProps {
  onFeedback?: (message: ChatMessage, type: "helpful" | "not-helpful") => void;
  tooltip?: string;
  className?: string;
}

/** Built-in thumbs up/down feedback action. Use inside CopilotChat.MessageActions. */
export function FeedbackAction({
  onFeedback,
  tooltip = "Feedback",
  className,
}: FeedbackActionProps) {
  return null;
}
FeedbackAction.displayName = "FeedbackAction";

// ─── Action ───────────────────────────────────────────────────────────────────

export interface ActionProps {
  id?: string;
  icon: React.ReactNode;
  tooltip: string;
  onClick: (props: { message: ChatMessage }) => void;
  hidden?: boolean | ((props: { message: ChatMessage }) => boolean);
  className?: string;
}

/** Custom action button. Use inside CopilotChat.MessageActions. */
export function Action({
  icon,
  tooltip,
  onClick,
  hidden,
  className,
}: ActionProps) {
  return null;
}
Action.displayName = "Action";

// ─── MessageActions ───────────────────────────────────────────────────────────

export interface MessageActionsProps {
  role: "user" | "assistant";
  children?: React.ReactNode;
}

/**
 * Registers message actions for a specific role.
 * Place inside <CopilotChat> as a direct child.
 *
 * @example
 * ```tsx
 * <CopilotChat>
 *   <CopilotChat.MessageActions role="assistant">
 *     <CopilotChat.CopyAction />
 *     <CopilotChat.FeedbackAction onFeedback={(msg, type) => log(type)} />
 *     <CopilotChat.Action icon={<ShareIcon />} tooltip="Share" onClick={({ message }) => share(message)} />
 *   </CopilotChat.MessageActions>
 *
 *   <CopilotChat.MessageActions role="user">
 *     <CopilotChat.EditAction />
 *   </CopilotChat.MessageActions>
 * </CopilotChat>
 * ```
 */
export function MessageActions({ role, children }: MessageActionsProps) {
  const ctx = useMessageActionsContext();

  // Extract action definitions from declarative children
  const actions = useMemo<RegisteredAction[]>(() => {
    const result: RegisteredAction[] = [];

    React.Children.forEach(children, (child) => {
      if (!React.isValidElement(child)) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const props = child.props as any;
      const type = child.type;

      if (
        type === CopyAction ||
        (child.type as { displayName?: string })?.displayName === "CopyAction"
      ) {
        // Copy — stateful, rendered specially in DefaultMessage
        result.push({
          id: "copy",
          icon: <CopyIcon />,
          tooltip: props.tooltip ?? "Copy",
          onClick: ({ message }) => {
            navigator.clipboard.writeText(message.content ?? "");
          },
          className: props.className,
        });
      } else if (
        type === EditAction ||
        (child.type as { displayName?: string })?.displayName === "EditAction"
      ) {
        result.push({
          id: "edit",
          icon: <EditIcon />,
          tooltip: props.tooltip ?? "Edit",
          onClick: () => {}, // handled internally by DefaultMessage via onEditMessage
          className: props.className,
        });
      } else if (
        type === FeedbackAction ||
        (child.type as { displayName?: string })?.displayName ===
          "FeedbackAction"
      ) {
        const onFeedback = props.onFeedback;
        result.push(
          {
            id: "feedback-up",
            icon: <ThumbsUpIcon />,
            tooltip: "Helpful",
            onClick: ({ message }) => onFeedback?.(message, "helpful"),
            className: props.className,
          },
          {
            id: "feedback-down",
            icon: <ThumbsDownIcon />,
            tooltip: "Not helpful",
            onClick: ({ message }) => onFeedback?.(message, "not-helpful"),
            className: props.className,
          },
        );
      } else if (
        type === Action ||
        (child.type as { displayName?: string })?.displayName === "Action"
      ) {
        result.push({
          id: props.id ?? props.tooltip,
          icon: props.icon,
          tooltip: props.tooltip,
          onClick: props.onClick,
          hidden: props.hidden,
          className: props.className,
        });
      }
    });

    return result;
  }, [children]);

  useLayoutEffect(() => {
    if (!ctx) return;
    ctx.registerActions(role, actions);
    return () => ctx.clearActions(role);
  }, [ctx, role, actions]);

  return null;
}

// Re-export CheckIcon for DefaultMessage copy state
export { CopyIcon, CheckIcon, EditIcon };
