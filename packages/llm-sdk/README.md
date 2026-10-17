# @yourgpt/llm-sdk

Multi-provider LLM SDK with streaming. One API, any provider.

## Installation

```bash
npm install @yourgpt/llm-sdk @anthropic-ai/sdk
```

> For other providers (OpenAI, Google, xAI), see [Providers Documentation](https://copilot-sdk.yourgpt.ai/docs/providers).

## OpenAI reasoning parameters

The SDK normalizes token limits and sampling options for recognized OpenAI model
families, including GPT-6. Reasoning stays enabled by default. An unsupported
`temperature` is omitted with a warning; the SDK does not silently disable
reasoning. Use `onWarning` in the OpenAI provider configuration to handle these
warnings yourself.

For a model that supports non-reasoning mode, select it explicitly when sampling
control is required:

```ts
import { generateText } from "@yourgpt/llm-sdk";
import { openai } from "@yourgpt/llm-sdk/openai";

const result = await generateText({
  model: openai("gpt-6-luna"),
  prompt: "Classify this request.",
  reasoningEffort: "none",
  temperature: 0,
});
```

`reasoningEffort` can also be set on `createOpenAI(...)` or `OpenAIAdapter` and
overridden in a Runtime request's `config`. Unsupported `none`/`minimal` settings
for recognized reasoning models fail before the provider request.

On OpenAI's own endpoint, GPT-5.4+ and GPT-6 tool requests with reasoning use the
existing Responses transport, in both Runtime and modern generation. Custom
endpoints keep Chat routing. Servers with different parameter rules can set
`parameterPolicy: "passthrough"` on the OpenAI provider. Responses requires an
installed OpenAI client that exposes `responses.create`; older clients fail with
an actionable error. This routing does not add the separate Decisions API.

## OpenAI Responses and continuation

Select Responses explicitly, including calls without tools:

```ts
import { generateText, streamText } from "@yourgpt/llm-sdk";
import { openai, createOpenAI } from "@yourgpt/llm-sdk/openai";

const model = openai("gpt-6-luna", {
  api: "responses",
  responses: { store: false },
});
const first = await generateText({ model, prompt: "Remember code ORBIT-42." });
const next = await streamText({
  model,
  messages: [
    ...first.response.messages,
    { role: "user", content: "What was the code?" },
  ],
});
console.log(await next.text);
const history = (await next.response).messages;
const providerState = await next.providerMetadata;
```

`api` accepts `"auto"` (the existing default routing), `"chat"`, and `"responses"`.
Responses options also select Responses. Default custom-endpoint routing remains
Chat; opt into Responses only when that endpoint implements it. Azure and other
compatible services are not certified by the OpenAI tests. Supplying
Responses-only options with `api: "chat"` fails before a network request.

The same options work on `createOpenAI({ api, responses })` for Runtime, and on
`OpenAIAdapter`. Per-call overrides use `generateText({ openai: { api, responses },
... })` or `runtime.chat({ config: { openai: { api, responses } }, ... })`.
Request values override provider defaults. `reasoningEffort` remains a separate
existing option; `responses.reasoningSummary` requests a reasoning summary.

**Stateless replay:** use `store: false` and preserve the returned message objects,
including `providerMetadata`. Each assistant's `providerMetadata.openai.response`
contains minimal ordered continuation items, including function-call IDs, assistant
phase and completed encrypted reasoning. It excludes the raw response envelope,
native usage, logprobs, reasoning summaries and output-text annotations. Native
tool state needed for replay is retained with diagnostic fields removed. Streams
use completed items, never partially streamed reasoning. Keep this state intact
and within its original conversation; do not treat it as trusted authorization.

The separate **server-side model result** `providerMetadata` still contains the
full response ID, status, native usage and output for diagnostics and stored
continuation. Do not forward that complete model result to a public client.
`runtime.chat()` retains top-level `usage` for billing and `events` for debugging;
after billing, omit both before serializing it:

```ts
const result = await runtime.chat(request);
await recordBilling(result.usage);
const { usage, events, ...clientResult } = result;
return Response.json(clientResult);
```

SSE response helpers omit usage by default. `runtime.stream(...).toResponse({
includeUsage: true })` explicitly enables it for a server-controlled raw API.

`generateText().response.messages` now includes the final assistant turn as well
as tool turns. `streamText().response` returns the same complete history after
consuming its shared execution; accessing it does not make a second API call.
The Copilot client preserves provider state through JSON/SSE tool continuation
and serialized UI-message restoration. Custom `StorageAdapter` implementations
must retain `StorageMessage.metadata.providerMetadata`; map it back to the
message's top-level `providerMetadata` when restoring. The existing YourGPT cloud
storage adapter stores display/tool records and does **not** yet guarantee
lossless Responses replay after a remote session reload.

**Stored continuation:** explicitly use `store: true`, take the returned
`generateText(...).providerMetadata.openai.response.id` (the server result, not
the saved message metadata), and pass it as
`openai: { responses: { previousResponseId: id } }` on the next call. Send only new
input after that response, and resend system instructions; do not also resend
its entire history. The SDK does not automatically advance or persist response
IDs. If `store` is omitted, the provider default is unchanged (OpenAI currently
stores Responses by default).

Other supported Responses options are `include`, `promptCacheKey`,
`promptCacheOptions` (`mode`, `ttl`) and legacy `promptCacheRetention`
(`"in_memory"` or `"24h"`). With `store: false`, `reasoning.encrypted_content` is
included automatically. Cache options are forwarded; availability and retention
support remain model-specific. Raw usage preserves cache/reasoning breakdowns;
this does not add pricing/accounting logic.

Modern Responses accepts image URLs, data URLs/bytes, and file URL/base64 inputs.
This does not add generalized image-bearing function results, native MCP approval
flows, background jobs, or Decisions. Failed/incomplete/cancelled streams do not
produce executable partial function calls or a successful final result.

The contracts were checked against [OpenAI conversation state](https://developers.openai.com/api/docs/guides/conversation-state),
[Responses request fields](https://developers.openai.com/api/reference/resources/responses/methods/create),
and [Vercel's OpenAI provider](https://ai-sdk.dev/providers/ai-sdk-providers/openai).
Offline checks run with `pnpm --filter @yourgpt/llm-sdk test`; Copilot integration
checks run with `pnpm test:compatibility` after building both SDKs. The optional
`test/live/responses.cjs` runner requires `RUN_OPENAI_LIVE=1` and a privately
supplied `OPENAI_API_KEY`; it makes real requests and deletes its synthetic stored
responses after testing continuation.

## Compatibility fallback

Transient failures retain bounded retries and fallback. Compatibility errors such
as an unsupported parameter stop by default. To advance to another model for a
specific compatibility error without repeating the same invalid request, use
`fallbackErrors` independently of `retryableErrors`:

```ts
import { createFallbackChain } from "@yourgpt/llm-sdk/fallback";
import { createOpenAI } from "@yourgpt/llm-sdk/openai";

const provider = createOpenAI();
const adapter = createFallbackChain({
  models: [
    provider.languageModel("gpt-6-luna"),
    provider.languageModel("gpt-4o"),
  ],
  retries: 2,
  fallbackErrors(error) {
    const e = error as { status?: number; code?: string; param?: string };
    return (
      e?.status === 400 &&
      e.code === "unsupported_parameter" &&
      e.param === "temperature"
    );
  },
});
```

This is an additional fallback policy for otherwise non-retryable errors. It does
not disable transient retries. Keep the predicate narrow; do not match every 400
or use `retryableErrors: () => true` for compatibility failures. Cancellation and
errors after stream output or tool events never retry or switch models. Provider
status/code/parameter fields survive OpenAI streaming errors; raw error causes
are retained only in-process and omitted from JSON/SSE output.

Stream readers and final-result promises share one execution, including tool
execution. Later readers replay retained stream parts; pass an abort signal to
cancel generation. Cancellation during a tool stops subsequent tools and rejects
the result rather than reporting a successful completion.
`pnpm --filter @yourgpt/llm-sdk test` builds the package and
runs offline provider/fallback regression tests without real API credentials.

## Quick Start

```ts
// app/api/chat/route.ts
import { streamText } from "@yourgpt/llm-sdk";
import { anthropic } from "@yourgpt/llm-sdk/anthropic";

export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = await streamText({
    model: anthropic("claude-sonnet-4-20250514"),
    system: "You are a helpful assistant.",
    messages,
  });

  return result.toTextStreamResponse();
}
```

```bash
# .env.local
ANTHROPIC_API_KEY=sk-ant-...
```

## With Copilot SDK

Use `createRuntime` for full Copilot SDK integration with tools support:

```ts
// app/api/chat/route.ts
import { createRuntime } from "@yourgpt/llm-sdk";
import { createAnthropic } from "@yourgpt/llm-sdk/anthropic";

const runtime = createRuntime({
  provider: createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY }),
  model: "claude-sonnet-4-20250514",
  systemPrompt: "You are a helpful assistant.",
});

export async function POST(req: Request) {
  return runtime.stream(await req.json()).toResponse();
}
```

For Anthropic, Runtime accepts system instructions through either `systemPrompt`
or `{ role: "system", content: "..." }` messages. It combines them into
Anthropic's top-level `system` field: the request's nonempty `systemPrompt` (or
the runtime default) first, followed by system messages in order. System messages
are removed from the conversation sent to Anthropic. This applies to `chat`,
`generate`, `stream`, and `processChat`. If the same text is supplied through both
forms, the explicit prompt is sent once. Null, non-text values and unsupported
system blocks are ignored for proxy compatibility; valid text blocks are retained.
Repeated message-only instructions are preserved in order.

```ts
const decision = await runtime.chat({
  systemPrompt: "Classify the email. Do not answer it.",
  messages: [{ role: "user", content: emailContext }],
});
```

The published `2.6.0-beta.1` Runtime adapter silently dropped system-role
messages; use the explicit `systemPrompt` form above until you upgrade to a release
containing this fix. The separate `generateText`/`streamText` Anthropic provider
already handles system-role messages.

## Selective Tool Loading

`llm-sdk` can now narrow tools before they reach the provider. This is opt-in and works with both local ranking and provider-native hints.

```ts
import { createRuntime, type ToolDefinition } from "@yourgpt/llm-sdk";
import { createOpenAI } from "@yourgpt/llm-sdk/openai";

const tools: ToolDefinition[] = [
  {
    name: "search_docs",
    description: "Search product docs",
    location: "server",
    category: "knowledge",
    profiles: ["support", "research"],
    searchKeywords: ["docs", "kb", "help"],
    inputSchema: { type: "object", properties: { query: { type: "string" } } },
    handler: async ({ query }) => ({ query }),
  },
  {
    name: "get_time",
    description: "Get current time",
    location: "server",
    category: "utility",
    profiles: ["utility"],
    deferLoading: true,
    inputSchema: { type: "object", properties: {} },
    handler: async () => ({ now: new Date().toISOString() }),
  },
];

const runtime = createRuntime({
  provider: createOpenAI({ apiKey: process.env.OPENAI_API_KEY }),
  model: "gpt-4o-mini",
  tools,
  agentLoop: {
    enabled: true,
    toolSelection: {
      enabled: true,
      defaultProfile: "support",
      search: {
        enabled: true,
        maxResults: 4,
        exposeWhenToolCountExceeds: 1,
      },
      dynamicSelection: { enabled: true, maxTools: 2 },
      nativeProviderHints: {
        openai: { toolChoice: "single", parallelToolCalls: false },
      },
    },
  },
});

// Request body can override the active profile:
// { "messages": [...], "toolProfile": "utility" }
```

When `search.enabled` is on, deferred tools can be discovered through a hidden `search_tools` server tool. Matching tools are loaded into the next loop iteration instead of sending every deferred tool definition up front.

## Documentation

Visit **[copilot-sdk.yourgpt.ai](https://copilot-sdk.yourgpt.ai)** for full documentation:

- [All Providers](https://copilot-sdk.yourgpt.ai/docs/providers) - OpenAI, Anthropic, Google, xAI
- [Server Setup](https://copilot-sdk.yourgpt.ai/docs/server) - Runtime, streaming, tools
- [Tools](https://copilot-sdk.yourgpt.ai/docs/tools) - Server-side and client-side tools
- [LLM SDK Reference](https://copilot-sdk.yourgpt.ai/docs/llm-sdk) - streamText, generateText

## License

MIT

### Image tool results and recorded audio

Tools can return native image content using `toModelOutput` or the existing `_aiContent` field. Supported endpoints are OpenAI Responses and Anthropic. Raw application results remain available, and model-facing output survives tool continuation and serialized history. Unsupported endpoints reject image output explicitly.

`generateSpeech` / `transcribe` are separate server audio helpers, with `openaiSpeech` / `openaiTranscription` factories from `@yourgpt/llm-sdk/openai`. They support cancellation, validated encoded audio, and response metadata. Copilot's `VoiceRecorder` and `transcribeRecording` provide recorded microphone input and a reviewable transcript.

See [image and audio contracts, examples, and limitations](./docs/multimodal-and-audio.md). Realtime voice calls and image generation are separate follow-ups.

### Beta compatibility fixes

OpenAI-compatible Chat transports preserve raw structured tool-message content
instead of coercing arrays or objects to `[object Object]`. The SDK's explicit
`modelOutput` representation still uses provider-specific conversion. This does
not make every provider accept arbitrary object content; the provider validates
its own schema. Use its supported content-part format for live calls.

Malformed Responses function calls are rejected before tool execution with
`status: 502`, `code: "INVALID_PROVIDER_RESPONSE"`. The fallback chain can retry or
fall back according to its configured policy before any content has been emitted.
It does not switch models after streaming content or tool execution has started.
`generateText` also accepts model results that omit the optional `toolCalls` field.
