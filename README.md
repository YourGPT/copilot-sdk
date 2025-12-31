# YourGPT Copilot SDK

Open-source SDK for building AI assistants with **App Context Awareness**.

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

## Installation

```bash
pnpm add @yourgpt/copilot-sdk-react @yourgpt/copilot-sdk-ui
```

## Quick Start

### Frontend

```tsx
import { YourGPTProvider } from "@yourgpt/copilot-sdk-react";
import { Chat } from "@yourgpt/copilot-sdk-ui";
import "@yourgpt/copilot-sdk-ui/styles.css";

function App() {
  return (
    <YourGPTProvider
      runtimeUrl="/api/chat"
      tools={{ screenshot: true, console: true, network: true }}
    >
      <Chat />
    </YourGPTProvider>
  );
}
```

### Backend (Next.js)

```ts
// app/api/chat/route.ts
import { createRuntime, createOpenAI } from "@yourgpt/llm-sdk";

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

const runtime = createRuntime({
  provider: openai,
  model: "gpt-4o",
});

export async function POST(request: Request) {
  return runtime.handleRequest(request);
}
```

## Packages

| Package                          | Description                              |
| -------------------------------- | ---------------------------------------- |
| `@yourgpt/copilot-sdk-core`      | Types, utilities, capture tools          |
| `@yourgpt/copilot-sdk-react`     | React hooks and provider                 |
| `@yourgpt/copilot-sdk-ui`        | Pre-built chat components                |
| `@yourgpt/llm-sdk`               | Multi-provider LLM integration           |
| `@yourgpt/copilot-sdk-knowledge` | Knowledge base integration (Coming Soon) |

## Documentation

Visit [copilot-sdk.yourgpt.ai](https://copilot-sdk.yourgpt.ai)

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md)

## License

[MIT](./LICENSE)
