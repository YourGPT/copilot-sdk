# @yourgpt/llm-sdk

Multi-provider LLM SDK with streaming. One API, any provider.

## Installation

```bash
npm install @yourgpt/llm-sdk @anthropic-ai/sdk
```

> For other providers (OpenAI, Google, xAI), see [Providers Documentation](https://copilot-sdk.yourgpt.ai/docs/providers).

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

## Structured output, MCP, and reasoning effort

Pass `responseFormat`, `mcpServers`, and `reasoningEffort` on any `generateText()` / `streamText()` / `runtime.chat()` / `runtime.response()` call:

```ts
const result = await runtime.response({
  prompt: "Extract FAQs from this conversation.",
  mcpServers: [{ label: "kb", url: "https://kb.example.com/sse" }],
  reasoningEffort: "high",
  responseFormat: {
    type: "json_schema",
    json_schema: { name, schema, strict: true },
  },
});
```

OpenAI routes through `/v1/responses` automatically when MCP or reasoning is set; Anthropic uses the `mcp-client-2025-11-20` beta and adaptive thinking on Claude 4.6/4.7. See the [Structured Output guide](https://copilot-sdk.yourgpt.ai/docs/llm-sdk/structured-output) for the full per-provider mapping.

## Documentation

Visit **[copilot-sdk.yourgpt.ai](https://copilot-sdk.yourgpt.ai)** for full documentation:

- [All Providers](https://copilot-sdk.yourgpt.ai/docs/providers) - OpenAI, Anthropic, Google, xAI
- [Server Setup](https://copilot-sdk.yourgpt.ai/docs/server) - Runtime, streaming, tools
- [Tools](https://copilot-sdk.yourgpt.ai/docs/tools) - Server-side and client-side tools
- [LLM SDK Reference](https://copilot-sdk.yourgpt.ai/docs/llm-sdk) - streamText, generateText, runtime.response()

## License

MIT
