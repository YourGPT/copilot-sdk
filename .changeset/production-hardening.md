---
"@yourgpt/llm-sdk": patch
"create-ai-copilot": minor
---

- llm-sdk: require `hono@^4.13.7`, fixing the published advisories in the bundled server dependency (including the `cors()` wildcard credential reflection used by `createHonoApp`).
- llm-sdk: only log non-streaming HTTP responses when `debug` is enabled.
- create-ai-copilot: scaffold projects on `@yourgpt/copilot-sdk` and `@yourgpt/llm-sdk` v2 instead of v1, and fix the generated server tool example to typecheck against v2.
