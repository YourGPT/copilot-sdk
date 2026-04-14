/**
 * @yourgpt/copilot-sdk/experimental
 *
 * Experimental generative UI — lets the LLM render rich HTML components
 * (with Tailwind CSS + Chart.js) inline in the chat.
 *
 * Two approaches:
 * 1. Text-streaming (recommended): LLM writes HTML in <GENUI> tags,
 *    rendered progressively in sandboxed iframes.
 * 2. Tool-based: LLM calls render_ui tool, result rendered via toolRenderers.
 *
 * APIs in this module may change without a semver major bump.
 *
 * @experimental
 *
 * @example
 * ```tsx
 * // Backend
 * import { generativeUISystemPrompt } from "@yourgpt/copilot-sdk/experimental";
 * const runtime = createRuntime({
 *   systemPrompt: generativeUISystemPrompt(),
 * });
 *
 * // Frontend
 * import { useGenerativeUI } from "@yourgpt/copilot-sdk/experimental";
 * const { wrapMessage } = useGenerativeUI();
 * <CopilotChat wrapMessage={wrapMessage} />
 * ```
 */

// ── Text-streaming approach (recommended) ────────────────────────────────────
export { useGenerativeUI } from "./useGenerativeUI";
export { generativeUISystemPrompt } from "./generativeUIPrompt";
export type { GenerativeUIPromptOptions } from "./generativeUIPrompt";
export { GenUIFrame } from "./renderers/GenUIFrame";
export type { GenUIFrameProps } from "./renderers/GenUIFrame";

// ── Tool-based approach (legacy) ─────────────────────────────────────────────
export { generativeUITool } from "./generativeUITool";
export type { GenerativeUIToolConfig } from "./generativeUITool";

// ── Types & schemas ──────────────────────────────────────────────────────────
export { GenerativeUIPayloadSchema, HtmlPayloadSchema } from "./types";
export type {
  GenerativeUIPayload,
  HtmlPayload,
  UseGenerativeUIConfig,
  GenUIActionHandler,
  GenUIMessage,
} from "./types";

// ── Renderers ────────────────────────────────────────────────────────────────
export { HtmlRenderer } from "./renderers/HtmlRenderer";
