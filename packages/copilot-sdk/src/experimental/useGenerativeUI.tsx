"use client";

import * as React from "react";
import { useTool } from "../react/hooks/useTool";
import type { ToolRenderProps } from "../core/types/tools";
import { DotsLoader } from "../ui/components/ui/loader";
import { HtmlRenderer } from "./renderers/HtmlRenderer";
import { TableRenderer } from "./renderers/TableRenderer";
import { StatRenderer } from "./renderers/StatRenderer";
import { CardRenderer } from "./renderers/CardRenderer";
import { GenerativeUIPayloadSchema } from "./types";
import type {
  GenerativeUIPayload,
  ChartPayload,
  UseGenerativeUIConfig,
} from "./types";

/**
 * Flat JSON schema for the render_ui tool.
 * Using a flat object with a discriminator `type` field works reliably across all LLMs.
 * The Zod schema (GenerativeUIPayloadSchema) is still used for server-side validation.
 */
const RENDER_UI_SCHEMA = {
  type: "object" as const,
  properties: {
    type: {
      type: "string" as const,
      enum: ["html", "chart", "table", "stat", "card"],
      description: "The UI component type to render",
    },
    // html
    html: {
      type: "string" as const,
      description: "Raw HTML with Tailwind classes (type=html only)",
    },
    height: {
      type: "string" as const,
      description: "Optional CSS height (type=html only)",
    },
    // chart
    chartType: {
      type: "string" as const,
      enum: ["bar", "line", "pie", "area", "scatter"],
      description: "Chart variant (type=chart only)",
    },
    labels: {
      type: "array" as const,
      items: { type: "string" as const },
      description: "X-axis labels (type=chart only)",
    },
    datasets: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          label: { type: "string" as const },
          data: { type: "array" as const, items: { type: "number" as const } },
        },
        required: ["label", "data"],
      },
      description: "Data series array (type=chart only)",
    },
    xLabel: { type: "string" as const },
    yLabel: { type: "string" as const },
    // table
    columns: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          key: { type: "string" as const },
          label: { type: "string" as const },
          align: { type: "string" as const, enum: ["left", "right", "center"] },
        },
        required: ["key", "label"],
      },
      description:
        "Column definitions — key matches row property names (type=table only)",
    },
    rows: {
      type: "array" as const,
      items: { type: "object" as const },
      description: "Row objects keyed by column.key values (type=table only)",
    },
    caption: { type: "string" as const },
    // stat
    stats: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          label: { type: "string" as const },
          value: { type: "string" as const },
          change: { type: "string" as const },
          changeDirection: {
            type: "string" as const,
            enum: ["positive", "negative", "neutral"],
          },
          description: { type: "string" as const },
        },
        required: ["label", "value"],
      },
      description: "KPI stats array (type=stat only)",
    },
    // card
    title: { type: "string" as const, description: "Card or table title" },
    subtitle: { type: "string" as const },
    body: { type: "string" as const },
    fields: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          label: { type: "string" as const },
          value: { type: "string" as const },
          badge: { type: "boolean" as const },
        },
        required: ["label", "value"],
      },
      description: "Key-value fields (type=card only)",
    },
    cta: {
      type: "object" as const,
      properties: {
        label: { type: "string" as const },
        url: { type: "string" as const },
      },
      required: ["label", "url"],
      description: "Call-to-action link (type=card only)",
    },
  },
  required: ["type"],
};

/**
 * Register the generative UI tool and attach built-in renderers for all payload types.
 *
 * Must be called inside a `CopilotProvider`. The `name` must match
 * the key used for `generativeUITool()` in your backend `streamText` tools map.
 *
 * @example
 * ```tsx
 * import { useGenerativeUI } from "@yourgpt/copilot-sdk/experimental";
 *
 * function App() {
 *   useGenerativeUI({
 *     chartRenderer: ({ payload }) => (
 *       <BarChart labels={payload.labels} datasets={payload.datasets} />
 *     ),
 *   });
 *   return <CopilotChat />;
 * }
 * ```
 *
 * @experimental This API may change without a semver major bump.
 */
export function useGenerativeUI(config: UseGenerativeUIConfig = {}): void {
  const toolName = config.name ?? "render_ui";

  // Keep config in a ref so the render function always has the latest without
  // triggering useTool re-registration on every render
  const configRef = React.useRef(config);
  configRef.current = config;

  useTool<GenerativeUIPayload>({
    name: toolName,
    description:
      "Renders a rich UI component inline in the chat. Handled automatically by the SDK.",
    inputSchema: RENDER_UI_SCHEMA,
    hidden: false,
    aiResponseMode: "none",
    aiContext: (_, args) => {
      const type = (args as GenerativeUIPayload)?.type ?? "ui";
      return `[Rendered ${type} component to user]`;
    },
    handler: async (params) => {
      // Some LLMs wrap the payload in a `data` key — unwrap if needed
      const raw =
        params && typeof params === "object" && "data" in params
          ? (params as Record<string, unknown>).data
          : params;
      const parsed = GenerativeUIPayloadSchema.safeParse(raw);
      if (!parsed.success) {
        return {
          success: false,
          error: `Invalid generative UI payload: ${parsed.error.message}`,
        };
      }
      return {
        success: true,
        data: parsed.data,
        _aiContext: `[Rendered ${parsed.data.type} component to user]`,
        _aiResponseMode: "none" as const,
      };
    },
    render: (props: ToolRenderProps<GenerativeUIPayload>) => (
      <GenerativeUIRenderer props={props} configRef={configRef} />
    ),
  });
}

// ─── Internal renderer ────────────────────────────────────────────────────────

interface InternalRendererProps {
  props: ToolRenderProps<GenerativeUIPayload>;
  configRef: React.MutableRefObject<UseGenerativeUIConfig>;
}

function GenerativeUIRenderer({
  props: renderProps,
  configRef,
}: InternalRendererProps) {
  const { status, result, error } = renderProps;
  const config = configRef.current;

  // Loading
  if (status === "pending" || status === "executing") {
    return (
      <div className="flex items-center gap-2 py-1.5 text-sm text-muted-foreground">
        <DotsLoader size="sm" />
        <span>Preparing response…</span>
      </div>
    );
  }

  // Error
  if (status === "error") {
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
        {error ?? "Failed to render UI component."}
      </div>
    );
  }

  // Completed — parse payload from result.data
  if (status !== "completed") return null;

  const rawPayload = result?.data as GenerativeUIPayload | undefined;
  const parsed = GenerativeUIPayloadSchema.safeParse(rawPayload);

  if (!parsed.success) {
    return (
      <div className="overflow-auto rounded-md border border-border bg-muted/30 px-3 py-2">
        <pre className="whitespace-pre-wrap text-xs text-muted-foreground">
          {JSON.stringify(rawPayload, null, 2)}
        </pre>
      </div>
    );
  }

  const payload = parsed.data;

  switch (payload.type) {
    case "html": {
      const Override = config.overrideRenderers?.html;
      return Override ? (
        <Override payload={payload} />
      ) : (
        <HtmlRenderer payload={payload} />
      );
    }

    case "chart": {
      const ChartComp = config.overrideRenderers?.chart ?? config.chartRenderer;
      return ChartComp ? (
        <ChartComp payload={payload} />
      ) : (
        <ChartFallback payload={payload} />
      );
    }

    case "table": {
      const Override = config.overrideRenderers?.table;
      return Override ? (
        <Override payload={payload} />
      ) : (
        <TableRenderer payload={payload} />
      );
    }

    case "stat": {
      const Override = config.overrideRenderers?.stat;
      return Override ? (
        <Override payload={payload} />
      ) : (
        <StatRenderer payload={payload} />
      );
    }

    case "card": {
      const Override = config.overrideRenderers?.card;
      return Override ? (
        <Override payload={payload} />
      ) : (
        <CardRenderer payload={payload} />
      );
    }

    default:
      return null;
  }
}

/** Shown when no chartRenderer is provided */
function ChartFallback({ payload }: { payload: ChartPayload }) {
  return (
    <div className="rounded-md border border-border bg-muted/20 p-3">
      {payload.title && (
        <p className="mb-1.5 text-sm font-medium text-foreground">
          {payload.title}
        </p>
      )}
      <p className="mb-2 text-xs text-muted-foreground">
        Chart type:{" "}
        <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
          {payload.chartType}
        </code>
        . Pass a <code className="font-mono">chartRenderer</code> prop to{" "}
        <code className="font-mono">useGenerativeUI()</code> to render this.
      </p>
      <pre className="max-h-40 overflow-auto whitespace-pre-wrap text-xs text-muted-foreground font-mono">
        {JSON.stringify(
          { labels: payload.labels, datasets: payload.datasets },
          null,
          2,
        )}
      </pre>
    </div>
  );
}
