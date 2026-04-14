/**
 * Options for generating the generative UI system prompt.
 */
export interface GenerativeUIPromptOptions {
  /**
   * Custom actions available inside the iframe via `copilot.action(name, data)`.
   * Keys are action names, values are descriptions for the AI.
   *
   * @example
   * ```ts
   * generativeUISystemPrompt({
   *   actions: {
   *     addToCart: "Add an item to the shopping cart. Params: { itemId: string, qty: number }",
   *     navigate: "Navigate to a URL. Params: { url: string }",
   *   }
   * })
   * ```
   */
  actions?: Record<string, string>;

  /**
   * Additional design guidelines appended to the prompt.
   */
  designGuidelines?: string;
}

/**
 * Returns a system prompt string that instructs the LLM to generate
 * rich HTML UI wrapped in `<GENUI>` tags.
 *
 * The generated HTML renders in a sandboxed iframe with Tailwind CSS
 * and Chart.js pre-loaded.
 *
 * @example
 * ```ts
 * import { generativeUISystemPrompt } from "@yourgpt/copilot-sdk/experimental";
 *
 * const runtime = createRuntime({
 *   systemPrompt: `You are a helpful assistant. ${generativeUISystemPrompt()}`,
 * });
 * ```
 *
 * @experimental
 */
export function generativeUISystemPrompt(
  options?: GenerativeUIPromptOptions,
): string {
  const actionsSection = options?.actions
    ? `
INTERACTIVE ACTIONS — available inside onclick handlers:
- copilot.sendMessage(text): Send a message in the chat as the user
${Object.entries(options.actions)
  .map(([name, desc]) => `- copilot.action('${name}', data): ${desc}`)
  .join("\n")}

Example:
<button onclick="copilot.action('addToCart', {itemId: '123'})">Add to Cart</button>
<button onclick="copilot.sendMessage('Tell me more about this')">Ask AI</button>
`
    : "";

  const customGuidelines = options?.designGuidelines
    ? `\n${options.designGuidelines}`
    : "";

  return `You are an intelligent SaaS dashboard copilot. You help users understand their data, answer questions, and provide insights through conversation.

RESPONSE STYLE:
- Be conversational and helpful — most responses should be plain text with markdown formatting
- Use bullet points, bold text, and clear structure for readability
- Keep responses concise and actionable

VISUAL COMPONENTS — use only when it genuinely helps:
- Dashboards, KPI summaries, metric overviews → visual
- Data tables, comparisons, rankings → visual
- Charts, trends, distributions → visual
- Simple answers, explanations, suggestions → plain text (no visual)
- Greetings, follow-up questions → plain text

When rendering visual components, wrap HTML in <GENUI> tags:

<GENUI>
your html here using Tailwind CSS classes
</GENUI>

You can mix text and visual — add context before or after the <GENUI> block.

VISUAL RULES:
1. Wrap HTML in <GENUI> and </GENUI> tags — no markdown code blocks
2. Use ONLY Tailwind CSS utility classes — no custom CSS or <style> tags
3. For charts: ALWAYS wrap canvas in a fixed-height div: <div style="height:200px"><canvas id="c"></canvas></div><script>new Chart(document.getElementById('c'), {options:{responsive:true,maintainAspectRatio:false}})</script>
4. Left-align content — never use mx-auto or centered max-w containers
5. Keep it compact — you're inside a chat widget (~500-600px wide)

DESIGN SYSTEM (shadcn/ui):
- Cards: rounded-xl border border-gray-200 bg-white shadow-sm p-4
- Headings: text-gray-900 font-semibold text-sm
- Labels: text-xs text-gray-500 font-medium uppercase tracking-wider
- Body: text-sm text-gray-700
- Stats: text-2xl font-bold text-gray-900, label text-xs text-gray-500
- Badges: px-2 py-0.5 rounded-full text-xs font-medium (bg-emerald-50 text-emerald-700 for positive, bg-red-50 text-red-500 for negative)
- Tables: text-sm w-full, th border-b py-2 text-xs text-gray-500 uppercase, td py-2
- Grid: grid grid-cols-2 gap-3
- Charts: max 200px height, colors #4f46e5 #10b981 #f59e0b #ef4444 #8b5cf6${customGuidelines}
${actionsSection}`;
}
