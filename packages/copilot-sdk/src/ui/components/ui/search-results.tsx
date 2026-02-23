"use client";

import { cn } from "../../lib/utils";
import type {
  WebSearchResult,
  WebSearchResponse,
} from "../../../core/tools/webSearch/types";

// ============================================
// SearchResults Component
// ============================================

export interface SearchResultsProps {
  /** Search results to display */
  results: WebSearchResult[];
  /** Additional CSS classes */
  className?: string;
  /** Display variant */
  variant?: "cards" | "list" | "compact";
  /** Maximum results to show (default: all) */
  maxResults?: number;
  /** Show relevance scores (if available) */
  showScores?: boolean;
  /** Show publication dates (if available) */
  showDates?: boolean;
}

/**
 * Display web search results with multiple layout options.
 *
 * @example
 * ```tsx
 * // Compact inline citations
 * <SearchResults results={searchResults} variant="compact" />
 *
 * // Card layout with full details
 * <SearchResults results={searchResults} variant="cards" />
 *
 * // List layout
 * <SearchResults results={searchResults} variant="list" />
 * ```
 */
export function SearchResults({
  results,
  className,
  variant = "cards",
  maxResults,
  showScores = false,
  showDates = false,
}: SearchResultsProps) {
  const displayResults = maxResults ? results.slice(0, maxResults) : results;

  if (displayResults.length === 0) {
    return (
      <div className={cn("text-muted-foreground text-sm", className)}>
        No results found
      </div>
    );
  }

  if (variant === "compact") {
    return (
      <div className={cn("flex flex-wrap gap-2", className)}>
        {displayResults.map((result, i) => (
          <SearchResultCompact key={i} result={result} index={i + 1} />
        ))}
      </div>
    );
  }

  if (variant === "list") {
    return (
      <div className={cn("space-y-2", className)}>
        {displayResults.map((result, i) => (
          <SearchResultList
            key={i}
            result={result}
            index={i + 1}
            showScore={showScores}
            showDate={showDates}
          />
        ))}
      </div>
    );
  }

  // Default: cards variant
  return (
    <div className={cn("grid gap-2", className)}>
      {displayResults.map((result, i) => (
        <SearchResultCard
          key={i}
          result={result}
          showScore={showScores}
          showDate={showDates}
        />
      ))}
    </div>
  );
}

// ============================================
// Sub-components
// ============================================

interface SearchResultCardProps {
  result: WebSearchResult;
  showScore?: boolean;
  showDate?: boolean;
}

function SearchResultCard({
  result,
  showScore,
  showDate,
}: SearchResultCardProps) {
  const domain = result.domain || getDomain(result.url);

  return (
    <a
      href={result.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group block p-3 border rounded-lg hover:bg-muted/50 transition-colors"
    >
      <div className="flex items-start gap-3">
        <img
          src={getFaviconUrl(result.url)}
          alt=""
          className="w-5 h-5 mt-0.5 rounded-sm"
          width={20}
          height={20}
        />
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-sm group-hover:text-primary truncate">
            {result.title}
          </h4>
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
            {result.content}
          </p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-muted-foreground/60 truncate">
              {domain}
            </span>
            {showDate && result.publishedDate && (
              <span className="text-xs text-muted-foreground/60">
                {formatDate(result.publishedDate)}
              </span>
            )}
            {showScore && result.score !== undefined && (
              <span className="text-xs text-muted-foreground/60">
                {(result.score * 100).toFixed(0)}% match
              </span>
            )}
          </div>
        </div>
      </div>
    </a>
  );
}

interface SearchResultListProps {
  result: WebSearchResult;
  index: number;
  showScore?: boolean;
  showDate?: boolean;
}

function SearchResultList({
  result,
  index,
  showScore,
  showDate,
}: SearchResultListProps) {
  const domain = result.domain || getDomain(result.url);

  return (
    <a
      href={result.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-start gap-2 py-1.5 hover:bg-muted/30 rounded px-1 -mx-1 transition-colors"
    >
      <span className="text-xs text-muted-foreground/60 mt-0.5 w-4 text-right flex-shrink-0">
        {index}.
      </span>
      <img
        src={getFaviconUrl(result.url)}
        alt=""
        className="w-4 h-4 mt-0.5 rounded-sm flex-shrink-0"
        width={16}
        height={16}
      />
      <div className="flex-1 min-w-0">
        <span className="text-sm group-hover:text-primary">{result.title}</span>
        <span className="text-xs text-muted-foreground ml-2">{domain}</span>
        {showDate && result.publishedDate && (
          <span className="text-xs text-muted-foreground/60 ml-2">
            {formatDate(result.publishedDate)}
          </span>
        )}
        {showScore && result.score !== undefined && (
          <span className="text-xs text-muted-foreground/60 ml-2">
            ({(result.score * 100).toFixed(0)}%)
          </span>
        )}
      </div>
    </a>
  );
}

interface SearchResultCompactProps {
  result: WebSearchResult;
  index: number;
}

function SearchResultCompact({ result, index }: SearchResultCompactProps) {
  const domain = result.domain || getDomain(result.url);

  return (
    <a
      href={result.url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 px-2 py-1 text-xs bg-muted hover:bg-muted/80 rounded-md transition-colors"
      title={result.title}
    >
      <img
        src={getFaviconUrl(result.url)}
        alt=""
        className="w-3.5 h-3.5 rounded-sm"
        width={14}
        height={14}
      />
      <span className="truncate max-w-[120px]">{domain}</span>
    </a>
  );
}

// ============================================
// SearchAnswer Component
// ============================================

export interface SearchAnswerProps {
  /** AI-generated answer from search */
  answer: string;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Display an AI-generated answer summary from web search.
 * Useful when using providers like Tavily that generate summaries.
 */
export function SearchAnswer({ answer, className }: SearchAnswerProps) {
  return (
    <div
      className={cn(
        "p-3 bg-muted/50 rounded-lg border-l-2 border-primary/50",
        className,
      )}
    >
      <p className="text-sm">{answer}</p>
    </div>
  );
}

// ============================================
// SearchResultsWithAnswer Component
// ============================================

export interface SearchResultsWithAnswerProps {
  /** Full web search response */
  response: WebSearchResponse;
  /** Additional CSS classes */
  className?: string;
  /** Results variant */
  variant?: "cards" | "list" | "compact";
  /** Show the AI answer (if available) */
  showAnswer?: boolean;
  /** Maximum results to show */
  maxResults?: number;
}

/**
 * Display complete web search response including answer and results.
 *
 * @example
 * ```tsx
 * <SearchResultsWithAnswer
 *   response={webSearchResponse}
 *   showAnswer={true}
 *   variant="cards"
 * />
 * ```
 */
export function SearchResultsWithAnswer({
  response,
  className,
  variant = "cards",
  showAnswer = true,
  maxResults,
}: SearchResultsWithAnswerProps) {
  return (
    <div className={cn("space-y-3", className)}>
      {showAnswer && response.answer && (
        <SearchAnswer answer={response.answer} />
      )}
      <SearchResults
        results={response.results}
        variant={variant}
        maxResults={maxResults}
      />
      {response.searchTime && (
        <p className="text-xs text-muted-foreground">
          Found {response.results.length} results in {response.searchTime}ms
        </p>
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

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return `${Math.floor(diffDays / 365)} years ago`;
  } catch {
    return dateStr;
  }
}
