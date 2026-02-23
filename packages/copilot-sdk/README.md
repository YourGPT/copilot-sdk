<a href="https://copilot-sdk.yourgpt.ai">
  <img src="https://copilot-sdk.yourgpt.ai/images/yourgpt-copilot-sdk-npm.png" alt="YourGPT Copilot SDK" width="100%" />
</a>

# Copilot SDK

[![npm version](https://img.shields.io/npm/v/@yourgpt/copilot-sdk)](https://www.npmjs.com/package/@yourgpt/copilot-sdk)
[![npm downloads](https://img.shields.io/npm/dm/@yourgpt/copilot-sdk)](https://www.npmjs.com/package/@yourgpt/copilot-sdk)
[![License](https://img.shields.io/npm/l/@yourgpt/copilot-sdk)](https://github.com/YourGPT/copilot-sdk/blob/main/LICENSE)

Build AI Copilots for Your Product.

Production-ready AI Copilots for any product. Connect any LLM, deploy on your infrastructure, own your data.

**Documentation:** [copilot-sdk.yourgpt.ai](https://copilot-sdk.yourgpt.ai)

## Installation

```bash
npm install @yourgpt/copilot-sdk @yourgpt/llm-sdk
```

## Quick Start

```tsx
import { CopilotProvider } from "@yourgpt/copilot-sdk/react";
import { CopilotChat } from "@yourgpt/copilot-sdk/ui";

function App() {
  return (
    <CopilotProvider runtimeUrl="/api/chat">
      <YourApp />
      <CopilotChat />
    </CopilotProvider>
  );
}
```

## Subpath Exports

| Subpath  | Description                    |
| -------- | ------------------------------ |
| `/react` | React hooks and provider       |
| `/ui`    | Pre-built UI components        |
| `/core`  | Types, utilities, tool helpers |

## Built-in Tools

### Web Search

Add real-time web search capabilities to your AI copilot. **No extra API key needed** - use your existing OpenAI or Google key.

```typescript
import { createWebSearchTool } from "@yourgpt/copilot-sdk/core";

// Use OpenAI's built-in search (recommended)
const webSearch = createWebSearchTool({
  provider: "openai",
  apiKey: process.env.OPENAI_API_KEY,
});

// Or use Google's built-in search
const webSearch = createWebSearchTool({
  provider: "google",
  apiKey: process.env.GOOGLE_API_KEY,
});

const runtime = createRuntime({
  provider: openai,
  model: "gpt-4o",
  tools: [webSearch],
});
```

**Native Providers (No extra API needed):**

- `openai` - OpenAI's built-in web search
- `google` - Google's grounding with Google Search
- `anthropic` - Anthropic's built-in web search

**Third-Party Providers:**

- [Tavily](https://tavily.com/) - AI-native search with answer generation
- [Serper](https://serper.dev/) - Google Search API
- [Brave](https://brave.com/search/api/) - Privacy-focused search
- [Exa](https://exa.ai/) - Semantic AI search
- [SearXNG](https://docs.searxng.org/) - Self-hosted metasearch

## Examples

Explore real-world implementations and demo projects.

### Debug Assistant

AI-powered debugging companion that captures console logs, takes screenshots, and provides intelligent analysis.

<a href="https://copilot-sdk.yourgpt.ai/docs/examples">
  <img src="https://copilot-sdk.yourgpt.ai/images/debug-assistant-demo.webp" alt="Debug Assistant" width="100%" style="border-radius: 12px;" />
</a>

### Support Ticket System

AI-powered customer support with intelligent ticket routing, automatic escalation, and context-aware responses.

<a href="https://copilot-sdk.yourgpt.ai/docs/examples">
  <img src="https://copilot-sdk.yourgpt.ai/images/copilot-sdk-support-demo.png" alt="Support Ticket System" width="100%" style="border-radius: 12px;" />
</a>

### SaaS Application

SaaS template with AI copilot integration. Includes subscription handling, billing management, and intelligent assistance.

<a href="https://copilot-sdk.yourgpt.ai/docs/examples">
  <img src="https://copilot-sdk.yourgpt.ai/images/saas-demo.webp" alt="SaaS Application" width="100%" style="border-radius: 12px;" />
</a>

**[View all examples →](https://copilot-sdk.yourgpt.ai/docs/examples)**

## License

MIT
