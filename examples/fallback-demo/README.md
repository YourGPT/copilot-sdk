# Fallback Demo

> Demonstrates `createFallbackChain()` from `@yourgpt/llm-sdk/fallback` — automatic failover, round-robin load distribution, per-model retries, and tools across multiple LLM providers.

## Features Showcased

- **Priority fallback** — OpenAI first, Anthropic if it fails
- **Round-robin** — distributes load evenly across providers
- **4xx does NOT trigger fallback** — bad API key throws immediately
- **Forced fallback** — dead primary URL → Anthropic picks up
- **Per-model retries** — retry same model N times before falling back
- **Tools in streaming mode** — tools work transparently across providers
- **Tools in non-streaming mode** — full JSON response with tool results
- **FallbackExhaustedError** — structured error when all models fail

## Quick Start

### Prerequisites

- Node.js 18+
- **pnpm** (required for workspace setup)
- OpenAI API key
- Anthropic API key

### Installation

```bash
# From the monorepo root
pnpm install

# Set up environment
cp examples/fallback-demo/.env.example examples/fallback-demo/.env
# Edit .env and add your keys

# Run the demo
cd examples/fallback-demo
pnpm dev
```

Server runs on [http://localhost:3000](http://localhost:3000)

## Environment Variables

```bash
OPENAI_API_KEY=your-openai-key
ANTHROPIC_API_KEY=your-anthropic-key
```

## API Endpoints

| Endpoint                         | Description                                 |
| -------------------------------- | ------------------------------------------- |
| `POST /chat/priority`            | OpenAI first, Anthropic fallback            |
| `POST /chat/round-robin`         | Alternates OpenAI / Anthropic per request   |
| `POST /chat/bad-key`             | 4xx error — fallback NOT triggered          |
| `POST /chat/fallback-test`       | Dead primary URL → Anthropic picks up       |
| `POST /chat/stream/tools`        | Streaming with 3 server-side tools          |
| `POST /chat/tools`               | Non-streaming JSON with tool results        |
| `POST /chat/fallback-test/tools` | Forced fallback + tools (Anthropic handles) |
| `POST /chat/retry-test`          | 2 retries on dead model before fallback     |

## Test Commands

### Basic fallback

```bash
curl -s -X POST http://localhost:3000/chat/priority \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Say hello"}]}'
```

### Forced fallback (dead primary → Anthropic)

```bash
curl -s -X POST http://localhost:3000/chat/fallback-test \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Which model are you?"}]}'
```

### Tools via streaming

```bash
curl -s -X POST http://localhost:3000/chat/stream/tools \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"What is the weather in Tokyo and what time is it?"}]}'
```

### Non-streaming with tools

```bash
curl -s -X POST http://localhost:3000/chat/tools \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Calculate 42 * 7 and get the weather in London"}]}'
```

### Retries before fallback (watch server logs)

```bash
curl -s -X POST http://localhost:3000/chat/retry-test \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Hello"}]}'
```

## Project Structure

```
fallback-demo/
├── src/
│   └── index.ts    # Express server with all routes
├── package.json
├── tsconfig.json
└── README.md
```

## Important Notes

> **Workspace Dependency**: Uses `workspace:*` dependencies. Run `pnpm install` from the monorepo root — `npm install` will not work.

> **Tools are provider-agnostic**: Tool definitions are written once. Whichever provider handles the request formats them natively (OpenAI function-calling JSON or Anthropic `tool_use` blocks). Tool handlers always run on your server.
