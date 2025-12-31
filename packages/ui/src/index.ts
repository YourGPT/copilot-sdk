/**
 * @yourgpt/copilot-sdk-ui
 *
 * Pre-built UI components for Copilot SDK
 */

// ============================================
// Primitives (Building Blocks)
// ============================================
export { Loader } from "./components/ui/loader";
export { Markdown } from "./components/ui/markdown";
export { CodeBlock } from "./components/ui/code-block";
export { Button } from "./components/ui/button";
export { FeedbackBar } from "./components/ui/feedback-bar";
export { ScrollButton } from "./components/ui/scroll-button";
export {
  Tooltip,
  TooltipProvider,
  TooltipTrigger,
  TooltipContent,
  type TooltipProps,
  type TooltipProviderProps,
  type TooltipTriggerProps,
  type TooltipContentProps,
} from "./components/ui/tooltip";

// Message primitives
export {
  Message as MessagePrimitive,
  MessageAvatar,
  MessageContent,
} from "./components/ui/message";

// Input primitives
export {
  PromptInput,
  PromptInputTextarea,
  PromptInputActions,
  PromptInputAction,
} from "./components/ui/prompt-input";

// Container primitives
export {
  ChatContainerRoot,
  ChatContainerContent,
  ChatContainerScrollAnchor,
  useChatContainer,
} from "./components/ui/chat-container";

// Source primitives
export { Source, SourceContent, SourceTrigger } from "./components/ui/source";

// Reasoning primitives
export {
  Reasoning,
  ReasoningTrigger,
  ReasoningContent,
  SimpleReasoning,
  type ReasoningProps,
  type ReasoningTriggerProps,
  type ReasoningContentProps,
  type SimpleReasoningProps,
} from "./components/ui/reasoning";

// Tool steps primitives
export {
  ToolSteps,
  ToolStep,
  InlineToolSteps,
  type ToolStepsProps,
  type ToolStepProps,
  type InlineToolStepsProps,
  type ToolStepData,
  type ToolStepStatus,
} from "./components/ui/tool-steps";

// Confirmation primitives (Tool approval)
export {
  Confirmation,
  ConfirmationPending,
  ConfirmationApproved,
  ConfirmationRejected,
  ConfirmationMessage,
  ConfirmationActions,
  SimpleConfirmation,
  type ConfirmationProps,
  type ConfirmationState,
  type ConfirmationPendingProps,
  type ConfirmationApprovedProps,
  type ConfirmationRejectedProps,
  type ConfirmationMessageProps,
  type ConfirmationActionsProps,
  type SimpleConfirmationProps,
} from "./components/ui/confirmation";

// Permission confirmation primitives (with "don't ask again" support)
export {
  PermissionConfirmation,
  CompactPermissionConfirmation,
  DEFAULT_PERMISSION_OPTIONS,
  type PermissionConfirmationProps,
  type CompactPermissionConfirmationProps,
  type PermissionLevel,
  type PermissionOption,
} from "./components/ui/permission-confirmation";

// Follow-up questions (AI-generated suggestions)
export {
  FollowUpQuestions,
  parseFollowUps,
  type FollowUpProps,
} from "./components/ui/follow-up";

// DevLogger (Development debugging tool)
export {
  DevLogger,
  type DevLoggerProps,
  type DevLoggerState,
} from "./components/ui/dev-logger";

// Capability badges (Multi-provider support)
export {
  CapabilityBadge,
  CapabilityList,
  type CapabilityBadgeProps,
  type CapabilityListProps,
  type CapabilityType,
} from "./components/ui/capability-badge";

// Model selector (Multi-provider support)
export {
  ModelSelector,
  SimpleModelSelector,
  type ModelSelectorProps,
  type SimpleModelSelectorProps,
  type ModelOption,
  type ProviderGroup,
} from "./components/ui/model-selector";

// ============================================
// Context Providers
// ============================================
export {
  CopilotUIProvider,
  useCopilotUI,
  type CopilotUIConfig,
  type CopilotUIContextValue,
  type CopilotUIProviderProps,
} from "./context/copilot-ui-context";

// ============================================
// Composed Components (Ready-to-use)
// ============================================
export {
  Chat,
  CopilotChat,
  ConnectedChat, // Alias for CopilotChat (backwards compatibility)
  ToolExecutionMessage,
  PoweredBy,
  type ChatProps,
  type ChatMessage,
  type CopilotChatProps,
  type ConnectedChatProps, // Alias for CopilotChatProps
  type PoweredByProps,
  // Generative UI types (for custom tool renderers)
  type ToolRendererProps,
  type ToolRenderers,
} from "./components/composed";

// ============================================
// Icons
// ============================================
export {
  SendIcon,
  StopIcon,
  CloseIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  CopyIcon,
  CheckIcon,
  ThumbsUpIcon,
  ThumbsDownIcon,
  RefreshIcon,
  UserIcon,
  BotIcon,
  XIcon,
  AlertTriangleIcon,
} from "./components/icons";

// ============================================
// Utilities
// ============================================
export { cn } from "./lib/utils";
