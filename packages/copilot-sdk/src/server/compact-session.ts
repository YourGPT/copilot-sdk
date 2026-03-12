/**
 * compactSession — server-side summarization helper
 *
 * Call this in your /api/compact route handler.
 * Uses a structured prompt that preserves all semantically important content.
 *
 * @example
 * ```ts
 * // app/api/compact/route.ts
 * import { compactSession } from '@yourgpt/copilot-sdk/server';
 *
 * export async function POST(req: Request) {
 *   const { messages, existingSummary, workingMemory } = await req.json();
 *   const summary = await compactSession({ messages, existingSummary, workingMemory });
 *   return Response.json({ summary });
 * }
 * ```
 */

export interface CompactSessionOptions {
  messages: Array<{ role: string; content?: string | null }>;
  existingSummary?: string | null;
  workingMemory?: string[];
  /**
   * Model to use for summarization.
   * @default 'claude-haiku-4-5' (cheaper model fine for summaries)
   */
  model?: string;
  /** Max tokens for the summary output. @default 1024 */
  maxSummaryTokens?: number;
  /** Custom fetch implementation (for non-browser environments). */
  fetchImpl?: typeof fetch;
  /** Anthropic API key. Falls back to process.env.ANTHROPIC_API_KEY. */
  apiKey?: string;
  /** Base URL for Anthropic API. @default 'https://api.anthropic.com' */
  apiBaseUrl?: string;
}

export interface CompactSessionResult {
  summary: string;
}

const COMPACTION_PROMPT = `You are summarizing a conversation to preserve its key context while reducing token usage. Create a structured summary that includes:

1. **User's primary goals and requests** — what the user is trying to accomplish
2. **Technical decisions made** — libraries chosen, schemas designed, approaches selected
3. **Tool call outcomes** — what tools were called, key arguments, result status and brief outcome
4. **Errors encountered** — what went wrong and how it was resolved
5. **User messages** — verbatim if short (<50 words), paraphrased if long
6. **Pending tasks** — unresolved questions or next steps mentioned
7. **Current work state** — what was in progress when this summary was created

Rules:
- Preserve ALL specific values: file names, variable names, URLs, error messages, IDs
- Be detailed on recent work, more concise on earlier work
- Output structured prose (not bullet JSON)
- Do NOT include meta-commentary about the summarization itself`;

export async function compactSession(
  options: CompactSessionOptions,
): Promise<CompactSessionResult> {
  const {
    messages,
    existingSummary,
    workingMemory = [],
    model = "claude-haiku-4-5-20251001",
    maxSummaryTokens = 1024,
    fetchImpl = fetch,
    apiKey = typeof process !== "undefined"
      ? process.env.ANTHROPIC_API_KEY
      : undefined,
    apiBaseUrl = "https://api.anthropic.com",
  } = options;

  if (!apiKey) {
    throw new Error(
      "compactSession: No API key provided. Set ANTHROPIC_API_KEY or pass options.apiKey.",
    );
  }

  // Build the content to summarize
  const parts: string[] = [];

  if (workingMemory.length > 0) {
    parts.push(
      `[Working memory — always preserve these facts]\n${workingMemory.join("\n")}`,
    );
  }

  if (existingSummary) {
    parts.push(`[Previous summary — extend/update this]\n${existingSummary}`);
  }

  const conversationText = messages
    .map((m) => `${m.role.toUpperCase()}: ${m.content ?? "(no content)"}`)
    .join("\n\n");

  parts.push(`[Conversation to summarize]\n${conversationText}`);

  const userContent = parts.join("\n\n---\n\n");

  const response = await fetchImpl(`${apiBaseUrl}/v1/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: maxSummaryTokens,
      system: COMPACTION_PROMPT,
      messages: [{ role: "user", content: userContent }],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(
      `compactSession: Anthropic API error ${response.status}: ${err}`,
    );
  }

  const data = (await response.json()) as {
    content: Array<{ type: string; text: string }>;
  };

  const summary = data.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");

  return { summary };
}
