import { invalidProviderResponse } from "./provider-error";
import type { FinishReason } from "./types";

/** Never turn malformed or truncated provider arguments into an executable empty call. */
export function parseToolArguments(value: unknown): Record<string, unknown> {
  let args = value;
  if (typeof value === "string") {
    try {
      args = JSON.parse(value || "{}");
    } catch {
      throw invalidProviderResponse("Tool arguments are not valid JSON");
    }
  }
  if (args === null || typeof args !== "object" || Array.isArray(args))
    throw invalidProviderResponse("Tool arguments must be a JSON object");
  return args as Record<string, unknown>;
}

export function validateToolCalls(
  calls: readonly { id: string; name: string; args: unknown }[],
): void {
  const ids = new Set<string>();
  for (const call of calls) {
    if (
      !call ||
      typeof call.id !== "string" ||
      !call.id ||
      typeof call.name !== "string" ||
      !call.name ||
      ids.has(call.id)
    )
      throw invalidProviderResponse(
        "Tool calls have missing or duplicate identities",
      );
    ids.add(call.id);
    if (typeof call.args === "string")
      throw invalidProviderResponse("Parsed tool arguments must be an object");
    parseToolArguments(call.args);
  }
}

/**
 * Whether a provider's (raw, OpenAI-format) finish reason can end a turn that made tool calls.
 *
 * OpenAI reports "tool_calls" (legacy "function_call"), but several OpenAI-compatible APIs end a
 * tool-calling turn with "stop": Gemini's OpenAI endpoint does it on every tool call. A "stop" turn
 * is still complete: truncation reports "length" and filtering "content_filter", both rejected here,
 * and a call missing its id or name, or with unparsable arguments, is rejected by validateToolCalls
 * and parseToolArguments. Derived from mapOpenAIFinishReason so the two can never disagree.
 */
export function finishReasonAllowsToolCalls(
  reason: string | null | undefined,
): boolean {
  return mapOpenAIFinishReason(reason, true) === "tool-calls";
}

/**
 * Maps an OpenAI-format finish reason. A turn that made tool calls is reported as "tool-calls" even
 * when the provider says "stop" (Gemini's OpenAI endpoint does), so every OpenAI-format provider and
 * formatter describes the same response the same way.
 */
export function mapOpenAIFinishReason(
  reason: string | null | undefined,
  hasToolCalls = false,
): FinishReason {
  switch (reason) {
    case "stop":
      return hasToolCalls ? "tool-calls" : "stop";
    case "length":
      return "length";
    case "tool_calls":
    case "function_call":
      return "tool-calls";
    case "content_filter":
      return "content-filter";
    default:
      return "unknown";
  }
}

/**
 * Throws unless a turn that made tool calls ended cleanly. `rawArguments` holds each call's argument
 * text as the provider sent it (or an already-parsed object). A "stop" turn carries no tool-call
 * marker confirming the calls finished, so each call must also have received its arguments: missing
 * or blank text would otherwise parse as {} and run the tool with nothing filled in.
 */
export function assertToolTurnComplete(
  reason: string | null | undefined,
  rawArguments: readonly unknown[],
  source: string,
): void {
  if (!rawArguments.length) return;
  if (!finishReasonAllowsToolCalls(reason))
    throw invalidProviderResponse(`${source} ended with incomplete tool calls`);
  if (
    reason === "stop" &&
    rawArguments.some(
      (args) => args == null || (typeof args === "string" && !args.trim()),
    )
  )
    throw invalidProviderResponse(
      `${source} ended with a tool call that has no arguments`,
    );
}

/** One tool call as assembled from streamed chunks. `arguments` is the raw JSON text. */
export interface AssembledToolCall {
  id: string;
  name: string;
  arguments: string;
  extra_content?: Record<string, unknown>;
}

/** A `delta.tool_calls[]` entry of an OpenAI-format stream chunk. */
export interface ToolCallChunk {
  index?: number | null;
  id?: string | null;
  function?: { name?: string | null; arguments?: string | null } | null;
  extra_content?: Record<string, unknown> | null;
}

/**
 * Assembles streamed tool-call chunks into calls. OpenAI gives every parallel call its own `index`
 * and sends `id` and the name once, but OpenAI-compatible APIs differ: a call can arrive whole in
 * one chunk, `index` can be missing or the same for every call (Gemini, older Ollama), and `id` or
 * the name can be repeated on every chunk. Grouping by `index` alone merged parallel calls into one
 * ("firstsecond", "{}{}"); grouping by `id` alone split calls whose id repeats.
 *
 * Where a chunk goes, first match wins:
 * 1. Its `id` is already known: that call. Ids are the only thing every provider keeps stable.
 * 2. No `index`: an unseen id starts a new call (the id is all there is to tell calls apart); a
 *    chunk without an id continues the call the previous chunk went to.
 * 3. With an `index`, the candidate is the latest call at that index; none means a new call.
 * 4. Only a HEADER (an unseen id AND a name) can start another call at an index in use. It does
 *    when the candidate has a different name or already has argument text. Any other chunk
 *    continues the candidate: a server that renews the id mid-call without repeating the name
 *    still yields one call, and a stray chunk with just a new id never opens an empty call.
 *    (A server that renews the id AND repeats the name sends a header every time, so its pieces
 *    become separate calls and the stream is rejected; it never worked, the name was doubled.)
 * 5. A same-name header while the candidate has no argument text yet could be a second call or a
 *    renewed id; it joins the candidate and is remembered. finish() settles it: no arguments
 *    arrived, so every header was its own call (parallel calls to one no-argument tool);
 *    arguments arrived, so nobody can say which call they belong to and the stream is rejected.
 *
 * A repeated name is ignored and a new fragment is appended (as before); the latest id wins (as in
 * the official OpenAI client); argument text is appended in arrival order. Calls come back in the
 * order they began. No text is ever re-parsed, so cost is linear in the stream size.
 * Apart from rule 5 nothing is validated here: callers run assertToolTurnComplete and
 * validateToolCalls on the result, so a stream that cannot be read unambiguously ends as an
 * error, never as a call with the wrong input and never with a call silently missing.
 */
export function createToolCallAssembler(): {
  add(chunk: ToolCallChunk): void;
  finish(): AssembledToolCall[];
} {
  type Building = AssembledToolCall & {
    /** Headers received while the call had no argument text yet (see rule 5). */
    headers: Array<{ id: string; extra_content?: Record<string, unknown> }>;
  };
  const building: Building[] = [];
  const byId = new Map<string, Building>();
  const latestAtIndex = new Map<number, Building>();
  let previous: Building | undefined;

  return {
    add(chunk) {
      const id = chunk.id || "";
      const name = chunk.function?.name || "";
      const args = chunk.function?.arguments || "";
      const hasIndex = typeof chunk.index === "number";

      let call = id ? byId.get(id) : undefined;
      if (!call) {
        const candidate = hasIndex
          ? latestAtIndex.get(chunk.index as number)
          : previous;
        const isHeader = id !== "" && name !== "";
        const startsNewCall =
          !candidate ||
          (!hasIndex && id !== "") ||
          (isHeader &&
            ((candidate.name !== "" && candidate.name !== name) ||
              candidate.arguments !== ""));
        if (startsNewCall) {
          call = { id: "", name: "", arguments: "", headers: [] };
          building.push(call);
        } else call = candidate as Building;
        if (isHeader && call.arguments === "")
          call.headers.push({
            id,
            ...(chunk.extra_content
              ? { extra_content: chunk.extra_content }
              : {}),
          });
      }

      if (id) {
        call.id = id;
        if (!byId.has(id)) byId.set(id, call);
      }
      if (name && name !== call.name) call.name += name;
      if (args) call.arguments += args;
      if (chunk.extra_content) call.extra_content = chunk.extra_content;
      if (hasIndex) latestAtIndex.set(chunk.index as number, call);
      previous = call;
    },
    finish() {
      return building.flatMap(({ headers, ...call }): AssembledToolCall[] => {
        if (headers.length < 2) return [call];
        if (call.arguments !== "")
          throw invalidProviderResponse(
            "Tool call stream is ambiguous: arguments cannot be matched to one of several calls",
          );
        return headers.map((header) => ({
          id: header.id,
          name: call.name,
          arguments: "",
          ...(header.extra_content
            ? { extra_content: header.extra_content }
            : {}),
        }));
      });
    },
  };
}

export function validateMaxSteps(value: number): void {
  if (!Number.isSafeInteger(value) || value < 1)
    throw new Error("maxSteps must be a positive safe integer");
}
