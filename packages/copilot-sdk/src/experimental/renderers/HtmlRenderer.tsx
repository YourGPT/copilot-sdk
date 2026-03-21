"use client";

import * as React from "react";
import { cn } from "../../ui/lib/utils";
import type { HtmlPayload } from "../types";

interface HtmlRendererProps {
  payload: HtmlPayload;
  className?: string;
}

/**
 * Strip only external script src= tags (e.g. duplicate CDN loads the AI might add).
 * Inline <script> blocks are kept — they're needed for Chart.js initialization
 * and are safe inside the sandboxed iframe.
 * Inline event handlers (onclick=, onerror=) are stripped as defense-in-depth.
 */
function sanitizeHtml(html: string): string {
  return html
    .replace(/<script\b[^>]*\bsrc=["'][^"']*["'][^>]*><\/script>/gi, "")
    .replace(/\s*on\w+="[^"]*"/gi, "")
    .replace(/\s*on\w+='[^']*'/gi, "");
}

/**
 * Renders AI-generated HTML inside an isolated iframe.
 * Tailwind CSS is loaded via CDN — iframes provide a full document context
 * so the Tailwind Play CDN can scan and style classes correctly.
 */
export function HtmlRenderer({ payload, className }: HtmlRendererProps) {
  const clean = sanitizeHtml(payload.html);

  const srcdoc = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <script src="https://cdn.tailwindcss.com"><\/script>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"><\/script>
  <style>
    body { margin: 0; padding: 4px; font-family: ui-sans-serif, system-ui, sans-serif; }
    * { box-sizing: border-box; }
  </style>
</head>
<body>${clean}</body>
</html>`;

  return (
    <div
      className={cn("csdk-genui-html", className)}
      style={{ width: "min(700px, calc(100vw - 320px))", minWidth: "320px" }}
    >
      {payload.title && (
        <p className="mb-1.5 text-xs font-medium text-muted-foreground">
          {payload.title}
        </p>
      )}
      <iframe
        srcDoc={srcdoc}
        sandbox="allow-scripts"
        style={{
          height: payload.height ?? "520px",
          minHeight: "120px",
          width: "100%",
        }}
        className="rounded-md border border-border bg-white"
        title={payload.title ?? "Rendered HTML"}
      />
    </div>
  );
}
