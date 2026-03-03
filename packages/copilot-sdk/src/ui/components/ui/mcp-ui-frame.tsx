"use client";

import * as React from "react";
import { cn } from "../../lib/utils";
import type {
  MCPUIResource,
  MCPUIIntent,
  MCPUIFrameProps,
} from "../../../mcp/ui/types";
import {
  parseMCPUIMessage,
  DEFAULT_MCP_UI_SANDBOX,
} from "../../../mcp/ui/types";
import { Loader } from "./loader";

/**
 * MCPUIFrame - Renders MCP-UI resources in a sandboxed iframe
 *
 * This component provides secure rendering of interactive UI components
 * returned by MCP tools. It handles:
 * - Inline HTML content (text/html)
 * - External URLs (text/uri-list)
 * - PostMessage communication for intents
 *
 * @example
 * ```tsx
 * <MCPUIFrame
 *   resource={{
 *     uri: "ui://shop/product/123",
 *     mimeType: "text/html",
 *     content: "<div class='product'>...</div>",
 *     metadata: { height: "300px" }
 *   }}
 *   onIntent={(intent) => {
 *     if (intent.type === "tool") {
 *       callTool(intent.name, intent.arguments);
 *     }
 *   }}
 * />
 * ```
 */
export function MCPUIFrame({
  resource,
  onIntent,
  onError,
  onLoad,
  className,
  style,
  sandbox = DEFAULT_MCP_UI_SANDBOX,
  showLoading = true,
  testId,
}: MCPUIFrameProps) {
  const iframeRef = React.useRef<HTMLIFrameElement>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<Error | null>(null);

  // Handle postMessage events from the iframe
  React.useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Validate the message source
      if (event.source !== iframeRef.current?.contentWindow) {
        return;
      }

      // Parse the message
      const intent = parseMCPUIMessage(event.data);
      if (intent && onIntent) {
        onIntent(intent);
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [onIntent]);

  // Handle iframe load
  const handleLoad = React.useCallback(() => {
    setIsLoading(false);
    onLoad?.();
  }, [onLoad]);

  // Handle iframe error
  const handleError = React.useCallback(() => {
    const err = new Error("Failed to load MCP UI content");
    setError(err);
    setIsLoading(false);
    onError?.(err);
  }, [onError]);

  // Build iframe content based on MIME type
  const { srcDoc, src } = React.useMemo(() => {
    if (resource.mimeType === "text/html") {
      // Inline HTML content
      let content = resource.content || "";

      // If blob is provided, decode it
      if (resource.blob && !resource.content) {
        try {
          content = atob(resource.blob);
        } catch {
          setError(new Error("Failed to decode MCP UI blob content"));
        }
      }

      // Wrap content with base styles and message posting helper
      const wrappedContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
              *, *::before, *::after { box-sizing: border-box; }
              body { margin: 0; padding: 8px; font-family: system-ui, -apple-system, sans-serif; }
            </style>
          </head>
          <body>
            ${content}
            <script>
              // Helper for sending intents to parent
              window.mcpUI = {
                sendIntent: function(intent) {
                  window.parent.postMessage({ source: 'mcp-ui', intent: intent }, '*');
                },
                callTool: function(name, args) {
                  this.sendIntent({ type: 'tool', name: name, arguments: args });
                },
                sendAction: function(action, data) {
                  this.sendIntent({ type: 'intent', action: action, data: data });
                },
                prompt: function(text) {
                  this.sendIntent({ type: 'prompt', text: text });
                },
                notify: function(message, level) {
                  this.sendIntent({ type: 'notify', message: message, level: level || 'info' });
                },
                openLink: function(url, newTab) {
                  this.sendIntent({ type: 'link', url: url, newTab: newTab !== false });
                }
              };
            </script>
          </body>
        </html>
      `;

      return { srcDoc: wrappedContent, src: undefined };
    }

    if (resource.mimeType === "text/uri-list") {
      // External URL
      return { srcDoc: undefined, src: resource.content };
    }

    // Remote DOM or unknown - try to use content as URL
    return { srcDoc: undefined, src: resource.content };
  }, [resource]);

  // Calculate dimensions
  const frameStyle: React.CSSProperties = {
    width: resource.metadata?.width || "100%",
    minHeight: resource.metadata?.height || "200px",
    ...style,
  };

  if (error) {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive",
          className,
        )}
        style={frameStyle}
        data-testid={testId ? `${testId}-error` : undefined}
      >
        <div className="flex items-center gap-2">
          <svg
            className="size-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <span>Failed to load interactive content</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn("relative overflow-hidden rounded-lg border", className)}
      data-testid={testId}
    >
      {/* Title bar */}
      {resource.metadata?.title && (
        <div className="border-b bg-muted/50 px-3 py-1.5 text-xs font-medium text-muted-foreground">
          {resource.metadata.title}
        </div>
      )}

      {/* Loading overlay */}
      {showLoading && isLoading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80">
          <Loader variant="dots" size="md" />
        </div>
      )}

      {/* Iframe */}
      <iframe
        ref={iframeRef}
        srcDoc={srcDoc}
        src={src}
        sandbox={sandbox}
        onLoad={handleLoad}
        onError={handleError}
        className="block w-full border-0"
        style={frameStyle}
        title={resource.metadata?.title || "MCP UI Content"}
        data-testid={testId ? `${testId}-iframe` : undefined}
      />
    </div>
  );
}

/**
 * MCPUIFrameList - Renders multiple MCP-UI resources
 *
 * Convenience component for rendering an array of UI resources.
 *
 * @example
 * ```tsx
 * <MCPUIFrameList
 *   resources={execution.result?._uiResources}
 *   onIntent={handleIntent}
 * />
 * ```
 */
export interface MCPUIFrameListProps {
  /** Array of UI resources to render */
  resources?: MCPUIResource[];
  /** Callback when any UI emits an intent */
  onIntent?: (intent: MCPUIIntent, resourceIndex: number) => void;
  /** Callback when an error occurs */
  onError?: (error: Error, resourceIndex: number) => void;
  /** Additional CSS class names */
  className?: string;
  /** Class name for individual frames */
  frameClassName?: string;
  /** Gap between frames */
  gap?: "sm" | "md" | "lg";
}

export function MCPUIFrameList({
  resources,
  onIntent,
  onError,
  className,
  frameClassName,
  gap = "md",
}: MCPUIFrameListProps) {
  if (!resources || resources.length === 0) {
    return null;
  }

  const gapClasses = {
    sm: "space-y-1",
    md: "space-y-2",
    lg: "space-y-4",
  };

  return (
    <div className={cn(gapClasses[gap], className)}>
      {resources.map((resource, index) => (
        <MCPUIFrame
          key={`${resource.uri}-${index}`}
          resource={resource}
          onIntent={(intent) => onIntent?.(intent, index)}
          onError={(error) => onError?.(error, index)}
          className={frameClassName}
          testId={`mcp-ui-frame-${index}`}
        />
      ))}
    </div>
  );
}

// Note: MCPUIFrameProps is imported from mcp/ui/types
// MCPUIFrameListProps is exported above with the component
