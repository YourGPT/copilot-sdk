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
export type { LinkSafetyConfig } from "./components/ui/markdown";
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

// Source primitives (for citations/references)
export {
  Source,
  SourceTrigger,
  SourceContent,
  SourceGroup,
  SimpleSource,
  type SourceProps,
  type SourceTriggerProps,
  type SourceContentProps,
  type SourceGroupProps,
  type SourceItem,
  type SimpleSourceProps,
} from "./components/ui/source";

// Search results primitives (for web search tool)
export {
  SearchResults,
  SearchAnswer,
  SearchResultsWithAnswer,
  type SearchResultsProps,
  type SearchAnswerProps,
  type SearchResultsWithAnswerProps,
} from "./components/ui/search-results";

// Citation components (for displaying sources/references)
export {
  // Components
  CitationBadge,
  CitationSuperscript,
  SourcePill,
  SourcesBar,
  SourcesCollapsible,
  SourcesList,
  MessageWithCitations,
  // Utilities
  annotationsToCitations,
  resultsToCitations,
  // Types
  type Citation,
  type CitationsConfig,
  type CitationBadgeProps,
  type CitationSuperscriptProps,
  type SourcePillProps,
  type SourcesBarProps,
  type SourcesCollapsibleProps,
  type SourcesListProps,
  type MessageWithCitationsProps,
} from "./components/ui/citations";

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

// Branch navigator (← N/M → variant navigation for branched conversations)
export {
  BranchNavigator,
  type BranchNavigatorProps,
} from "./components/ui/branch-navigator";

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

// Thread management components
export {
  ThreadPicker,
  type ThreadPickerProps,
} from "./components/ui/thread-picker";
export {
  ThreadList,
  ThreadCard,
  type ThreadListProps,
  type ThreadCardProps,
} from "./components/ui/thread-list";

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
  ChatWelcome,
  CopilotChat,
  ConnectedChat, // Alias for CopilotChat (backwards compatibility)
  ToolExecutionMessage,
  PoweredBy,
  // Compound component hook
  useCopilotChatContext,
  type ChatProps,
  type ChatMessage,
  type CopilotChatProps,
  type ConnectedChatProps, // Alias for CopilotChatProps
  type PoweredByProps,
  // Compound component types (layout composition)
  type HomeViewProps,
  type HomeProps,
  type ChatViewProps,
  type HeaderProps,
  type FooterProps,
  type BackButtonProps,
  type ThreadPickerCompoundProps,
  // Generative UI types (for custom tool renderers)
  type ToolRendererProps,
  type ToolRenderers,
  // Welcome screen config
  type WelcomeConfig,
  // Citation/Sources config (web search)
  type CitationConfig,
  // Persistence types
  type CopilotChatPersistenceConfig,
  type CopilotChatClassNames,
  // Typed persistence configs
  type LocalPersistenceConfig,
  type ServerPersistenceConfig,
  type CloudPersistenceConfig,
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
  ChevronLeftIcon,
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
// MCP-UI Components (Interactive UI from MCP tools)
// ============================================
export {
  MCPUIFrame,
  MCPUIFrameList,
  type MCPUIFrameListProps,
} from "./components/ui/mcp-ui-frame";
// MCPUIFrameProps is exported from mcp/ui module
export type { MCPUIFrameProps } from "../mcp/ui/types";

// ============================================
// Utilities
// ============================================
export { cn } from "./lib/utils";
