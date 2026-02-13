import { Avatar, AvatarFallback, AvatarImage } from "./avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./tooltip";
import { cn } from "../../lib/utils";
import { Markdown } from "./markdown";

export type MessageProps = {
  children: React.ReactNode;
  className?: string;
} & React.HTMLProps<HTMLDivElement>;

const Message = ({ children, className, ...props }: MessageProps) => (
  <div className={cn("csdk-message flex gap-3", className)} {...props}>
    {children}
  </div>
);

export type MessageAvatarProps = {
  /** Image source URL */
  src?: string;
  /** Alt text for the image */
  alt?: string;
  /** Text fallback (e.g. "AI") */
  fallback?: string;
  /** Icon/component fallback (takes precedence over text fallback when src is empty) */
  fallbackIcon?: React.ReactNode;
  /** Custom avatar component - when provided, replaces the default avatar */
  children?: React.ReactNode;
  delayMs?: number;
  className?: string;
};

const MessageAvatar = ({
  src,
  alt = "Avatar",
  fallback,
  fallbackIcon,
  children,
  delayMs,
  className,
}: MessageAvatarProps) => {
  // If custom children provided, render them in a wrapper with proper sizing
  if (children) {
    return (
      <span className={cn("csdk-avatar flex shrink-0 size-7", className)}>
        {children}
      </span>
    );
  }

  return (
    <Avatar className={cn("csdk-avatar size-7 shrink-0", className)}>
      <AvatarImage src={src} alt={alt} />
      <AvatarFallback delayMs={delayMs}>
        {fallbackIcon || fallback}
      </AvatarFallback>
    </Avatar>
  );
};

export type MessageContentProps = {
  children: React.ReactNode;
  markdown?: boolean;
  className?: string;
  /** Font size variant: 'sm' (14px), 'base' (16px), 'lg' (18px) */
  size?: "sm" | "base" | "lg";
} & React.ComponentProps<typeof Markdown> &
  Omit<React.HTMLProps<HTMLDivElement>, "size">;

const textSizeMap = {
  sm: "text-sm",
  base: "text-base",
  lg: "text-lg",
};

const MessageContent = ({
  children,
  markdown = false,
  className,
  size = "sm",
  ...props
}: MessageContentProps) => {
  const classNames = cn(
    "csdk-message-content rounded-lg p-2 break-words whitespace-normal max-w-full leading-relaxed overflow-hidden",
    // Typography - simple Tailwind utilities (no prose)
    "[&_p]:my-1 [&_p]:leading-relaxed",
    "[&_ul]:my-1 [&_ul]:pl-4 [&_ul]:list-disc [&_ul]:list-outside",
    "[&_ol]:my-1 [&_ol]:pl-4 [&_ol]:list-decimal [&_ol]:list-outside",
    "[&_li]:my-0.5 [&_li]:pl-0",
    "[&_pre]:my-2 [&_blockquote]:my-2 [&_blockquote]:pl-3 [&_blockquote]:border-l-2 [&_blockquote]:border-current/30",
    "[&_code]:bg-current/10 [&_code]:px-1 [&_code]:rounded [&_code]:text-[0.9em]",
    "[&_a]:underline [&_a]:!text-blue-600 dark:[&_a]:!text-blue-400 [&_a]:break-all",
    "[&_button[data-streamdown='link']]:underline [&_button[data-streamdown='link']]:!text-blue-600 dark:[&_button[data-streamdown='link']]:!text-blue-400 [&_button[data-streamdown='link']]:break-all [&_button[data-streamdown='link']]:font-medium",
    "[&_.text-primary]:!text-blue-600 dark:[&_.text-primary]:!text-blue-400",
    "[&_strong]:font-semibold",
    textSizeMap[size],
    className,
  );

  return markdown ? (
    <Markdown className={classNames} {...props}>
      {children as string}
    </Markdown>
  ) : (
    <div className={classNames} {...props}>
      {children}
    </div>
  );
};

export type MessageActionsProps = {
  children: React.ReactNode;
  className?: string;
} & React.HTMLProps<HTMLDivElement>;

const MessageActions = ({
  children,
  className,
  ...props
}: MessageActionsProps) => (
  <div
    className={cn(
      "csdk-message-actions text-muted-foreground flex items-center gap-2",
      className,
    )}
    {...props}
  >
    {children}
  </div>
);

export type MessageActionProps = {
  className?: string;
  tooltip: React.ReactNode;
  children: React.ReactNode;
  side?: "top" | "bottom" | "left" | "right";
} & React.ComponentProps<typeof Tooltip>;

const MessageAction = ({
  tooltip,
  children,
  className,
  side = "top",
  ...props
}: MessageActionProps) => {
  return (
    <TooltipProvider>
      <Tooltip {...props}>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent side={side} className={className}>
          {tooltip}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export {
  Message,
  MessageAvatar,
  MessageContent,
  MessageActions,
  MessageAction,
};
