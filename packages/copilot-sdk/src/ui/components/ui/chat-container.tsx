"use client";

import { cn } from "../../lib/utils";
import {
  StickToBottom as StickToBottomOriginal,
  useStickToBottomContext,
} from "use-stick-to-bottom";

// Cast to fix React types version mismatch in monorepo
const StickToBottom = StickToBottomOriginal as unknown as React.FC<
  React.PropsWithChildren<{
    className?: string;
    resize?: string;
    initial?: string;
    role?: string;
  }>
> & { Content: React.FC<React.PropsWithChildren<{ className?: string }>> };

// Re-export the context hook for ScrollButton
function useChatContainer() {
  const context = useStickToBottomContext();
  return {
    isAtBottom: context.isAtBottom,
    scrollToBottom: context.scrollToBottom,
  };
}

export type ChatContainerRootProps = {
  children: React.ReactNode;
  className?: string;
} & React.HTMLAttributes<HTMLDivElement>;

export type ChatContainerContentProps = {
  children: React.ReactNode;
  className?: string;
} & React.HTMLAttributes<HTMLDivElement>;

export type ChatContainerScrollAnchorProps = {
  className?: string;
  ref?: React.RefObject<HTMLDivElement>;
} & React.HTMLAttributes<HTMLDivElement>;

function ChatContainerRoot({
  children,
  className,
  ...props
}: ChatContainerRootProps) {
  return (
    <StickToBottom
      className={cn("min-h-0", className)}
      resize="smooth"
      initial="instant"
      role="log"
      {...props}
    >
      {children}
    </StickToBottom>
  );
}

function ChatContainerContent({
  children,
  className,
  ...props
}: ChatContainerContentProps) {
  return (
    <StickToBottom.Content
      className={cn("flex w-full flex-col", className)}
      {...props}
    >
      {children}
    </StickToBottom.Content>
  );
}

function ChatContainerScrollAnchor({
  className,
  ...props
}: ChatContainerScrollAnchorProps) {
  return (
    <div
      className={cn("h-px w-full shrink-0 scroll-mt-4", className)}
      aria-hidden="true"
      {...props}
    />
  );
}

export {
  ChatContainerRoot,
  ChatContainerContent,
  ChatContainerScrollAnchor,
  useChatContainer,
};
