"use client";

import * as React from "react";
import { cn } from "../../../lib/utils";
import type { KnowledgeBaseResult } from "../../../../core";

// ============================================
// Types
// ============================================

export interface KnowledgeBaseCardProps {
  /** The search query */
  query: string;
  /** Whether the search is loading */
  isLoading?: boolean;
  /** Search results */
  results?: KnowledgeBaseResult[];
  /** Error message if failed */
  error?: string;
  /** Total results count */
  total?: number;
  /** Additional class name */
  className?: string;
}

// ============================================
// Result Item
// ============================================

function ResultItem({
  result,
  index,
}: {
  result: KnowledgeBaseResult;
  index: number;
}) {
  const [expanded, setExpanded] = React.useState(false);
  const scorePercent = Math.round(result.score * 100);
  const isHighRelevance = scorePercent >= 70;
  const isMediumRelevance = scorePercent >= 40 && scorePercent < 70;

  // Truncate content for preview
  const previewLength = 150;
  const needsTruncation = result.content.length > previewLength;
  const preview = needsTruncation
    ? result.content.slice(0, previewLength) + "..."
    : result.content;

  return (
    <div className="border-b border-border/50 last:border-0 py-2.5 first:pt-0 last:pb-0">
      <div className="flex items-start gap-2">
        {/* Index badge */}
        <span className="flex-shrink-0 size-5 rounded bg-muted text-[10px] font-medium flex items-center justify-center text-muted-foreground">
          {index + 1}
        </span>

        <div className="flex-1 min-w-0">
          {/* Score badge */}
          <div className="flex items-center gap-2 mb-1">
            <span
              className={cn(
                "text-[10px] font-medium px-1.5 py-0.5 rounded",
                isHighRelevance &&
                  "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
                isMediumRelevance &&
                  "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
                !isHighRelevance &&
                  !isMediumRelevance &&
                  "bg-muted text-muted-foreground",
              )}
            >
              {scorePercent}% match
            </span>
          </div>

          {/* Content */}
          <p className="text-xs text-foreground/80 leading-relaxed">
            {expanded ? result.content : preview}
          </p>

          {/* Expand/collapse button */}
          {needsTruncation && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-[10px] text-primary hover:underline mt-1"
            >
              {expanded ? "Show less" : "Show more"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================
// Loading State
// ============================================

function LoadingState({ query }: { query: string }) {
  return (
    <div className="flex items-center gap-2 py-2">
      <div className="size-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      <span className="text-xs text-muted-foreground">
        Searching for "{query}"...
      </span>
    </div>
  );
}

// ============================================
// Error State
// ============================================

function ErrorState({ error }: { error: string }) {
  return (
    <div className="flex items-center gap-2 py-2 text-red-500">
      <svg
        className="size-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      <span className="text-xs">{error}</span>
    </div>
  );
}

// ============================================
// Empty State
// ============================================

function EmptyState({ query }: { query: string }) {
  return (
    <div className="py-3 text-center">
      <svg
        className="size-8 mx-auto text-muted-foreground/40 mb-2"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      <p className="text-xs text-muted-foreground">
        No results found for "{query}"
      </p>
    </div>
  );
}

// ============================================
// Main Component
// ============================================

/**
 * Default UI card for Knowledge Base search results
 *
 * Shows search results with relevance scores and expandable content.
 *
 * @example
 * ```tsx
 * <KnowledgeBaseCard
 *   query="How do I reset my password?"
 *   results={[
 *     { pointId: "1", docId: "doc1", score: 0.95, content: "..." },
 *   ]}
 * />
 * ```
 */
export function KnowledgeBaseCard({
  query,
  isLoading,
  results = [],
  error,
  total,
  className,
}: KnowledgeBaseCardProps) {
  const hasResults = results.length > 0;

  return (
    <div
      className={cn(
        "rounded-lg border bg-card shadow-sm overflow-hidden",
        className,
      )}
    >
      {/* Header */}
      <div className="px-3 py-2 bg-muted/30 border-b border-border/50">
        <div className="flex items-center gap-2">
          <svg
            className="size-4 text-primary"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <span className="text-xs font-medium text-foreground">
            Knowledge Base
          </span>
          {hasResults && (
            <span className="text-[10px] text-muted-foreground ml-auto">
              {total ?? results.length} result
              {(total ?? results.length) !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="px-3 py-2">
        {isLoading && <LoadingState query={query} />}
        {!isLoading && error && <ErrorState error={error} />}
        {!isLoading && !error && !hasResults && <EmptyState query={query} />}
        {!isLoading && !error && hasResults && (
          <div>
            {results.map((result, index) => (
              <ResultItem key={result.pointId} result={result} index={index} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
