import { z } from "zod";

// ─── GenUI Payload (for HtmlRenderer — tool-based approach) ──────────────────

export const HtmlPayloadSchema = z
  .object({
    type: z.literal("html"),
    html: z
      .string()
      .describe(
        "Raw HTML string rendered in an isolated iframe with Tailwind CSS and Chart.js",
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

export const GenerativeUIPayloadSchema = HtmlPayloadSchema;

export type HtmlPayload = z.infer<typeof HtmlPayloadSchema>;
export type GenerativeUIPayload = HtmlPayload;

// ─── GenUI Config (for useGenerativeUI hook — text-streaming approach) ───────

/**
 * Action handler called when the AI-generated iframe triggers
 * `copilot.action(name, data)` via the bridge API.
 */
export type GenUIActionHandler = (data: unknown) => unknown | Promise<unknown>;

/**
 * Config for the `useGenerativeUI` hook.
 */
export interface UseGenerativeUIConfig {
  /**
   * Custom actions available inside the iframe.
   * The AI can call these via `copilot.action('name', data)` in onclick handlers.
   *
   * @example
   * ```tsx
   * useGenerativeUI({
   *   actions: {
   *     addToCart: (data) => cartStore.add(data.itemId),
   *     navigate: (data) => router.push(data.url),
   *   },
   * })
   * ```
   */
  actions?: Record<string, GenUIActionHandler>;

  /**
   * Max width of the iframe (CSS value).
   * @default undefined (takes full available width)
   */
  maxWidth?: string;
}

/**
 * A processed message that may contain a `<GENUI>` block.
 */
export interface GenUIMessage {
  id: string;
  role: string;
  content: string | null;
  _genui?: {
    html: string;
    streaming: boolean;
    textBefore: string;
    textAfter: string;
  };
  [key: string]: unknown;
}
