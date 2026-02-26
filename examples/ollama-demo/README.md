# Ollama Demo - Local LLM with React Chat UI

> Run AI copilots locally with Ollama - no API keys, no cloud, full privacy.

## Features

- **React Chat UI** - Full chat interface using `@yourgpt/copilot-sdk` components
- **Express Server** - Backend with Ollama runtime and server-side tools
- **Streaming** - Real-time SSE streaming from local models
- **Tool Calling** - Weather and calculator tools
- **CLI Demos** - Basic chat, tools, vision, and options examples

## Quick Start

### Prerequisites

- [Ollama](https://ollama.ai) installed and running
- Node.js 18+
- pnpm

### 1. Start Ollama

```bash
# Start Ollama server
ollama serve

# Pull a model (in another terminal)
ollama pull llama3.1      # ~4.7GB - full featured
# Or for quick testing:
ollama pull qwen2.5:1.5b  # ~986MB - smallest with tool support
```

### 2. Run the Demo

```bash
# From monorepo root
pnpm install

# Start both server and client
cd examples/ollama-demo
pnpm dev
```

This starts:

- **Server** on `http://localhost:3002` (Express + Ollama runtime)
- **Client** on `http://localhost:5173` (Vite React app)

Open `http://localhost:5173` to use the chat interface.

## Available Scripts

| Script            | Description                        |
| ----------------- | ---------------------------------- |
| `pnpm dev`        | Start server + client together     |
| `pnpm dev:server` | Start server only                  |
| `pnpm dev:client` | Start client only                  |
| `pnpm chat`       | CLI: basic chat demo               |
| `pnpm tools`      | CLI: tool calling demo             |
| `pnpm vision`     | CLI: vision demo (requires LLaVA)  |
| `pnpm options`    | CLI: Ollama-specific options demo  |
| `pnpm server`     | Start server without file watching |

## Project Structure

```
ollama-demo/
├── package.json          # Orchestrator (runs server + client)
├── .env.example          # Environment variables
├── server/
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── server.ts     # Express server with /api/copilot endpoint
│       ├── index.ts      # CLI demos (chat, tools, vision, options)
│       └── tools.ts      # Server-side tool definitions
└── client/
    ├── package.json
    ├── vite.config.ts    # Proxy /api -> localhost:3002
    ├── tsconfig.json
    ├── index.html
    └── src/
        ├── main.tsx      # Entry point with SDK styles
        ├── App.tsx       # CopilotProvider + CopilotChat
        └── App.css       # Layout styles
```

## API Endpoints

| Endpoint           | Method | Description                   |
| ------------------ | ------ | ----------------------------- |
| `/api/copilot`     | POST   | CopilotProvider SSE endpoint  |
| `/api/chat/stream` | POST   | SSE streaming (curl-friendly) |
| `/api/chat`        | POST   | Non-streaming JSON            |
| `/api/health`      | GET    | Health check + Ollama status  |
| `/api/models`      | GET    | List available Ollama models  |

## Environment Variables

| Variable              | Default                  | Description       |
| --------------------- | ------------------------ | ----------------- |
| `OLLAMA_BASE_URL`     | `http://localhost:11434` | Ollama server URL |
| `OLLAMA_MODEL`        | `llama3.1`               | Default model     |
| `OLLAMA_VISION_MODEL` | `llava`                  | Vision model      |
| `PORT`                | `3002`                   | Server port       |

## Tech Stack

- **Server**: Express.js, `@yourgpt/llm-sdk` with Ollama provider
- **Client**: Vite, React, `@yourgpt/copilot-sdk` (CopilotProvider + CopilotChat)
- **LLM**: Ollama (local inference)
