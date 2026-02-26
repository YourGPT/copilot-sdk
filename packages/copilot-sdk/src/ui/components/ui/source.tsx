"use client";

import { HoverCard, HoverCardContent, HoverCardTrigger } from "./hover-card";
import { cn } from "../../lib/utils";
import { createContext, useContext } from "react";

const SourceContext = createContext<{
  href: string;
  domain: string;
} | null>(null);

function useSourceContext() {
  const ctx = useContext(SourceContext);
  if (!ctx) throw new Error("Source.* must be used inside <Source>");
  return ctx;
}

export type SourceProps = {
  href: string;
  children: React.ReactNode;
};

export function Source({ href, children }: SourceProps) {
  let domain = "";
  try {
    domain = new URL(href).hostname;
  } catch {
    domain = href.split("/").pop() || href;
  }

  return (
    <SourceContext.Provider value={{ href, domain }}>
      <HoverCard openDelay={150} closeDelay={0}>
        {children}
      </HoverCard>
    </SourceContext.Provider>
  );
}

export type SourceTriggerProps = {
  label?: string | number;
  showFavicon?: boolean;
  className?: string;
};

export function SourceTrigger({
  label,
  showFavicon = false,
  className,
}: SourceTriggerProps) {
  const { href, domain } = useSourceContext();
  const labelToShow = label ?? domain.replace("www.", "");

  return (
    <HoverCardTrigger asChild>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          "inline-flex h-7 items-center gap-1.5 rounded-full border border-border/50 bg-background px-2.5 text-xs text-foreground/80 no-underline shadow-sm transition-all duration-150",
          "hover:bg-muted hover:border-border hover:shadow-md hover:text-foreground",
          className,
        )}
      >
        {showFavicon && (
          <img
            src={`https://www.google.com/s2/favicons?sz=64&domain_url=${encodeURIComponent(
              href,
            )}`}
            alt=""
            width={16}
            height={16}
            className="size-4 rounded-full"
          />
        )}
        <span className="truncate max-w-28 font-medium">{labelToShow}</span>
      </a>
    </HoverCardTrigger>
  );
}

export type SourceContentProps = {
  title: string;
  description: string;
  className?: string;
};

export function SourceContent({
  title,
  description,
  className,
}: SourceContentProps) {
  const { href, domain } = useSourceContext();

  return (
    <HoverCardContent
      className={cn("w-80 p-0 shadow-lg border border-border/50", className)}
      sideOffset={8}
    >
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="flex flex-col gap-2.5 p-4 hover:bg-muted/50 transition-colors rounded-lg"
      >
        <div className="flex items-center gap-2">
          <img
            src={`https://www.google.com/s2/favicons?sz=64&domain_url=${encodeURIComponent(
              href,
            )}`}
            alt=""
            className="size-5 rounded-full"
            width={20}
            height={20}
          />
          <div className="text-foreground/70 truncate text-sm">
            {domain.replace("www.", "")}
          </div>
        </div>
        <div className="line-clamp-2 text-sm font-semibold text-foreground">
          {title}
        </div>
        {description && (
          <div className="text-muted-foreground line-clamp-3 text-sm leading-relaxed">
            {description}
          </div>
        )}
      </a>
    </HoverCardContent>
  );
}

// ============================================
// SourceGroup - Multiple sources in a row
// ============================================

export type SourceItem = {
  href: string;
  title?: string;
  description?: string;
};

export type SourceGroupProps = {
  /** Array of sources to display */
  sources: SourceItem[];
  /** Label text (default: "Sources") */
  label?: string;
  /** Maximum sources to show before "+N more" */
  maxVisible?: number;
  /** Show favicon for each source */
  showFavicon?: boolean;
  /** Use numbered labels (1, 2, 3...) instead of domain */
  numbered?: boolean;
  /** Additional CSS classes */
  className?: string;
};

/**
 * Display a group of sources in a horizontal layout.
 * Each source shows a hover card with details on hover.
 *
 * @example
 * ```tsx
 * <SourceGroup
 *   sources={[
 *     { href: "https://example.com", title: "Example", description: "..." },
 *   ]}
 *   numbered
 *   showFavicon
 * />
 * ```
 */
export function SourceGroup({
  sources,
  label,
  maxVisible = 5,
  showFavicon = true,
  numbered = false,
  className,
}: SourceGroupProps) {
  if (!sources || sources.length === 0) return null;

  const visibleSources = sources.slice(0, maxVisible);
  const hiddenCount = sources.length - maxVisible;

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {label && (
        <span className="text-muted-foreground text-xs font-medium">
          {label}
        </span>
      )}
      {visibleSources.map((source, index) => (
        <Source key={index} href={source.href}>
          <SourceTrigger
            label={numbered ? index + 1 : undefined}
            showFavicon={showFavicon}
          />
          {(source.title || source.description) && (
            <SourceContent
              title={source.title || getDomain(source.href)}
              description={source.description || source.href}
            />
          )}
        </Source>
      ))}
      {hiddenCount > 0 && (
        <span className="text-muted-foreground text-xs font-medium bg-muted px-2 py-1 rounded-full">
          +{hiddenCount} more
        </span>
      )}
    </div>
  );
}

// ============================================
// SimpleSource - Standalone source badge (no hover)
// ============================================

export type SimpleSourceProps = {
  /** Source URL */
  href: string;
  /** Label (number or text) */
  label?: string | number;
  /** Show favicon */
  showFavicon?: boolean;
  /** Additional CSS classes */
  className?: string;
};

/**
 * Simple source badge without hover card.
 * Use for inline citations like [1], [2], etc.
 */
export function SimpleSource({
  href,
  label,
  showFavicon = false,
  className,
}: SimpleSourceProps) {
  let domain = "";
  try {
    domain = new URL(href).hostname.replace("www.", "");
  } catch {
    domain = href;
  }

  const displayLabel = label ?? domain;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "bg-muted text-muted-foreground hover:bg-primary/20 hover:text-primary",
        "inline-flex h-5 items-center gap-1 rounded-full text-xs no-underline transition-colors",
        showFavicon ? "pr-2 pl-1" : "px-1.5",
        className,
      )}
    >
      {showFavicon && (
        <img
          src={`https://www.google.com/s2/favicons?sz=64&domain_url=${encodeURIComponent(href)}`}
          alt=""
          width={14}
          height={14}
          className="size-3.5 rounded-full"
        />
      )}
      <span className="truncate tabular-nums font-normal">{displayLabel}</span>
    </a>
  );
}

// ============================================
// Utility Functions
// ============================================

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace("www.", "");
  } catch {
    return url;
  }
}
