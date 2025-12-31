# @yourgpt/llm-sdk

Multi-provider LLM integration for Copilot SDK.

## Installation

```bash
npm install @yourgpt/llm-sdk
```

## Quick Start

```typescript
import { createRuntime, createOpenAI } from "@yourgpt/llm-sdk";

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const runtime = createRuntime({
  provider: openai,
  model: "gpt-4o",
  systemPrompt: "You are a helpful assistant.",
});

// Next.js App Router
export async function POST(request: Request) {
  return runtime.handleRequest(request);
}
```

## Supported Providers

| Provider      | Factory             |
| ------------- | ------------------- |
| OpenAI        | `createOpenAI()`    |
| Anthropic     | `createAnthropic()` |
| Google Gemini | `createGoogle()`    |
| Groq          | `createGroq()`      |
| Ollama        | `createOllama()`    |
| xAI (Grok)    | `createXAI()`       |
| Azure OpenAI  | `createAzure()`     |

## Framework Integrations

```typescript
// Next.js
import { createNextHandler } from "@yourgpt/llm-sdk";

// Express
import { createExpressMiddleware } from "@yourgpt/llm-sdk";

// Hono
import { createHonoApp } from "@yourgpt/llm-sdk";

// Node.js HTTP
import { createNodeHandler } from "@yourgpt/llm-sdk";
```

## Features

- Multi-provider support (7 LLM providers)
- Streaming responses (SSE)
- Agent loop for multi-step tool execution
- Framework-agnostic with built-in integrations
- TypeScript-first

## Documentation

Visit [copilot-sdk.yourgpt.ai](https://copilot-sdk.yourgpt.ai)

## License

MIT
