// Flat JSON schema — GenerativeUIPayloadSchema is used only in the client handler for validation — same structure as RENDER_UI_SCHEMA in useGenerativeUI.
// Flat object schemas with a discriminator field work reliably across all LLMs.
export const RENDER_UI_PARAMETERS = {
  type: "object" as const,
  properties: {
    type: {
      type: "string" as const,
      enum: ["html", "chart", "table", "stat", "card"],
      description: "UI component type to render",
    },
    html: {
      type: "string" as const,
      description: "Raw HTML with Tailwind classes (type=html)",
    },
    height: { type: "string" as const },
    chartType: {
      type: "string" as const,
      enum: ["bar", "line", "pie", "area", "scatter"],
      description: "Chart variant (type=chart)",
    },
    labels: {
      type: "array" as const,
      items: { type: "string" as const },
      description: "X-axis category labels (type=chart)",
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
      description: "Data series (type=chart)",
    },
    xLabel: { type: "string" as const },
    yLabel: { type: "string" as const },
    columns: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          key: { type: "string" as const },
          label: { type: "string" as const },
          align: { type: "string" as const },
        },
        required: ["key", "label"],
      },
      description:
        "Column definitions — key matches row property names (type=table)",
    },
    rows: {
      type: "array" as const,
      items: { type: "object" as const },
      description: "Array of row objects keyed by column.key (type=table)",
    },
    caption: { type: "string" as const },
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
      description: "KPI stats array (type=stat)",
    },
    title: {
      type: "string" as const,
      description: "Title shown above the component",
    },
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
      description: "Key-value fields (type=card)",
    },
    cta: {
      type: "object" as const,
      properties: {
        label: { type: "string" as const },
        url: { type: "string" as const },
      },
      required: ["label", "url"],
      description: "Call-to-action link (type=card)",
    },
  },
  required: ["type"],
};

export interface GenerativeUIToolConfig {
  /**
   * Override the default LLM description.
   * The default instructs the model when to use each UI type.
   */
  description?: string;
}

/**
 * Returns a tool definition compatible with `streamText` for use in your backend route.
 *
 * Pass the returned object as a value in the `tools` map of `streamText`.
 * The key you use becomes the tool name — use the same name in `useGenerativeUI({ name })` on the frontend.
 *
 * @example
 * ```ts
 * import { streamText } from "@yourgpt/llm-sdk";
 * import { generativeUITool } from "@yourgpt/copilot-sdk/experimental";
 *
 * const result = await streamText({
 *   model: openai("gpt-4o"),
 *   messages,
 *   tools: {
 *     render_ui: generativeUITool(),
 *     // ...your other tools
 *   },
 * });
 * ```
 */
export function generativeUITool(config: GenerativeUIToolConfig = {}) {
  return {
    description:
      config.description ??
      `Render a rich visual UI component directly in the chat. Use this tool whenever the user's request is best answered with a visual instead of text.

Choose the type based on what fits best:
- "table": structured rows of data (comparisons, lists, records)
- "stat": KPI metrics, numbers with labels, dashboards with change deltas
- "card": entity summaries — profiles, products, results, structured key-value info
- "chart": graphs and visualizations — bar, line, pie, area, scatter — pass raw data only, not markup
- "html": anything that requires custom layout, rich formatting, or doesn't fit the above types — use Tailwind CSS classes freely

Always prefer a structured type (table, stat, card) over html when the data fits.
Only use html as a last resort for truly freeform content.`,
    parameters: RENDER_UI_PARAMETERS,
  };
}
