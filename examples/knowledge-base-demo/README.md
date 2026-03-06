# Knowledge Base Demo

Demo of the YourGPT Knowledge Base integration with Copilot SDK.

## Features

- **Hidden Internal Tool**: The knowledge base search runs as a hidden tool - it executes but doesn't show in the chat UI
- **Auto-Registration**: Just provide the `knowledgeBase` config to `CopilotProvider` and the tool is automatically registered
- **Real-time Config**: The demo allows you to enter/change the API key at runtime

## Setup

1. Copy `.env.example` to `.env.local`:

   ```bash
   cp .env.example .env.local
   ```

2. Add your Anthropic API key to `.env.local`:

   ```
   ANTHROPIC_API_KEY=your-anthropic-api-key
   ```

3. Install dependencies:

   ```bash
   pnpm install
   ```

4. Run the dev server:

   ```bash
   pnpm dev
   ```

5. Open http://localhost:3010

6. Enter your YourGPT API key in the sidebar config panel

## Usage

```tsx
import { CopilotProvider } from "@yourgpt/copilot-sdk/react";

<CopilotProvider
  runtimeUrl="/api/chat"
  knowledgeBase={{
    apiKey: "your-yourgpt-api-key", // From YourGPT Dashboard
    limit: 10, // Max results (optional)
  }}
>
  {children}
</CopilotProvider>;
```

## How It Works

1. When you provide `knowledgeBase` config, a hidden `search_knowledge` tool is automatically registered
2. The AI can use this tool to search your trained knowledge base
3. Results are returned to the AI which synthesizes them into a response
4. The tool execution is hidden from the chat UI (no tool cards shown)

## API Reference

The SDK calls the YourGPT searchIndexDocument API:

```
POST https://api.yourgpt.ai/chatbot/v1/searchIndexDocument

Headers:
  Authorization: <your-api-key>
  Content-Type: application/json

Body:
  {
    "query": "search query",
    "limit": 10
  }
```

## Get Your API Key

1. Go to [YourGPT Dashboard](https://app.yourgpt.ai)
2. Navigate to Integration Settings
3. Generate or copy your API key
