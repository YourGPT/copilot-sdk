import type { ErrorEvent } from "./stream-events";

/** A malformed upstream response is a provider failure, not invalid user input. */
export function invalidProviderResponse(message: string): Error {
  return Object.assign(new Error(message), {
    name: "InvalidProviderResponseError",
    status: 502,
    code: "INVALID_PROVIDER_RESPONSE",
  });
}

/** Keep machine-readable provider fields without serializing SDK request objects. */
export function providerErrorEvent(error: unknown, code: string): ErrorEvent {
  const details = (error ?? {}) as Record<string, unknown>;
  const event: ErrorEvent = {
    type: "error",
    message: error instanceof Error ? error.message : String(error),
    code,
    ...(typeof details.status === "number" ? { status: details.status } : {}),
    ...(typeof details.code === "string" ? { providerCode: details.code } : {}),
    ...(typeof details.param === "string" ? { param: details.param } : {}),
    ...(typeof details.request_id === "string"
      ? { requestId: details.request_id }
      : {}),
  };
  // Available to an in-process fallback chain; excluded from JSON/SSE output.
  Object.defineProperty(event, "cause", { value: error, enumerable: false });
  return event;
}

export function errorFromEvent(event: ErrorEvent): Error {
  if (event.cause instanceof Error) return event.cause;
  return Object.assign(new Error(event.message), {
    status: event.status,
    code: event.providerCode ?? event.code,
    param: event.param,
    request_id: event.requestId,
  });
}

export function throwIfAborted(signal?: AbortSignal): void {
  if (!signal?.aborted) return;
  const error = new Error("The operation was aborted");
  error.name = "AbortError";
  throw error;
}

export function isAbortError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return (
    error.name === "AbortError" ||
    error.constructor.name === "APIUserAbortError" ||
    /^(aborted|the operation was aborted|the user aborted a request)/i.test(
      error.message,
    )
  );
}
