import { invalidProviderResponse } from "./provider-error";

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

export function validateMaxSteps(value: number): void {
  if (!Number.isSafeInteger(value) || value < 1)
    throw new Error("maxSteps must be a positive safe integer");
}
