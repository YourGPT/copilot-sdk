# Express Demo - StreamResult API

> Server-side streaming example using Express.js with the LLM SDK's StreamResult API.

## Features Showcased

### Streaming Methods

- `pipeToResponse()` - SSE streaming (recommended)
- `pipeTextToResponse()` - Text-only streaming
- `expressHandler()` - Built-in Express handler
- `collect()` - Non-streaming JSON response
- Event handlers with `on('text', ...)` - Custom event processing
- `toResponse()` - Web Response conversion

### Express Integration

- Multiple endpoint patterns
- Error handling
- CORS configuration
- Request/response streaming
- Tool profiles and selective loading
- Provider-aware tool hints for Anthropic/OpenAI

## Quick Start

### Prerequisites

- Node.js 18+
- **pnpm** (required for workspace setup - npm/yarn won't work)
- OpenAI API key

### Installation

```bash
# Clone the repository
https://github.com/YourGPT/copilot-sdk.git
cd copilot-sdk

# Install all dependencies from root (required for workspace)
pnpm install

# Set up environment
export OPENAI_API_KEY=your-api-key-here

# Run development server
cd examples/express-demo

# Install dependencies
pnpm install

pnpm dev
```

Server runs on [http://localhost:3001](http://localhost:3001)

## Environment Variables

Set your API key as an environment variable:

```bash
export OPENAI_API_KEY=your-api-key-here
```

| Variable         | Description         |
| ---------------- | ------------------- |
| `OPENAI_API_KEY` | Your OpenAI API key |

## API Endpoints

| Endpoint            | Method                 | Description                 |
| ------------------- | ---------------------- | --------------------------- |
| `/api/chat`         | `pipeToResponse()`     | SSE streaming (recommended) |
| `/api/chat/text`    | `pipeTextToResponse()` | Text-only streaming         |
| `/api/chat/handler` | `expressHandler()`     | Built-in handler            |
| `/api/chat/collect` | `collect()`            | Non-streaming JSON          |
| `/api/chat/events`  | Event handlers         | With `on('text', ...)`      |
| `/api/chat/web`     | `toResponse()`         | Web Response conversion     |

## Tool Selection Demo

The demo runtime tags tools with profiles and categories, then enables `agentLoop.toolSelection`.

- Default profile: `support`
- Alternate profile: `utility`
- Tool search over deferred tools: enabled
- Dynamic selection: enabled
- Native hints:
  - Anthropic: single-tool preference + no parallel tool use
  - OpenAI: single-tool preference + parallel tool calls disabled

Example request using the utility profile:

```bash
curl -X POST http://localhost:3001/api/copilot/chat \
  -H "Content-Type: application/json" \
  -d '{
    "toolProfile": "utility",
    "messages": [
      { "role": "user", "content": "What time is it on the server?" }
    ]
  }'
```

Example request using the support profile:

```bash
curl -X POST http://localhost:3001/api/copilot/chat \
  -H "Content-Type: application/json" \
  -d '{
    "toolProfile": "support",
    "messages": [
      { "role": "user", "content": "What does the Copilot SDK support?" }
    ]
  }'
```

## Test Commands

### SSE Streaming (default)

```bash
curl -X POST http://localhost:3001/api/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Say hello in 3 words"}]}'
```

### Text-only Streaming

```bash
curl -X POST http://localhost:3001/api/chat/text \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Count to 5"}]}'
```

### Non-streaming JSON

```bash
curl -X POST http://localhost:3001/api/chat/collect \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"What is 2+2?"}]}'
```

## Code Examples

### One-liner (Recommended)

```typescript
app.post("/api/chat", async (req, res) => {
  await runtime.stream(req.body).pipeToResponse(res);
});
```

### With Event Handlers

```typescript
app.post("/api/chat", async (req, res) => {
  const result = runtime
    .stream(req.body)
    .on("text", (text) => console.log(text))
    .on("done", (final) => console.log("Done:", final.text.length));

  await result.pipeToResponse(res);
});
```

### Non-streaming

```typescript
app.post("/api/chat", async (req, res) => {
  const { text, messages } = await runtime.stream(req.body).collect();
  res.json({ response: text });
});
```

## Project Structure

```
express-demo/
├── src/
│   └── index.ts                    # Express server with all endpoints
├── package.json
├── tsconfig.json
└── README.md
```

## Tech Stack

- Express.js
- TypeScript
- @yourgpt/llm-sdk

## Important Notes

> **Workspace Dependency**: This example uses `workspace:*` dependencies. You must use `pnpm install` from the monorepo root. Regular `npm install` or `yarn install` will not resolve workspace dependencies correctly.

> **Backend Only**: This is a backend-only example. For frontend integration, see the Next.js examples.
