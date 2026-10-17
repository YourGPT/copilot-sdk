# LLM SDK 2.6.0-beta.3 — compatibility hotfix

Prepared for npm `beta` from the current beta base `321bef0`, with only the five compatibility/privacy fixes from `605c38c`. The source package version is `2.6.0-beta.3`. Publication awaits explicit version confirmation.

Decisions, realtime voice, image generation/editing and the new playground remain on the separate next-beta branch and are excluded from this package. Copilot SDK stays at `2.5.1-beta.3`; it has no source changes in this release.

## Fixed

- **Structured tool results:** the OpenAI-compatible raw-message path no longer applies `String(content)` to tool results. Arrays and objects reach the provider unchanged. Explicit `modelOutput` still takes the intended text conversion path. Regression coverage exercises the actual runtime proxy shape for OpenAI, Google, xAI, Fireworks and OpenRouter, in streaming and complete modes. Provider schemas still apply: preserving an object does not guarantee that the provider accepts it.
- **Anthropic system content:** null, non-text values and unsupported blocks no longer throw. Valid text blocks are retained. An explicit system prompt duplicated by a system message is sent once. Distinct instructions and intentionally repeated message-only instructions keep their order. The original system-role fix remains in place.
- **Responses privacy:** saved conversation messages and Runtime events receive reduced continuation metadata. Raw response IDs/status/model/usage and diagnostic extensions stay on the server-side model result. Reasoning summaries and message logprobs/annotations are excluded from replay; required encrypted reasoning, assistant phase and tool identifiers survive. Native tool state is retained with usage/logprobs/metadata diagnostics removed. The default SSE path strips top-level usage; `includeUsage: true` remains an explicit opt-in.
- **Malformed Responses function calls:** retain strict validation, but report an upstream failure (`502`, `INVALID_PROVIDER_RESPONSE`) so the configured fallback policy can recover before any tools execute. Once a stream has emitted content, existing no-replay behavior remains.
- **Optional tool calls:** `generateText` no longer dereferences `.length` when a custom model omits `toolCalls`.

## Application follow-through

The Core checkout's `app/Controllers/Api/Users/Product/Chatbot/ExtensionController.js` returned `chatResult` directly after billing. A separate local patch now omits top-level `usage` and debug `events` from its client response, retaining the conversation payload. Billing still reads the original result. Core currently pins `@yourgpt/llm-sdk` to `2.5.1-beta.3`; adopting this SDK fix requires a separately approved release and dependency update. No Core dependency version was guessed or changed.

The two ChatbotController proxy methods were inspected and do forward message content as supplied by API customers. The SDK regression cases use that same runtime shape. No changes to those proxy request contracts are needed.

## Verification

- 371 automated tests pass on Node 26 and Node 18 on this isolated release branch: the published beta's 314-test suite plus 57 hotfix regressions. The larger next-beta suite was also tested separately, but is not part of this release.
- 12 live OpenAI Responses checks pass: stateless and stored continuation, function loops, Runtime replay, actual encrypted reasoning, and persisted Copilot mixed client/server tools over JSON and SSE.
- 10 targeted live regressions pass: structured tool content via OpenAI and OpenRouter in both modes, plus Anthropic null/image, duplicate and mixed system content in both modes.
- The packed npm archive passes all 41 focused compatibility regressions in a clean consumer install, and all 13 public entry points import successfully. Its exports, dependencies, peer requirements and Node engine requirement match the published beta.2 package.
- SDK build and type checks pass. The Core controller passes `node --check`; the complete Core service was not booted or integration-tested.
- No live Google, xAI or Fireworks credentials were used. Their shared adapter paths were verified with transport fixtures.

Release-candidate logs and synthetic-only reports: `/tmp/copilot-beta-hotfix-release/`. Tests are reproducible via `packages/llm-sdk/test/beta-compatibility-regressions.test.cjs`, `anthropic-system.test.cjs`, `responses.test.cjs` and the opt-in `test/live/beta-compatibility.cjs` / `test/live/responses.cjs` scripts.

## Reference checks

OpenAI documents the need to retain encrypted reasoning for stateless continuation: [reasoning guide](https://developers.openai.com/api/docs/guides/reasoning). The local Vercel AI SDK reference (`/tmp/copilot-next-beta-research/vercel-ai/packages/openai/src/responses/openai-responses-language-model.ts`) also attaches specific continuation fields such as item IDs and encrypted reasoning, rather than copying a full response envelope onto each message. These informed the separation between server diagnostics and conversation state.
