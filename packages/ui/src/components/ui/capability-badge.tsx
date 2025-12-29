"use client";

import * as React from "react";
import { cn } from "../../lib/utils";

// ============================================
// Types
// ============================================

export type CapabilityType =
  | "vision"
  | "tools"
  | "thinking"
  | "streaming"
  | "pdf"
  | "audio"
  | "video"
  | "json";

export interface CapabilityBadgeProps {
  /** Capability type to display */
  type: CapabilityType;
  /** Whether the capability is supported */
  supported?: boolean;
  /** Show label text next to icon */
  showLabel?: boolean;
  /** Size variant */
  size?: "sm" | "md" | "lg";
  /** Additional class name */
  className?: string;
}

// ============================================
// Icons
// ============================================

const icons: Record<CapabilityType, React.ReactNode> = {
  vision: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
  tools: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </svg>
  ),
  thinking: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
  streaming: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  ),
  pdf: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  ),
  audio: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  ),
  video: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <polygon points="23 7 16 12 23 17 23 7" />
      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
    </svg>
  ),
  json: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M4 6h16" />
      <path d="M4 12h16" />
      <path d="M4 18h12" />
    </svg>
  ),
};

const labels: Record<CapabilityType, string> = {
  vision: "Vision",
  tools: "Tools",
  thinking: "Thinking",
  streaming: "Streaming",
  pdf: "PDF",
  audio: "Audio",
  video: "Video",
  json: "JSON",
};

const descriptions: Record<CapabilityType, string> = {
  vision: "Supports image inputs",
  tools: "Supports function calling",
  thinking: "Extended reasoning mode",
  streaming: "Real-time streaming",
  pdf: "Can process PDF files",
  audio: "Supports audio inputs",
  video: "Supports video inputs",
  json: "Structured JSON output",
};

// ============================================
// Component
// ============================================

/**
 * Badge showing a model capability with icon
 *
 * @example
 * ```tsx
 * <CapabilityBadge type="vision" supported />
 * <CapabilityBadge type="audio" supported={false} />
 * ```
 */
export function CapabilityBadge({
  type,
  supported = true,
  showLabel = false,
  size = "sm",
  className,
}: CapabilityBadgeProps) {
  const sizeClasses = {
    sm: "h-5 px-1.5 text-[10px]",
    md: "h-6 px-2 text-xs",
    lg: "h-7 px-2.5 text-sm",
  };

  const iconSizes = {
    sm: "w-3 h-3",
    md: "w-3.5 h-3.5",
    lg: "w-4 h-4",
  };

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 rounded-full font-medium transition-colors",
        sizeClasses[size],
        supported
          ? "bg-primary/10 text-primary"
          : "bg-muted text-muted-foreground opacity-50",
        className,
      )}
      title={`${labels[type]}: ${descriptions[type]}`}
    >
      <span className={cn("flex-shrink-0", iconSizes[size])}>
        {icons[type]}
      </span>
      {showLabel && <span>{labels[type]}</span>}
    </div>
  );
}

// ============================================
// Capability List
// ============================================

export interface CapabilityListProps {
  /** Capabilities object */
  capabilities: {
    supportsVision?: boolean;
    supportsTools?: boolean;
    supportsThinking?: boolean;
    supportsStreaming?: boolean;
    supportsPDF?: boolean;
    supportsAudio?: boolean;
    supportsVideo?: boolean;
    supportsJsonMode?: boolean;
  };
  /** Show labels */
  showLabels?: boolean;
  /** Only show supported capabilities */
  onlySupported?: boolean;
  /** Size variant */
  size?: "sm" | "md" | "lg";
  /** Additional class name */
  className?: string;
}

/**
 * Display a list of capability badges
 *
 * @example
 * ```tsx
 * const { capabilities } = useCapabilities();
 * <CapabilityList capabilities={capabilities} />
 * ```
 */
export function CapabilityList({
  capabilities,
  showLabels = false,
  onlySupported = true,
  size = "sm",
  className,
}: CapabilityListProps) {
  const items: Array<{ type: CapabilityType; supported: boolean }> = [
    { type: "vision", supported: capabilities.supportsVision ?? false },
    { type: "tools", supported: capabilities.supportsTools ?? false },
    { type: "thinking", supported: capabilities.supportsThinking ?? false },
    { type: "streaming", supported: capabilities.supportsStreaming ?? false },
    { type: "pdf", supported: capabilities.supportsPDF ?? false },
    { type: "audio", supported: capabilities.supportsAudio ?? false },
    { type: "video", supported: capabilities.supportsVideo ?? false },
    { type: "json", supported: capabilities.supportsJsonMode ?? false },
  ];

  const filteredItems = onlySupported
    ? items.filter((item) => item.supported)
    : items;

  if (filteredItems.length === 0) return null;

  return (
    <div className={cn("flex flex-wrap gap-1", className)}>
      {filteredItems.map((item) => (
        <CapabilityBadge
          key={item.type}
          type={item.type}
          supported={item.supported}
          showLabel={showLabels}
          size={size}
        />
      ))}
    </div>
  );
}
