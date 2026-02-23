export {
  Chat,
  ChatHeader,
  ChatWelcome,
  Suggestions,
  DefaultMessage,
  ToolExecutionMessage,
  // Compound component hook
  useCopilotChatContext,
  // Compound component types
  type HomeViewProps,
  type HomeProps,
  type ChatViewProps,
  type HeaderProps,
  type FooterProps,
  type BackButtonProps,
  type ThreadPickerCompoundProps,
  type ChatProps,
  type ChatMessage,
  type CitationConfig,
  type ToolRendererProps,
  type ToolRenderers,
  type WelcomeConfig,
} from "./chat";
export {
  CopilotChat,
  ConnectedChat,
  type CopilotChatProps,
  type ConnectedChatProps,
  type CopilotChatPersistenceConfig,
  type CopilotChatClassNames,
  type CopilotChatHeaderConfig,
  // New typed persistence configs
  type LocalPersistenceConfig,
  type ServerPersistenceConfig,
  type CloudPersistenceConfig,
} from "./connected-chat";
export { PoweredBy, type PoweredByProps } from "./powered-by";

// Tool execution components
export {
  ToolExecutionList,
  LoopProgress,
  LoopProgressBadge,
  type ToolExecutionListProps,
  type ToolExecutionData,
  type ToolExecutionStatus,
  type LoopProgressProps,
  type LoopProgressBadgeProps,
} from "./tools";
