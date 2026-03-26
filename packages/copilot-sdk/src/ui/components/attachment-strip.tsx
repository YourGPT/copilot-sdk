"use client";

/**
 * AttachmentStrip — Displays pending attachments above the chat input.
 *
 * Minimal, Linear/Notion-inspired design.
 * Shows thumbnail, filename, progress, and remove/retry actions.
 */

import type { PendingAttachment } from "../hooks/useAttachments";

// ── Inline SVG icons (Lucide) ──────────────────────────────────────────────

const svgProps = {
  xmlns: "http://www.w3.org/2000/svg",
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function ImageIcon({ className }: { className?: string }) {
  return (
    <svg {...svgProps} className={className}>
      <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
      <circle cx="9" cy="9" r="2" />
      <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
    </svg>
  );
}
function FileTextIcon({ className }: { className?: string }) {
  return (
    <svg {...svgProps} className={className}>
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
      <path d="M14 2v4a2 2 0 0 0 2 2h4" />
      <path d="M10 9H8" />
      <path d="M16 13H8" />
      <path d="M16 17H8" />
    </svg>
  );
}
function MusicIcon({ className }: { className?: string }) {
  return (
    <svg {...svgProps} className={className}>
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </svg>
  );
}
function VideoIcon({ className }: { className?: string }) {
  return (
    <svg {...svgProps} className={className}>
      <path d="m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.934a.5.5 0 0 0-.777-.416L16 11" />
      <rect width="14" height="12" x="2" y="6" rx="2" />
    </svg>
  );
}
function XIcon({ className }: { className?: string }) {
  return (
    <svg {...svgProps} className={className}>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}
function RefreshCwIcon({ className }: { className?: string }) {
  return (
    <svg {...svgProps} className={className}>
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
      <path d="M8 16H3v5" />
    </svg>
  );
}
function Loader2Icon({ className }: { className?: string }) {
  return (
    <svg {...svgProps} className={className}>
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}
function CheckIcon({ className }: { className?: string }) {
  return (
    <svg {...svgProps} className={className}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

// ── File type icon ─────────────────────────────────────────────────────────

function FileTypeIcon({ mimeType }: { mimeType: string }) {
  const cls = "size-3.5";
  if (mimeType.startsWith("image/")) return <ImageIcon className={cls} />;
  if (mimeType.startsWith("audio/")) return <MusicIcon className={cls} />;
  if (mimeType.startsWith("video/")) return <VideoIcon className={cls} />;
  return <FileTextIcon className={cls} />;
}

// ── Status indicator ───────────────────────────────────────────────────────

function StatusBadge({ status }: { status: PendingAttachment["status"] }) {
  if (status === "uploading") {
    return <Loader2Icon className="size-3 animate-spin text-blue-400" />;
  }
  if (status === "ready") {
    return <CheckIcon className="size-3 text-emerald-400" />;
  }
  return null; // error shows retry button instead
}

// ── Single attachment card ─────────────────────────────────────────────────

function AttachmentCard({
  attachment,
  onRemove,
  onRetry,
}: {
  attachment: PendingAttachment;
  onRemove: (id: string) => void;
  onRetry: (id: string) => void;
}) {
  const { id, file, preview, status, progress, error } = attachment;
  const isError = status === "error";

  return (
    <div
      className={`
        csdk-attachment-card group relative flex items-center gap-1.5
        rounded-lg border px-2 py-1.5 min-w-0 max-w-[160px]
        transition-colors duration-150
        ${
          isError
            ? "border-red-500/30 bg-red-500/5"
            : "border-border/60 bg-muted/40 hover:bg-muted/60"
        }
      `}
    >
      {/* Thumbnail or icon */}
      <div className="size-7 rounded shrink-0 overflow-hidden bg-muted/60 flex items-center justify-center">
        {preview ? (
          <img
            src={preview}
            alt={file.name}
            className="size-full object-cover"
          />
        ) : (
          <FileTypeIcon mimeType={file.type} />
        )}
      </div>

      {/* Name + status */}
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-medium truncate leading-tight text-foreground/80">
          {file.name}
        </p>
        <div className="flex items-center gap-1 mt-0.5">
          {isError ? (
            <button
              onClick={() => onRetry(id)}
              className="flex items-center gap-0.5 text-[9px] text-red-400 hover:text-red-300 cursor-pointer"
            >
              <RefreshCwIcon className="size-2.5" />
              Retry
            </button>
          ) : (
            <>
              <StatusBadge status={status} />
              <span className="text-[9px] text-muted-foreground">
                {status === "uploading"
                  ? `${progress}%`
                  : formatBytes(file.size)}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Progress bar (uploading only) */}
      {status === "uploading" && (
        <div className="absolute bottom-0 left-0 right-0 h-[2px] rounded-b-lg overflow-hidden bg-muted/40">
          <div
            className="h-full bg-blue-500 transition-[width] duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {/* Remove button */}
      <button
        onClick={() => onRemove(id)}
        className="
          size-4 rounded-full shrink-0 flex items-center justify-center
          text-muted-foreground/50 hover:text-foreground hover:bg-muted
          transition-colors cursor-pointer
        "
        aria-label="Remove attachment"
      >
        <XIcon className="size-2.5" />
      </button>
    </div>
  );
}

// ── Bytes formatter ────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

// ── Main strip ─────────────────────────────────────────────────────────────

export interface AttachmentStripProps {
  attachments: PendingAttachment[];
  onRemove: (id: string) => void;
  onRetry: (id: string) => void;
  className?: string;
}

export function AttachmentStrip({
  attachments,
  onRemove,
  onRetry,
  className = "",
}: AttachmentStripProps) {
  if (attachments.length === 0) return null;

  return (
    <div
      className={`csdk-attachment-strip flex gap-1.5 overflow-x-auto px-1 py-1.5 scrollbar-none ${className}`}
    >
      {attachments.map((att) => (
        <AttachmentCard
          key={att.id}
          attachment={att}
          onRemove={onRemove}
          onRetry={onRetry}
        />
      ))}
    </div>
  );
}
