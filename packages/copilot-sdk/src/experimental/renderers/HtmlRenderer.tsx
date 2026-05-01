"use client";

import * as React from "react";
import { cn } from "../../ui/lib/utils";
import type { HtmlPayload } from "../types";

interface HtmlRendererProps {
  payload: HtmlPayload;
  className?: string;
  /** When true, defers script execution and strips the last incomplete line */
  streaming?: boolean;
}

/**
 * Strip external script src= tags (duplicate CDN loads the AI might add).
 * Inline event handlers are stripped as defense-in-depth.
 */
function sanitizeHtml(html: string): string {
  return html
    .replace(/<script\b[^>]*\bsrc=["'][^"']*["'][^>]*><\/script>/gi, "")
    .replace(/\s*on\w+="[^"]*"/gi, "")
    .replace(/\s*on\w+='[^']*'/gi, "");
}

/**
 * During streaming, strip the last incomplete line and remove
 * inline <script> blocks (deferred until streaming completes).
 */
function prepareStreamingHtml(html: string): string {
  const lines = html.split("\n");
  if (lines.length > 1) lines.pop();
  let result = lines.join("\n");
  result = result.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
  return result;
}

/**
 * Renders AI-generated HTML inside an isolated iframe.
 * Uses srcdoc for simplicity and reliability.
 */
export function HtmlRenderer({
  payload,
  className,
  streaming = false,
}: HtmlRendererProps) {
  const rawHtml = payload.html ?? "";
  const clean = sanitizeHtml(rawHtml);
  const displayHtml = streaming ? prepareStreamingHtml(clean) : clean;

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
<body>${displayHtml}</body>
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
