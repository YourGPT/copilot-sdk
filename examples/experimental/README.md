# Experimental Examples

> Raw SDK examples and experimental demos for testing Copilot SDK features.

## Overview

This directory contains experimental and raw examples for testing various SDK features. These are primarily used for development and testing purposes.

## Available Demos

| Demo                    | Path               | Description                                           |
| ----------------------- | ------------------ | ----------------------------------------------------- |
| **Non-Streaming**       | `/non-streaming`   | `runtime.generate()` with CopilotChat                 |
| **Theme Demo**          | `/theme-demo`      | 9 theme presets with live preview                     |
| **Multi-Provider**      | `/providers`       | OpenAI, Anthropic, Google side-by-side                |
| **Compound Components** | `/compound-test`   | Custom home screen with `Chat.Home`, `Chat.Input`     |
| **Tool Types**          | `/tool-types-demo` | Different tool rendering patterns                     |
| **Tool Scale Lab**      | `/tool-scale`      | 100 tools with profiles, search, and deferred loading |
| **Widgets**             | `/widgets`         | Standalone UI components                              |

## Quick Start

### Prerequisites

- Node.js 18+
- **pnpm** (required for workspace setup - npm/yarn won't work)
- LLM provider API key (OpenAI, Anthropic, or Google)

### Installation

```bash
# Clone the repository
https://github.com/YourGPT/copilot-sdk.git
cd copilot-sdk

# Install all dependencies from root (required for workspace)
pnpm install

# Set up environment
cp examples/experimental/.env.example examples/experimental/.env.local
# Add your API keys to .env.local

# Run development server
cd examples/experimental

# Install dependencies
pnpm install

pnpm dev
```

Open [http://localhost:3000](http://localhost:3000)

## Environment Variables

Create a `.env.local` file with your API keys:

```bash
OPENAI_API_KEY=your-openai-key
ANTHROPIC_API_KEY=your-anthropic-key
GOOGLE_API_KEY=your-google-key
```

| Variable            | Description       |
| ------------------- | ----------------- |
| `OPENAI_API_KEY`    | OpenAI API key    |
| `ANTHROPIC_API_KEY` | Anthropic API key |
| `GOOGLE_API_KEY`    | Google AI API key |

## Project Structure

```
experimental/
├── app/
│   ├── page.tsx                    # Demo index page
│   ├── layout.tsx                  # Root layout
│   ├── globals.css                 # Tailwind styles
│   ├── non-streaming/              # Non-streaming demo
│   ├── theme-demo/                 # Theme showcase
│   ├── providers/                  # Multi-provider test
│   ├── compound-test/              # Compound components
│   ├── tool-types-demo/            # Tool rendering patterns
│   ├── tool-scale/                 # 100-tool selection/profile lab
│   ├── widgets/                    # Standalone widgets
│   └── api/
│       └── chat/
│           ├── openai/route.ts
│           ├── anthropic/route.ts
│           ├── google/route.ts
│           └── tool-scale/route.ts
├── components/
│   ├── theme-provider.tsx
│   ├── provider-card.tsx
│   └── tools/
├── lib/
│   ├── utils.ts
│   ├── tools/
│   └── tool-scale/
└── README.md
```

## Keyboard Shortcuts

- `Cmd+J` / `Ctrl+J` - Toggle dark mode

## Tech Stack

- Next.js 16
- React 19
- Tailwind CSS 4
- @yourgpt/copilot-sdk
- @yourgpt/llm-sdk

## Important Notes

> **Workspace Dependency**: This example uses `workspace:*` dependencies. You must use `pnpm install` from the monorepo root. Regular `npm install` or `yarn install` will not resolve workspace dependencies correctly.

> **Experimental**: These demos are for testing and may change frequently. For production-ready examples, see the other demo directories.
