export const RENDER_UI_PARAMETERS = {
  type: "object" as const,
  properties: {
    html: {
      type: "string" as const,
      description:
        "Raw HTML string with Tailwind CSS classes. Chart.js is available for charts via <canvas> + inline <script>.",
    },
    title: {
      type: "string" as const,
      description: "Optional title shown above the rendered component",
    },
    height: {
      type: "string" as const,
      description:
        "CSS height for the iframe, e.g. '400px'. Defaults to '520px'.",
    },
  },
  required: ["html"],
};

export interface GenerativeUIToolConfig {
  /**
   * Override the default LLM description.
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
      `Render a rich visual UI component directly in the chat using HTML with Tailwind CSS and Chart.js.

Use this tool whenever the user's request is best answered with a visual instead of plain text.

The HTML is rendered in an iframe with two libraries pre-loaded:
1. Tailwind CSS (Play CDN) — use any utility class
2. Chart.js — create charts with <canvas> + new Chart(...)

Design in a clean, modern style:
- Cards: bg-white rounded-xl border border-gray-200 shadow-sm p-6
- Headings: text-gray-900 font-semibold text-lg
- Muted: text-gray-500 text-sm
- Badges: bg-blue-50 text-blue-700 px-2.5 py-0.5 rounded-full text-xs font-medium
- Grid: grid grid-cols-3 gap-4
- Tables, stats, cards, charts — build them all with HTML + Tailwind + Chart.js.

Set the "height" field to fit the content — e.g. "600px" for dashboards, "320px" for a small card.`,
    parameters: RENDER_UI_PARAMETERS,
  };
}
