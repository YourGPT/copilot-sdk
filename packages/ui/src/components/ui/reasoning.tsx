"use client";

import * as React from "react";
import { cn } from "../../lib/utils";
import { Markdown } from "./markdown";

// ============================================
// Context for Reasoning state
// ============================================

interface ReasoningContextValue {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  isStreaming: boolean;
}

const ReasoningContext = React.createContext<ReasoningContextValue | null>(
  null,
);

function useReasoningContext() {
  const context = React.useContext(ReasoningContext);
  if (!context) {
    throw new Error(
      "Reasoning components must be used within a Reasoning provider",
    );
  }
  return context;
}

// ============================================
// Reasoning Root
// ============================================

export interface ReasoningProps {
  children: React.ReactNode;
  /** Whether content is currently streaming */
  isStreaming?: boolean;
  /** Controlled open state */
  open?: boolean;
  /** Callback when open state changes */
  onOpenChange?: (open: boolean) => void;
  /** Default open state (uncontrolled) */
  defaultOpen?: boolean;
  /** Class name for the container */
  className?: string;
}

/**
 * Reasoning component - Collapsible container for AI thinking/reasoning content
 *
 * Auto-expands during streaming and collapses when complete.
 *
 * @example
 * ```tsx
 * <Reasoning isStreaming={isStreaming}>
 *   <ReasoningTrigger>Thinking...</ReasoningTrigger>
 *   <ReasoningContent>{thinkingText}</ReasoningContent>
 * </Reasoning>
 * ```
 */
export function Reasoning({
  children,
  isStreaming = false,
  open: controlledOpen,
  onOpenChange,
  defaultOpen = false,
  className,
}: ReasoningProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen);
  const prevStreamingRef = React.useRef(isStreaming);

  // Determine if controlled or uncontrolled
  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : uncontrolledOpen;

  const setIsOpen = React.useCallback(
    (open: boolean) => {
      if (onOpenChange) {
        onOpenChange(open);
      }
      if (!isControlled) {
        setUncontrolledOpen(open);
      }
    },
    [isControlled, onOpenChange],
  );

  // Auto-expand when streaming starts, auto-collapse when streaming ends
  React.useEffect(() => {
    if (isStreaming && !prevStreamingRef.current) {
      // Streaming just started - expand
      setIsOpen(true);
    } else if (!isStreaming && prevStreamingRef.current) {
      // Streaming just ended - collapse
      setIsOpen(false);
    }
    prevStreamingRef.current = isStreaming;
  }, [isStreaming, setIsOpen]);

  return (
    <ReasoningContext.Provider value={{ isOpen, setIsOpen, isStreaming }}>
      <div className={cn("reasoning", className)}>{children}</div>
    </ReasoningContext.Provider>
  );
}

// ============================================
// Reasoning Trigger
// ============================================

export interface ReasoningTriggerProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Clickable trigger to expand/collapse reasoning content
 */
export function ReasoningTrigger({
  children,
  className,
}: ReasoningTriggerProps) {
  const { isOpen, setIsOpen, isStreaming } = useReasoningContext();

  return (
    <button
      type="button"
      onClick={() => setIsOpen(!isOpen)}
      className={cn(
        "flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors",
        "py-1 px-0 bg-transparent border-none cursor-pointer",
        className,
      )}
      aria-expanded={isOpen}
    >
      {/* Chevron icon */}
      <svg
        className={cn(
          "size-3 transition-transform duration-200",
          isOpen && "rotate-90",
        )}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      </svg>

      {/* Streaming indicator */}
      {isStreaming && (
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
        </span>
      )}

      {children}
    </button>
  );
}

// ============================================
// Reasoning Content
// ============================================

export interface ReasoningContentProps {
  children: React.ReactNode;
  /** Render content as markdown */
  markdown?: boolean;
  /** Class name for the content */
  className?: string;
}

/**
 * Collapsible content area for reasoning text
 */
export function ReasoningContent({
  children,
  markdown = false,
  className,
}: ReasoningContentProps) {
  const { isOpen } = useReasoningContext();
  const contentRef = React.useRef<HTMLDivElement>(null);
  const [height, setHeight] = React.useState<number | undefined>(0);

  // Measure content height for smooth animation
  React.useEffect(() => {
    if (contentRef.current) {
      const resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          setHeight(entry.contentRect.height);
        }
      });
      resizeObserver.observe(contentRef.current);
      return () => resizeObserver.disconnect();
    }
  }, []);

  return (
    <div
      className={cn(
        "overflow-hidden transition-[max-height] duration-200 ease-out",
        isOpen ? "opacity-100" : "opacity-0",
      )}
      style={{ maxHeight: isOpen ? height : 0 }}
      aria-hidden={!isOpen}
    >
      <div
        ref={contentRef}
        className={cn(
          "mt-1 pl-3 border-l-2 border-muted-foreground/20",
          "text-xs text-muted-foreground",
          className,
        )}
      >
        {markdown && typeof children === "string" ? (
          <Markdown className="prose-xs">{children}</Markdown>
        ) : (
          <div className="whitespace-pre-wrap">{children}</div>
        )}
      </div>
    </div>
  );
}

// ============================================
// Convenience component for simple usage
// ============================================

export interface SimpleReasoningProps {
  /** The reasoning/thinking content */
  content: string;
  /** Whether content is streaming */
  isStreaming?: boolean;
  /** Label when streaming */
  streamingLabel?: string;
  /** Label when collapsed */
  collapsedLabel?: string;
  /** Render as markdown */
  markdown?: boolean;
  /** Class name */
  className?: string;
}

/**
 * Simple reasoning display with default trigger labels
 *
 * @example
 * ```tsx
 * <SimpleReasoning
 *   content={message.thinking}
 *   isStreaming={isLoading}
 * />
 * ```
 */
export function SimpleReasoning({
  content,
  isStreaming = false,
  streamingLabel = "Thinking...",
  collapsedLabel = "View reasoning",
  markdown = true,
  className,
}: SimpleReasoningProps) {
  if (!content) return null;

  return (
    <Reasoning isStreaming={isStreaming} className={className}>
      <ReasoningTrigger>
        {isStreaming ? streamingLabel : collapsedLabel}
      </ReasoningTrigger>
      <ReasoningContent markdown={markdown}>{content}</ReasoningContent>
    </Reasoning>
  );
}
