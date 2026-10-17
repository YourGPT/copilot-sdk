import {
  requiresOpenAIResponses,
  type OpenAIParameterOptions,
} from "./openai-parameters";

/** Responses-only options. Omitted values retain the API's defaults. */
export interface OpenAIResponsesOptions {
  store?: boolean;
  /** Send only new input after this stored response; do not also resend its history. */
  previousResponseId?: string;
  include?: string[];
  reasoningSummary?: "auto" | "concise" | "detailed";
  promptCacheKey?: string;
  /** Legacy retention option for models that support it. */
  promptCacheRetention?: "in_memory" | "24h";
  /** GPT-5.6+ cache mode and minimum lifetime; provider/model support varies. */
  promptCacheOptions?: { mode?: "implicit" | "explicit"; ttl?: "30m" };
}

export interface OpenAITransportOptions {
  /** auto preserves existing routing; responses also works without function tools. */
  api?: "auto" | "chat" | "responses";
  responses?: OpenAIResponsesOptions;
}

/** Opaque provider items: retain their complete contents and order for replay. */
export interface OpenAIResponseItem {
  type: string;
  [key: string]: unknown;
}

export interface OpenAIResponseMetadata {
  id?: string;
  model?: string;
  status?: string;
  output: OpenAIResponseItem[];
  usage?: Record<string, unknown>;
  store?: boolean;
  refusals: string[];
}

export interface ProviderMetadata {
  openai?: { response?: OpenAIResponseMetadata };
  [provider: string]: unknown;
}

export function resolveOpenAITransport(
  defaults: OpenAITransportOptions,
  overrides?: OpenAITransportOptions,
): OpenAITransportOptions {
  return {
    api: overrides?.api ?? defaults.api ?? "auto",
    responses:
      defaults.responses !== undefined || overrides?.responses !== undefined
        ? { ...defaults.responses, ...overrides?.responses }
        : undefined,
  };
}

export function useOpenAIResponses(
  model: string,
  baseURL: string | undefined,
  parameters: OpenAIParameterOptions,
  transport: OpenAITransportOptions,
  hasTools: boolean,
  hasReplay: boolean,
  nativeToolSearch = false,
): boolean {
  const api = transport.api ?? "auto";
  if (!["auto", "chat", "responses"].includes(api)) {
    throw new Error(`Unknown OpenAI API selection: ${api}`);
  }
  if (api === "chat") {
    if (transport.responses !== undefined || nativeToolSearch) {
      throw new Error(
        "Responses options and native tool search require the Responses API",
      );
    }
    return false;
  }
  let officialEndpoint = !baseURL;
  try {
    officialEndpoint =
      !baseURL || new URL(baseURL).hostname === "api.openai.com";
  } catch {
    /* Custom/invalid endpoints retain legacy routing. */
  }
  return (
    api === "responses" ||
    transport.responses !== undefined ||
    (hasReplay && officialEndpoint) ||
    nativeToolSearch ||
    (hasTools && requiresOpenAIResponses(model, baseURL, parameters))
  );
}

export function responseMetadata(response: any): ProviderMetadata {
  const output: OpenAIResponseItem[] = Array.isArray(response?.output)
    ? response.output
    : [];
  return {
    openai: {
      response: {
        id: response?.id,
        model: response?.model,
        status: response?.status,
        output,
        usage: response?.usage,
        store: response?.store,
        refusals: output.flatMap((item: any) =>
          item?.type === "message" && Array.isArray(item.content)
            ? item.content
                .filter(
                  (part: any) =>
                    part?.type === "refusal" &&
                    typeof part.refusal === "string",
                )
                .map((part: any) => part.refusal)
            : [],
        ),
      },
    },
  };
}

/**
 * Conversation state is not a diagnostics envelope. Keep only the fields needed
 * to replay assistant/function/reasoning items; never persist native usage,
 * logprobs, annotations, reasoning summaries or arbitrary provider extensions.
 * Full metadata remains available on the server-side model result.
 */
export function responseReplayMetadata(
  metadata: ProviderMetadata | undefined,
): ProviderMetadata | undefined {
  const response = metadata?.openai?.response;
  if (!response) return metadata;
  const output = response.output.map((item) => {
    const fields = ["type", "id", "status"];
    switch (item.type) {
      case "reasoning":
        fields.push("encrypted_content");
        break;
      case "message":
        fields.push("role", "phase");
        break;
      case "function_call":
        fields.push("call_id", "name", "namespace", "arguments");
        break;
      case "tool_search_call":
        fields.push("call_id", "execution", "arguments");
        break;
      case "tool_search_output":
        fields.push("call_id", "tools");
        break;
      case "web_search_call":
        fields.push("action");
        break;
      default:
        // Native tool items can require their own state for replay. Strip
        // item-level diagnostics while retaining provider-defined tool state.
        return stripItemDiagnostics(item) as OpenAIResponseItem;
    }
    const replay = Object.fromEntries(
      fields
        .filter((key) => item[key] !== undefined)
        .map((key) => [key, item[key]]),
    ) as OpenAIResponseItem;
    if (item.type === "reasoning") replay.summary = [];
    if (item.type === "message")
      replay.content = Array.isArray(item.content)
        ? item.content.flatMap<Record<string, unknown>>((part: any) =>
            part?.type === "output_text" && typeof part.text === "string"
              ? [{ type: "output_text", text: part.text, annotations: [] }]
              : part?.type === "refusal" && typeof part.refusal === "string"
                ? [{ type: "refusal", refusal: part.refusal }]
                : [],
          )
        : [];
    return stripItemDiagnostics(replay) as OpenAIResponseItem;
  });
  return { openai: { response: { output, refusals: [] } } };
}

function stripItemDiagnostics(item: OpenAIResponseItem): OpenAIResponseItem {
  // Do not recursively strip arbitrary tool data or JSON schemas: a tool may
  // legitimately define fields named "usage", "metadata" or "logprobs".
  const {
    usage: _usage,
    logprobs: _logprobs,
    metadata: _metadata,
    ...state
  } = item;
  return state;
}

export function getResponseReplay(
  metadata: unknown,
): OpenAIResponseItem[] | undefined {
  const response = (metadata as ProviderMetadata | undefined)?.openai?.response;
  if (response === undefined) return undefined;
  if (
    !Array.isArray(response.output) ||
    response.output.some((item) => !item || typeof item.type !== "string")
  ) {
    throw new Error(
      "Invalid OpenAI Responses replay metadata: output must contain typed items",
    );
  }
  return responseReplayMetadata(metadata as ProviderMetadata)?.openai?.response
    ?.output;
}
