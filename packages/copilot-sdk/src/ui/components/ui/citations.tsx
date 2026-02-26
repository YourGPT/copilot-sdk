"use client";

import * as React from "react";
import { cn } from "../../lib/utils";
import { ChevronDown, ChevronUp, ExternalLink, Globe } from "lucide-react";

// ============================================
// Types
// ============================================

export interface Citation {
  /** Citation number (1-based) */
  index: number;
  /** Source URL */
  url: string;
  /** Source title */
  title: string;
  /** Domain name */
  domain?: string;
  /** Favicon URL */
  favicon?: string;
}

export interface CitationsConfig {
  /** Show citations (default: true) */
  enabled?: boolean;
  /** Citation style */
  style?: "badges" | "numbered" | "superscript";
  /** Where to show sources */
  sourcesPosition?: "bottom" | "inline" | "collapsible";
  /** Max sources to show initially */
  maxVisible?: number;
}

// ============================================
// CitationBadge - Inline numbered reference [1]
// ============================================

export interface CitationBadgeProps {
  /** Citation number */
  index: number;
  /** Source URL for linking */
  url?: string;
  /** Hover tooltip */
  title?: string;
  /** Size variant */
  size?: "sm" | "md";
  /** Additional CSS classes */
  className?: string;
  /** Click handler */
  onClick?: () => void;
}

/**
 * Inline citation badge like [1], [2], etc.
 * Similar to Perplexity and ChatGPT citation style.
 *
 * @example
 * ```tsx
 * <CitationBadge index={1} url="https://example.com" title="Source" />
 * ```
 */
export function CitationBadge({
  index,
  url,
  title,
  size = "sm",
  className,
  onClick,
}: CitationBadgeProps) {
  const sizeClasses = {
    sm: "text-[10px] min-w-[16px] h-4 px-1",
    md: "text-xs min-w-[20px] h-5 px-1.5",
  };

  const badge = (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded font-medium",
        "bg-primary/10 text-primary hover:bg-primary/20",
        "cursor-pointer transition-colors",
        sizeClasses[size],
        className,
      )}
      title={title}
      onClick={onClick}
    >
      {index}
    </span>
  );

  if (url) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex"
      >
        {badge}
      </a>
    );
  }

  return badge;
}

// ============================================
// CitationSuperscript - Superscript style [1]
// ============================================

export interface CitationSuperscriptProps {
  index: number;
  url?: string;
  title?: string;
  className?: string;
}

/**
 * Superscript citation like academic papers.
 */
export function CitationSuperscript({
  index,
  url,
  title,
  className,
}: CitationSuperscriptProps) {
  const sup = (
    <sup
      className={cn(
        "text-[10px] text-primary hover:underline cursor-pointer ml-0.5",
        className,
      )}
      title={title}
    >
      [{index}]
    </sup>
  );

  if (url) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer">
        {sup}
      </a>
    );
  }

  return sup;
}

// ============================================
// SourcePill - Compact source chip
// ============================================

export interface SourcePillProps {
  /** Citation data */
  citation: Citation;
  /** Show index number */
  showIndex?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Compact source pill with favicon and domain.
 * Used in horizontal source bars.
 */
export function SourcePill({
  citation,
  showIndex = true,
  className,
}: SourcePillProps) {
  const domain = citation.domain || getDomain(citation.url);
  const favicon = citation.favicon || getFaviconUrl(citation.url);

  return (
    <a
      href={citation.url}
      target="_blank"
      rel="noopener noreferrer"
      title={citation.title}
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-1 text-xs rounded-full",
        "bg-muted hover:bg-muted/80 transition-colors",
        "text-muted-foreground hover:text-foreground",
        className,
      )}
    >
      {showIndex && (
        <span className="text-[10px] font-medium text-primary">
          {citation.index}
        </span>
      )}
      <img
        src={favicon}
        alt=""
        className="w-3.5 h-3.5 rounded-sm"
        width={14}
        height={14}
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = "none";
        }}
      />
      <span className="truncate max-w-[100px]">{domain}</span>
    </a>
  );
}

// ============================================
// SourcesBar - Horizontal scrollable sources
// ============================================

export interface SourcesBarProps {
  /** List of citations */
  citations: Citation[];
  /** Label text (default: "Sources") */
  label?: string;
  /** Max sources to show */
  maxVisible?: number;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Horizontal bar of source pills.
 * Similar to Perplexity's sources section.
 *
 * @example
 * ```tsx
 * <SourcesBar
 *   citations={[
 *     { index: 1, url: "https://...", title: "Source 1" },
 *     { index: 2, url: "https://...", title: "Source 2" },
 *   ]}
 * />
 * ```
 */
export function SourcesBar({
  citations,
  label = "Sources",
  maxVisible = 5,
  className,
}: SourcesBarProps) {
  const visibleCitations = citations.slice(0, maxVisible);
  const hiddenCount = citations.length - maxVisible;

  if (citations.length === 0) return null;

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span className="text-xs text-muted-foreground flex items-center gap-1">
        <Globe className="w-3 h-3" />
        {label}
      </span>
      <div className="flex items-center gap-1.5 overflow-x-auto">
        {visibleCitations.map((citation) => (
          <SourcePill key={citation.index} citation={citation} />
        ))}
        {hiddenCount > 0 && (
          <span className="text-xs text-muted-foreground px-2">
            +{hiddenCount} more
          </span>
        )}
      </div>
    </div>
  );
}

// ============================================
// SourcesCollapsible - Expandable sources
// ============================================

export interface SourcesCollapsibleProps {
  /** List of citations */
  citations: Citation[];
  /** Label text (default: "Sources") */
  label?: string;
  /** Start expanded (default: false) */
  defaultExpanded?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Collapsible sources section that expands to show full list.
 *
 * @example
 * ```tsx
 * <SourcesCollapsible
 *   citations={citations}
 *   defaultExpanded={false}
 * />
 * ```
 */
export function SourcesCollapsible({
  citations,
  label = "Sources",
  defaultExpanded = false,
  className,
}: SourcesCollapsibleProps) {
  const [expanded, setExpanded] = React.useState(defaultExpanded);

  if (citations.length === 0) return null;

  return (
    <div className={cn("border rounded-lg", className)}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-muted/50 transition-colors"
      >
        <span className="flex items-center gap-2 text-muted-foreground">
          <Globe className="w-4 h-4" />
          {label} ({citations.length})
        </span>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        )}
      </button>
      {expanded && (
        <div className="px-3 pb-3 space-y-2">
          {citations.map((citation) => (
            <SourceItem key={citation.index} citation={citation} />
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================
// SourceItem - Full source row
// ============================================

interface SourceItemProps {
  citation: Citation;
}

function SourceItem({ citation }: SourceItemProps) {
  const domain = citation.domain || getDomain(citation.url);
  const favicon = citation.favicon || getFaviconUrl(citation.url);

  return (
    <a
      href={citation.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-start gap-3 p-2 rounded-md hover:bg-muted/50 transition-colors group"
    >
      <span className="flex items-center justify-center w-5 h-5 rounded bg-primary/10 text-primary text-xs font-medium flex-shrink-0">
        {citation.index}
      </span>
      <img
        src={favicon}
        alt=""
        className="w-4 h-4 mt-0.5 rounded-sm flex-shrink-0"
        width={16}
        height={16}
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = "none";
        }}
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium group-hover:text-primary truncate">
          {citation.title}
        </p>
        <p className="text-xs text-muted-foreground truncate">{domain}</p>
      </div>
      <ExternalLink className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
    </a>
  );
}

// ============================================
// SourcesList - Simple numbered list
// ============================================

export interface SourcesListProps {
  /** List of citations */
  citations: Citation[];
  /** Additional CSS classes */
  className?: string;
  /** Compact mode */
  compact?: boolean;
}

/**
 * Simple numbered list of sources.
 *
 * @example
 * ```tsx
 * <SourcesList citations={citations} compact />
 * ```
 */
export function SourcesList({
  citations,
  className,
  compact = false,
}: SourcesListProps) {
  if (citations.length === 0) return null;

  if (compact) {
    return (
      <div className={cn("text-xs text-muted-foreground", className)}>
        <span className="font-medium">Sources: </span>
        {citations.map((c, i) => (
          <React.Fragment key={c.index}>
            <a
              href={c.url}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-primary hover:underline"
            >
              [{c.index}]
            </a>
            {i < citations.length - 1 && " "}
          </React.Fragment>
        ))}
      </div>
    );
  }

  return (
    <div className={cn("space-y-1", className)}>
      {citations.map((citation) => (
        <SourceItem key={citation.index} citation={citation} />
      ))}
    </div>
  );
}

// ============================================
// MessageWithCitations - Complete message wrapper
// ============================================

export interface MessageWithCitationsProps {
  /** Message content (can contain citation placeholders) */
  children: React.ReactNode;
  /** Citations for this message */
  citations: Citation[];
  /** Citation display configuration */
  config?: CitationsConfig;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Wraps a message with citation support.
 * Shows sources bar or collapsible section based on config.
 *
 * @example
 * ```tsx
 * <MessageWithCitations
 *   citations={[
 *     { index: 1, url: "...", title: "Source 1" },
 *   ]}
 *   config={{ sourcesPosition: "bottom" }}
 * >
 *   <p>According to research <CitationBadge index={1} />, ...</p>
 * </MessageWithCitations>
 * ```
 */
export function MessageWithCitations({
  children,
  citations,
  config = {},
  className,
}: MessageWithCitationsProps) {
  const { enabled = true, sourcesPosition = "bottom", maxVisible = 5 } = config;

  if (!enabled || citations.length === 0) {
    return <div className={className}>{children}</div>;
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div>{children}</div>
      {sourcesPosition === "bottom" && (
        <SourcesBar citations={citations} maxVisible={maxVisible} />
      )}
      {sourcesPosition === "collapsible" && (
        <SourcesCollapsible citations={citations} />
      )}
    </div>
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

function getFaviconUrl(url: string): string {
  try {
    const domain = new URL(url).hostname;
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
  } catch {
    return "";
  }
}

/**
 * Convert OpenAI annotations to Citation format
 */
export function annotationsToCitations(
  annotations: Array<{
    type: string;
    url?: string;
    title?: string;
    start_index?: number;
    end_index?: number;
  }>,
): Citation[] {
  const seen = new Set<string>();
  const citations: Citation[] = [];

  for (const annotation of annotations) {
    if (annotation.type === "url_citation" && annotation.url) {
      if (!seen.has(annotation.url)) {
        seen.add(annotation.url);
        citations.push({
          index: citations.length + 1,
          url: annotation.url,
          title: annotation.title || getDomain(annotation.url),
          domain: getDomain(annotation.url),
        });
      }
    }
  }

  return citations;
}

/**
 * Convert WebSearchResult array to Citation format
 */
export function resultsToCitations(
  results: Array<{
    url: string;
    title: string;
    domain?: string;
  }>,
): Citation[] {
  return results.map((result, index) => ({
    index: index + 1,
    url: result.url,
    title: result.title,
    domain: result.domain || getDomain(result.url),
  }));
}
