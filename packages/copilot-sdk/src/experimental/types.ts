import { z } from "zod";
import type React from "react";

// ─── Payload Schemas ──────────────────────────────────────────────────────────

export const HtmlPayloadSchema = z
  .object({
    type: z.literal("html"),
    html: z
      .string()
      .describe(
        "Raw HTML string rendered in an isolated Shadow DOM with Tailwind CSS",
      ),
    title: z
      .string()
      .optional()
      .describe("Optional label shown above the component"),
    height: z
      .string()
      .optional()
      .describe("CSS height value e.g. '300px'. Defaults to auto."),
  })
  .passthrough();

export const ChartPayloadSchema = z
  .object({
    type: z.literal("chart"),
    chartType: z
      .enum(["bar", "line", "pie", "area", "scatter"])
      .describe("Chart visualization type"),
    title: z.string().optional(),
    labels: z.array(z.string()).describe("X-axis labels or category names"),
    datasets: z
      .array(
        z.object({
          label: z.string(),
          data: z.array(z.number()),
          color: z
            .string()
            .optional()
            .describe("Hex or CSS color for this series"),
        }),
      )
      .describe("One or more data series"),
    xLabel: z.string().optional().describe("X-axis label"),
    yLabel: z.string().optional().describe("Y-axis label"),
  })
  .passthrough();

export const TablePayloadSchema = z
  .object({
    type: z.literal("table"),
    title: z.string().optional(),
    columns: z
      .array(
        z
          .object({
            key: z.string(),
            label: z.string(),
            align: z.enum(["left", "right", "center"]).optional(),
          })
          .passthrough(),
      )
      .describe("Column definitions — order controls render order"),
    rows: z
      .array(z.record(z.string(), z.unknown()))
      .describe("Row data keyed by column.key"),
    caption: z.string().optional(),
  })
  .passthrough();

export const StatPayloadSchema = z
  .object({
    type: z.literal("stat"),
    title: z.string().optional(),
    stats: z.array(
      z
        .object({
          label: z.string(),
          value: z.union([z.string(), z.number()]),
          change: z.string().optional().describe("e.g. '+12%' or '-3.4%'"),
          changeDirection: z
            .enum(["positive", "negative", "neutral"])
            .optional(),
          description: z.string().optional().describe("Sub-text below value"),
        })
        .passthrough(),
    ),
  })
  .passthrough();

export const CardPayloadSchema = z
  .object({
    type: z.literal("card"),
    title: z.string(),
    subtitle: z.string().optional(),
    body: z.string().optional(),
    fields: z
      .array(
        z.object({
          label: z.string(),
          value: z.union([z.string(), z.number(), z.boolean()]),
          badge: z
            .boolean()
            .optional()
            .describe("Render value as a badge pill"),
        }),
      )
      .optional(),
    cta: z
      .object({
        label: z.string().optional(),
        text: z.string().optional(), // LLMs sometimes use "text" instead of "label"
        url: z.string().describe("URL for the call-to-action link"),
      })
      .transform((c) => ({ ...c, label: c.label ?? c.text ?? "" }))
      .optional(),
  })
  .passthrough();

/** Full discriminated union of all generative UI payload types */
export const GenerativeUIPayloadSchema = z.discriminatedUnion("type", [
  HtmlPayloadSchema,
  ChartPayloadSchema,
  TablePayloadSchema,
  StatPayloadSchema,
  CardPayloadSchema,
]);

// ─── TypeScript Types ──────────────────────────────────────────────────────────

export type HtmlPayload = z.infer<typeof HtmlPayloadSchema>;
export type ChartPayload = z.infer<typeof ChartPayloadSchema>;
export type TablePayload = z.infer<typeof TablePayloadSchema>;
export type StatPayload = z.infer<typeof StatPayloadSchema>;
export type CardPayload = z.infer<typeof CardPayloadSchema>;
export type GenerativeUIPayload = z.infer<typeof GenerativeUIPayloadSchema>;

/** Props passed to user-supplied chart renderer */
export interface ChartRendererProps {
  payload: ChartPayload;
}

/** Config for useGenerativeUI hook */
export interface UseGenerativeUIConfig {
  /**
   * Tool name — must match the key used in generativeUITool() on the server.
   * @default "render_ui"
   */
  name?: string;
  /**
   * Renderer for chart payloads. The SDK does not bundle a chart library.
   * Pass your own Recharts / Chart.js / Victory component here.
   * If omitted, chart results show a JSON data fallback.
   *
   * @example
   * ```tsx
   * chartRenderer={({ payload }) => (
   *   <BarChart data={payload.datasets} xLabels={payload.labels} />
   * )}
   * ```
   */
  chartRenderer?: React.ComponentType<ChartRendererProps>;
  /**
   * Override any built-in renderer per type.
   * Useful when you want custom styling while keeping the SDK's schema validation.
   */
  overrideRenderers?: Partial<{
    html: React.ComponentType<{ payload: HtmlPayload }>;
    chart: React.ComponentType<ChartRendererProps>;
    table: React.ComponentType<{ payload: TablePayload }>;
    stat: React.ComponentType<{ payload: StatPayload }>;
    card: React.ComponentType<{ payload: CardPayload }>;
  }>;
}
