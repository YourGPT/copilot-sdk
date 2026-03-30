"use client";

import * as React from "react";
import { cn } from "../../lib/utils";

// ============================================
// Types
// ============================================

export interface BranchNavigatorProps {
  /** 0-based index of the current sibling */
  siblingIndex: number;
  /** Total number of sibling variants at this fork */
  totalSiblings: number;
  /** Whether there is a previous sibling to navigate to */
  hasPrevious: boolean;
  /** Whether there is a next sibling to navigate to */
  hasNext: boolean;
  /** Navigate to the previous sibling */
  onPrevious: () => void;
  /** Navigate to the next sibling */
  onNext: () => void;
  /** Additional class names */
  className?: string;
}

// ============================================
// BranchNavigator
// ============================================

/**
 * BranchNavigator — ← N/M → variant navigator shown below user messages
 * when a conversation has been branched (via edit or regenerate).
 *
 * Purely presentational — no SDK dependency.
 *
 * @example
 * ```tsx
 * <BranchNavigator
 *   siblingIndex={1}
 *   totalSiblings={3}
 *   hasPrevious={true}
 *   hasNext={true}
 *   onPrevious={() => switchBranch(siblings[0])}
 *   onNext={() => switchBranch(siblings[2])}
 * />
 * ```
 */
export function BranchNavigator({
  siblingIndex,
  totalSiblings,
  hasPrevious,
  hasNext,
  onPrevious,
  onNext,
  className,
}: BranchNavigatorProps) {
  return (
    <div
      className={cn(
        "csdk-branch-navigator flex items-center gap-1 text-xs text-muted-foreground select-none",
        className,
      )}
    >
      {/* ← Previous */}
      <button
        type="button"
        onClick={onPrevious}
        disabled={!hasPrevious}
        aria-label="Previous version"
        className={cn(
          "p-0.5 rounded transition-colors",
          hasPrevious
            ? "hover:text-foreground hover:bg-muted cursor-pointer"
            : "opacity-30 cursor-default",
        )}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </button>

      {/* N / M */}
      <span className="tabular-nums leading-none">
        {siblingIndex + 1}&thinsp;/&thinsp;{totalSiblings}
      </span>

      {/* → Next */}
      <button
        type="button"
        onClick={onNext}
        disabled={!hasNext}
        aria-label="Next version"
        className={cn(
          "p-0.5 rounded transition-colors",
          hasNext
            ? "hover:text-foreground hover:bg-muted cursor-pointer"
            : "opacity-30 cursor-default",
        )}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M9 18l6-6-6-6" />
        </svg>
      </button>
    </div>
  );
}
