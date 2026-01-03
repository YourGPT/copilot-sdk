import React from "react";
import type { ToolExecutionData, ToolApprovalStatus } from "../tools";
import type { PermissionLevel } from "../../ui/permission-confirmation";
import type { ToolDefinition } from "../../../../core";

/**
 * Message attachment (images, files, etc.)
 *
 * Attachments can be stored as:
 * - Base64 data (free tier, embedded in message)
 * - URL (premium cloud storage, lighter payload)
 */
export type MessageAttachment = {
  /** Type of attachment */
  type: "image" | "file" | "audio" | "video";
  /** Base64 data (for embedded attachments) */
  data?: string;
  /** URL for cloud-stored attachments */
  url?: string;
  /** MIME type */
  mimeType: string;
  /** Optional filename */
  filename?: string;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  /** Thinking/reasoning content (for models with extended thinking) */
  thinking?: string;
  /** Tool executions associated with this message */
  toolExecutions?: ToolExecutionData[];
  /** Attachments (images, files) */
  attachments?: MessageAttachment[];
  /** Tool call ID - for tool result messages (links to assistant's tool_calls) */
  tool_call_id?: string;
  /** Tool calls made by assistant */
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: {
      name: string;
      arguments: string;
    };
  }>;
};

export type { ToolApprovalStatus, PermissionLevel };

// ============================================
// Generative UI - Tool Renderers
// ============================================

/**
 * Approval callbacks for custom tool renderers.
 * Only provided when approvalStatus is 'required'.
 */
export interface ToolApprovalCallbacks {
  /**
   * Approve execution with optional extra data.
   * The extraData is passed to the tool handler via context.approvalData.
   */
  onApprove: (extraData?: Record<string, unknown>) => void;
  /** Reject the execution with optional reason */
  onReject: (reason?: string) => void;
  /** Custom message from tool config */
  message?: string;
}

/**
 * Props passed to custom tool renderer components
 *
 * @example
 * ```tsx
 * import type { ToolRendererProps } from '@yourgpt/copilot-sdk-ui';
 *
 * function WeatherCard({ execution }: ToolRendererProps) {
 *   if (execution.status !== 'completed') {
 *     return <div>Loading...</div>;
 *   }
 *   const { city, temperature } = execution.result;
 *   return <div>{city}: {temperature}°</div>;
 * }
 *
 * // With approval callbacks for interactive tools
 * function EscalationCard({ execution, approval }: ToolRendererProps) {
 *   if (execution.approvalStatus === 'required' && approval) {
 *     return (
 *       <SelectionCard
 *         onSelect={(item) => approval.onApprove({ selectedItem: item })}
 *         onCancel={() => approval.onReject('Cancelled')}
 *       />
 *     );
 *   }
 *   // ... other states
 * }
 * ```
 */
export interface ToolRendererProps {
  execution: {
    /** Unique execution ID */
    id: string;
    /** Tool name (matches key in toolRenderers) */
    name: string;
    /** Arguments passed to the tool */
    args: Record<string, unknown>;
    /** Current execution status */
    status:
      | "pending"
      | "executing"
      | "completed"
      | "error"
      | "failed"
      | "rejected";
    /** Tool result (available when status is 'completed') */
    result?: unknown;
    /** Error message (available when status is 'error' or 'failed') */
    error?: string;
    /** Approval status for tools requiring confirmation */
    approvalStatus?: ToolApprovalStatus;
    /** Data passed from user's approval action */
    approvalData?: Record<string, unknown>;
  };
  /**
   * Approval callbacks - only provided when approvalStatus is 'required'.
   * Use these to create custom approval UIs.
   */
  approval?: ToolApprovalCallbacks;
}

/**
 * Map of tool names to their custom renderer components
 *
 * @example
 * ```tsx
 * const toolRenderers: ToolRenderers = {
 *   get_weather: WeatherCard,
 *   get_chart: ChartCard,
 * };
 * ```
 */
export type ToolRenderers = Record<
  string,
  React.ComponentType<ToolRendererProps>
>;

/**
 * Pending attachment (file being prepared to send)
 */
export type PendingAttachment = {
  /** Unique ID for this pending attachment */
  id: string;
  /** Original file object */
  file: File;
  /** Preview URL (blob URL for images) */
  previewUrl: string;
  /** Processed attachment data */
  attachment: MessageAttachment;
  /** Processing status */
  status: "processing" | "ready" | "error";
  /** Error message if status is error */
  error?: string;
};

export type ChatProps = {
  // === Core Props ===
  /** Messages to display */
  messages?: ChatMessage[];
  /** Called when user sends a message (with optional attachments) */
  onSendMessage?: (message: string, attachments?: MessageAttachment[]) => void;
  /** Called when user stops generation */
  onStop?: () => void;
  /** Whether AI is currently generating */
  isLoading?: boolean;

  // === Labels/Text ===
  /** Placeholder text for input */
  placeholder?: string;
  /** Custom welcome message when no messages */
  welcomeMessage?: React.ReactNode;
  /** Title shown in header (if showHeader is true) */
  title?: string;

  // === Header ===
  /** Show header bar with title and close button */
  showHeader?: boolean;
  /** Called when close button is clicked */
  onClose?: () => void;

  // === Appearance ===
  /** Show powered by footer (free tier) */
  showPoweredBy?: boolean;
  /** Show user avatar (default: false) */
  showUserAvatar?: boolean;
  /** User avatar config */
  userAvatar?: {
    src?: string;
    fallback?: string;
  };
  /** Assistant avatar config */
  assistantAvatar?: {
    src?: string;
    fallback?: string;
  };
  /** Loader variant for typing indicator */
  loaderVariant?: "circular" | "classic" | "dots" | "pulse" | "typing";
  /** Font size for messages: 'sm' (14px), 'base' (16px), 'lg' (18px) */
  fontSize?: "sm" | "base" | "lg";

  // === Attachments ===
  /** Maximum file size in bytes (default: 5MB) */
  maxFileSize?: number;
  /** Allowed file types (MIME types or wildcards like "image/*") */
  allowedFileTypes?: string[];
  /** Whether attachments are supported (shows/hides attach button) */
  attachmentsEnabled?: boolean;
  /** Tooltip text when attachments are disabled */
  attachmentsDisabledTooltip?: string;
  /**
   * Custom attachment processor (e.g., for cloud storage upload)
   * If provided, uses this instead of default base64 conversion.
   * @param file - The file to process
   * @returns Promise<MessageAttachment> - The processed attachment (URL-based or base64)
   */
  processAttachment?: (file: File) => Promise<MessageAttachment>;

  // === Suggestions ===
  /** Quick reply suggestions */
  suggestions?: string[];
  /** Called when a suggestion is clicked */
  onSuggestionClick?: (suggestion: string) => void;

  // === Follow-up Questions ===
  /**
   * Show AI-generated follow-up questions below the last message
   * AI should include them in format: [FOLLOWUP: Q1? | Q2? | Q3?]
   * @default true
   */
  showFollowUps?: boolean;
  /** Custom class for follow-up container */
  followUpClassName?: string;
  /** Custom class for follow-up buttons */
  followUpButtonClassName?: string;

  // === Tool Executions ===
  /** Whether waiting for server after tool completion (shows "Continuing..." loader) */
  isProcessing?: boolean;

  // === Generative UI ===
  /**
   * Registered tools for accessing tool's render function.
   * Passed automatically by CopilotChat from context.
   *
   * Priority: toolRenderers > tool.render > default ToolSteps
   */
  registeredTools?: ToolDefinition[];

  /**
   * Custom renderers for tool results (Generative UI)
   *
   * Map tool names to React components that render their results.
   * When a tool execution matches a key, the custom component is rendered
   * instead of tool's render function or default ToolSteps display.
   *
   * Higher priority than tool's built-in render function.
   *
   * @example
   * ```tsx
   * <Chat
   *   toolRenderers={{
   *     get_weather: WeatherCard,
   *     get_chart: ChartCard,
   *   }}
   * />
   * ```
   */
  toolRenderers?: ToolRenderers;

  // === Tool Approval (Human-in-the-loop) ===
  /**
   * Called when user approves a tool execution.
   * @param executionId - The tool execution ID
   * @param extraData - Optional data from user's action (e.g., selected item)
   * @param permissionLevel - Optional permission level for persistence
   */
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

  // === Custom Rendering ===
  /** Custom message renderer */
  renderMessage?: (message: ChatMessage, index: number) => React.ReactNode;
  /** Custom input renderer (replaces entire input area) */
  renderInput?: () => React.ReactNode;
  /** Custom header renderer (replaces entire header) */
  renderHeader?: () => React.ReactNode;

  // === Styling ===
  /** Class name for root container (use for sizing) */
  className?: string;
  /** Granular class names for sub-components */
  classNames?: {
    root?: string;
    header?: string;
    container?: string;
    messageList?: string;
    userMessage?: string;
    assistantMessage?: string;
    input?: string;
    suggestions?: string;
    footer?: string;
  };
};
