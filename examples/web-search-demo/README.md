# Web Search Demo

AI assistant with real-time web search capabilities using YourGPT Copilot SDK.

## Features

- **No Extra API Key Needed**: Uses OpenAI or Google's built-in search
- **Multi-Provider Support**: Native providers + Tavily, Serper, Brave, Exa, SearXNG
- **Tree-Shakeable Imports**: Only bundle the provider you use (~3KB each)
- **AI-Generated Summaries**: Get concise answers with cited sources
- **Real-time Information**: Current news, prices, weather, and more

## Setup

1. **Install dependencies**

   ```bash
   pnpm install
   ```

2. **Configure environment variables**

   Copy `.env.example` to `.env.local`:

   ```bash
   cp .env.example .env.local
   ```

   **Only one key needed:**
   - `OPENAI_API_KEY` - Get from [OpenAI](https://platform.openai.com/api-keys)

   That's it! OpenAI's native web search will be used automatically.

3. **Run the development server**

   ```bash
   pnpm dev
   ```

4. Open [http://localhost:3009](http://localhost:3009)

## Try asking

- "What are the latest AI news?"
- "What's the weather in New York?"
- "Who won the most recent Super Bowl?"
- "What's the current price of Bitcoin?"

## Search Providers

### Tree-Shakeable Imports (Recommended)

Import only the provider you need for optimal bundle size:

```typescript
// OpenAI Native (~2.5KB) - uses your existing OpenAI key
import { openaiSearch } from "@yourgpt/copilot-sdk/tools/openai";

const webSearch = openaiSearch({
  apiKey: process.env.OPENAI_API_KEY,
});
```

```typescript
// Google Native (~2.5KB) - uses your existing Google/Gemini key
import { googleSearch } from "@yourgpt/copilot-sdk/tools/google";

const webSearch = googleSearch({
  apiKey: process.env.GOOGLE_API_KEY,
});
```

```typescript
// Tavily (~3KB) - AI-native search with summaries
import { tavilySearch } from "@yourgpt/copilot-sdk/tools/tavily";

const webSearch = tavilySearch({
  apiKey: process.env.TAVILY_API_KEY,
  includeAnswer: true,
});
```

```typescript
// Serper (~2.6KB) - Google results
import { serperSearch } from "@yourgpt/copilot-sdk/tools/serper";

const webSearch = serperSearch({
  apiKey: process.env.SERPER_API_KEY,
});
```

```typescript
// Brave (~2.6KB) - privacy-focused search
import { braveSearch } from "@yourgpt/copilot-sdk/tools/brave";

const webSearch = braveSearch({
  apiKey: process.env.BRAVE_API_KEY,
});
```

```typescript
// Exa (~2.8KB) - semantic AI search
import { exaSearch } from "@yourgpt/copilot-sdk/tools/exa";

const webSearch = exaSearch({
  apiKey: process.env.EXA_API_KEY,
  searchDepth: "advanced",
});
```

```typescript
// SearXNG (~2.6KB) - self-hosted, no API key needed
import { searxngSearch } from "@yourgpt/copilot-sdk/tools/searxng";

const webSearch = searxngSearch({
  baseUrl: "https://your-searxng-instance.com",
});
```

### Legacy Import (All Providers)

If you need to dynamically switch providers at runtime:

```typescript
import { createWebSearchTool } from "@yourgpt/copilot-sdk/core";

const webSearch = createWebSearchTool({
  provider: "tavily", // or "openai", "google", "anthropic", etc.
  apiKey: process.env.TAVILY_API_KEY,
});
```

> Note: This bundles all providers (~50KB). Use subpath imports for smaller bundles.

## Bundle Size Comparison

| Import Pattern                         | Bundle Size |
| -------------------------------------- | ----------- |
| Single provider (e.g., `tools/tavily`) | ~2.5-3KB    |
| All providers (`core`)                 | ~50KB+      |

**~85% reduction** when using tree-shakeable imports!

## Learn More

- [YourGPT Copilot SDK Documentation](https://copilot-sdk.yourgpt.ai)
- [Web Search Tool Docs](https://copilot-sdk.yourgpt.ai/docs/tools/built-in/web-search)
