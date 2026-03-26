"use client";

/**
 * DropZoneOverlay — Shows when files are dragged over the chat area.
 */

const svgProps = {
  xmlns: "http://www.w3.org/2000/svg",
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};
function PaperclipIcon({ className }: { className?: string }) {
  return (
    <svg {...svgProps} className={className}>
      <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
    </svg>
  );
}

export interface DropZoneOverlayProps {
  isDragging: boolean;
  className?: string;
}

export function DropZoneOverlay({
  isDragging,
  className = "",
}: DropZoneOverlayProps) {
  if (!isDragging) return null;

  return (
    <div
      className={`
        csdk-drop-zone absolute inset-0 z-50 flex items-center justify-center
        bg-background/80 backdrop-blur-sm border-2 border-dashed border-primary/40
        rounded-xl pointer-events-none
        ${className}
      `}
    >
      <div className="flex flex-col items-center gap-2 text-primary/70">
        <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <PaperclipIcon className="size-5" />
        </div>
        <p className="text-sm font-medium">Drop files to attach</p>
      </div>
    </div>
  );
}
