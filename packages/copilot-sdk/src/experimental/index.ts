/**
 * @yourgpt/copilot-sdk/experimental
 *
 * Experimental generative UI — lets the LLM render typed UI components
 * (charts, tables, stats, cards, raw HTML) inline in the chat.
 *
 * APIs in this module may change without a semver major bump.
 *
 * @experimental
 *
 * @example
 * ```tsx
 * // Backend (route handler)
 * import { generativeUITool } from "@yourgpt/copilot-sdk/experimental";
 * tools: { render_ui: generativeUITool() }
 *
 * // Frontend
 * import { useGenerativeUI } from "@yourgpt/copilot-sdk/experimental";
 * useGenerativeUI({ chartRenderer: MyChartComponent });
 * ```
 */

// ── Backend helper ────────────────────────────────────────────────────────────
export { generativeUITool } from "./generativeUITool";
export type { GenerativeUIToolConfig } from "./generativeUITool";

// ── Frontend hook ─────────────────────────────────────────────────────────────
export { useGenerativeUI } from "./useGenerativeUI";

// ── Types & schemas ───────────────────────────────────────────────────────────
export {
  GenerativeUIPayloadSchema,
  HtmlPayloadSchema,
  ChartPayloadSchema,
  TablePayloadSchema,
  StatPayloadSchema,
  CardPayloadSchema,
} from "./types";
export type {
  GenerativeUIPayload,
  HtmlPayload,
  ChartPayload,
  TablePayload,
  StatPayload,
  CardPayload,
  ChartRendererProps,
  UseGenerativeUIConfig,
} from "./types";

// ── Individual renderers (for override / advanced usage) ──────────────────────
export { HtmlRenderer } from "./renderers/HtmlRenderer";
export { TableRenderer } from "./renderers/TableRenderer";
export { StatRenderer } from "./renderers/StatRenderer";
export { CardRenderer } from "./renderers/CardRenderer";
