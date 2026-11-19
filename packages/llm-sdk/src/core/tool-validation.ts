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
 * Whether a provider's finish reason can end a turn that made tool calls.
 *
 * OpenAI reports "tool_calls" (legacy "function_call"), but several OpenAI-compatible APIs end a
 * tool-calling turn with "stop": Gemini's OpenAI endpoint does it on every tool call. A "stop" turn
 * is still complete: truncation reports "length" and filtering "content_filter", both rejected here,
 * and a call missing its id or name, or with unparsable arguments, is rejected by validateToolCalls
 * and parseToolArguments. Accepts raw ("tool_calls") and mapped ("tool-calls") reasons.
 */
export function finishReasonAllowsToolCalls(
  reason: string | null | undefined,
): boolean {
  return (
    reason === "tool_calls" ||
    reason === "function_call" ||
    reason === "tool-calls" ||
    reason === "stop"
  );
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
 * text as the provider sent it. A "stop" turn carries no tool-call marker confirming the calls
 * finished, so each call must also have received argument text: an empty string would otherwise
 * parse as {} and run the tool with nothing filled in.
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
    rawArguments.some((args) => typeof args !== "string" || !args.trim())
  )
    throw invalidProviderResponse(
      `${source} ended with a tool call that has no arguments`,
    );
}

/**
 * Returns a function that picks the slot a streamed tool-call chunk belongs to. OpenAI tags every
 * chunk with `index`, but some OpenAI-compatible APIs (Gemini's) can omit it; defaulting to slot 0
 * merged parallel calls into one ("firstsecond", "{}{}"). Without an index, a chunk with an `id`
 * gets that call's slot, and a chunk with neither continues the call before it.
 */
export function createToolCallSlotter(): (part: {
  index?: number | null;
  id?: string | null;
}) => string {
  let previous: string | undefined;
  return (part) => {
    const key =
      typeof part.index === "number"
        ? `index:${part.index}`
        : part.id
          ? `id:${part.id}`
          : (previous ?? "index:0");
    previous = key;
    return key;
  };
}

export function validateMaxSteps(value: number): void {
  if (!Number.isSafeInteger(value) || value < 1)
    throw new Error("maxSteps must be a positive safe integer");
}
