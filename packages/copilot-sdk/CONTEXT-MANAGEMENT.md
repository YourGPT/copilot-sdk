# Context Management

Advanced context window management for the YourGPT Copilot SDK. These features give you full control over what the AI sees, how long conversations stay alive, and how tokens are tracked and budgeted.

---

## Table of Contents

1. [Dual-Layer Message Store](#1-dual-layer-message-store)
2. [Message History & Compaction](#2-message-history--compaction)
   - [Compaction Strategies](#compaction-strategies)
   - [Config Reference](#config-reference)
3. [Token Counting](#3-token-counting)
4. [Session Persistence](#4-session-persistence)
5. [useContextStats](#5-usecontextstats)
6. [AgentLoop API](#6-agentloop-api)
7. [Tools — useTool / useTools / ToolDefinition](#7-tools--usetool--usetools--tooldefinition)
   - [Deferred Tools](#deferred-tools)
   - [Hidden Tools](#hidden-tools)
   - [Fallback Tool Renderer](#fallback-tool-renderer)
8. [Message Grouping](#8-message-grouping)
9. [Server: compactSession](#9-server-compactsession)

---

## 1. Dual-Layer Message Store

Every conversation maintains two parallel views of the message history.

| Layer                 | Type               | Purpose                                                                           |
| --------------------- | ------------------ | --------------------------------------------------------------------------------- |
| **Display layer**     | `DisplayMessage[]` | Full immutable history. Rendered in the UI. Never shrinks.                        |
| **LLM context layer** | `LLMMessage[]`     | Compacted/pruned form sent to the model on each request. Rebuilt on every render. |

### Types

```typescript
// Display layer — extends UIMessage for full backward-compat
interface DisplayMessage extends UIMessage {
  timestamp: number; // Unix ms
}

// Injected into displayMessages when compaction fires
interface CompactionMarker extends DisplayMessage {
  role: "system";
  type: "compaction-marker";
  content: string; // Human-readable summary
  summarizedMessageIds: string[];
  tokensSaved: number;
}

// LLM context layer — what the model actually sees
interface LLMMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

// Replaces a full tool result when old enough to prune
interface CompactedToolResult {
  type: "compacted-tool-result";
  toolName: string;
  toolCallId: string;
  args: Record<string, unknown>;
  executedAt: number;
  status: "success" | "error";
  originalSize: number;
  summary: string;
  extract?: string; // First 200 chars if no LLM summary
}
```

### Conversion helpers

```typescript
import {
  toDisplayMessage,
  toLLMMessage,
  toLLMMessages,
  keepToolPairsAtomic,
} from "@yourgpt/copilot-sdk-react";
```

`keepToolPairsAtomic` ensures that when you slice a window, an `assistant` message with `tool_calls` is never separated from its corresponding tool-result messages.

---

## 2. Message History & Compaction

### useMessageHistory

```typescript
import { useMessageHistory } from "@yourgpt/copilot-sdk-react";

function MyChat() {
  const {
    displayMessages, // Full UI history
    llmMessages, // Compacted LLM context
    tokenUsage, // Live token estimate
    isCompacting, // true while auto-compaction runs
    compactionState, // Metadata & rolling summary
    compactSession, // Manual trigger
    addToWorkingMemory,
    clearWorkingMemory,
    resetSession,
  } = useMessageHistory({
    strategy: "summary-buffer",
    maxContextTokens: 128000,
    compactionThreshold: 0.75,
    compactionUrl: "/api/compact",
    persistSession: true,
  });
}
```

#### Return type

```typescript
interface UseMessageHistoryReturn {
  displayMessages: DisplayMessage[];
  llmMessages: LLMMessage[];
  tokenUsage: TokenUsage;
  isCompacting: boolean;
  compactionState: SessionCompactionState;
  compactSession: (instructions?: string) => Promise<void>;
  addToWorkingMemory: (fact: string) => void;
  clearWorkingMemory: () => void;
  resetSession: () => void;
}
```

### Compaction Strategies

Four strategies are available via the `strategy` config field.

#### `"none"` (default)

No compaction. Zero-config, 100% backward-compatible. All messages sent verbatim.

```typescript
useMessageHistory({ strategy: "none" });
```

#### `"sliding-window"`

Keeps only the most recent N tokens of history. Oldest messages are dropped when the token budget is exceeded.

```typescript
useMessageHistory({
  strategy: "sliding-window",
  maxContextTokens: 128000,
  reserveForResponse: 4096,
  recentBuffer: 10, // Always keep at least 10 recent messages
  toolResultMaxChars: 10000, // Truncate large tool results
});
```

#### `"selective-prune"`

Removes tool-result messages that are older than `recentBuffer`, keeping the conversation skeleton (user/assistant turns) intact. Lighter than sliding-window — no token counting required.

```typescript
useMessageHistory({
  strategy: "selective-prune",
  recentBuffer: 10,
});
```

#### `"summary-buffer"`

Summarizes old messages into a rolling summary when usage exceeds `compactionThreshold`. The summary is injected into the LLM context as a system message. Requires a `/api/compact` endpoint (or custom `summarizer`).

```typescript
useMessageHistory({
  strategy: "summary-buffer",
  compactionThreshold: 0.75, // Compact at 75% of maxContextTokens
  compactionUrl: "/api/compact",
  recentBuffer: 10,
  onCompaction: (event) => {
    console.log(
      `Compacted ${event.messagesSummarized} messages, saved ~${event.tokensSaved} tokens`,
    );
  },
});
```

Custom summarizer (skip the HTTP round-trip):

```typescript
useMessageHistory({
  strategy: "summary-buffer",
  summarizer: async (messages) => {
    const res = await myLLM.summarize(messages);
    return res.text;
  },
});
```

### Config Reference

```typescript
interface MessageHistoryConfig {
  strategy?: "none" | "sliding-window" | "summary-buffer" | "selective-prune";
  maxContextTokens?: number; // default: 128000
  reserveForResponse?: number; // default: 4096
  compactionThreshold?: number; // default: 0.75
  recentBuffer?: number; // default: 10
  toolResultMaxChars?: number; // default: 10000 (0 = no cap)
  compactionUrl?: string; // required for summary-buffer
  persistSession?: boolean; // default: false
  storageKey?: string; // default: "copilot-session"
  onCompaction?: (event: CompactionEvent) => void;
  onTokenUsage?: (usage: TokenUsage) => void;
}
```

#### Per-call options

```typescript
interface UseMessageHistoryOptions extends MessageHistoryConfig {
  skipCompaction?: boolean;
  tokenEstimation?: "fast" | "accurate" | "off"; // default: "fast"
  summarizer?: (messages: LLMMessage[]) => Promise<string>;
}
```

### Provider-level config

Set defaults once in `<CopilotProvider>` instead of each `useMessageHistory` call:

```tsx
<CopilotProvider
  messageHistory={{
    strategy: "summary-buffer",
    maxContextTokens: 128000,
    compactionUrl: "/api/compact",
    persistSession: true,
  }}
>
  <App />
</CopilotProvider>
```

### Working Memory

Pin facts that survive all future compactions:

```typescript
const { addToWorkingMemory, clearWorkingMemory } = useMessageHistory({ ... });

// Survives compaction
addToWorkingMemory("User is on the Pro plan. Account ID: acct_123");

// Remove all pinned facts
clearWorkingMemory();
```

### Compaction event & token usage types

```typescript
interface CompactionEvent {
  type: "auto" | "manual";
  compactionCount: number;
  messagesSummarized: number;
  tokensSaved: number;
  timestamp: number;
}

interface TokenUsage {
  current: number; // Estimated tokens in LLM context
  max: number; // maxContextTokens
  percentage: number; // current / max (0–1)
  isApproaching: boolean; // percentage >= compactionThreshold
}

interface SessionCompactionState {
  rollingSummary: string | null;
  lastCompactionAt: number | null;
  compactionCount: number;
  totalTokensSaved: number;
  workingMemory: string[];
  displayMessageCount: number;
  llmMessageCount: number;
}
```

---

## 3. Token Counting

Two-tier estimation — pick the right trade-off between speed and accuracy.

### Tier 1: Fast (zero dependencies)

Uses a `chars / 3.5` heuristic. ~85–90% accurate for English. Always available, no bundle cost.

```typescript
import {
  estimateTokensFast,
  estimateMessageTokens,
  estimateMessagesTokens,
} from "@yourgpt/copilot-sdk-react";

const tokens = estimateTokensFast("Hello world"); // fast, synchronous
const msgTokens = estimateMessagesTokens(llmMessages);
```

### Tier 2: Accurate (lazy-loaded)

Uses `gpt-tokenizer` with the `o200k_base` encoding. Lazy-loaded only when called — no upfront bundle cost. Falls back to Tier 1 if `gpt-tokenizer` is not installed.

```typescript
import {
  countTokensAccurate,
  countMessagesTokensAccurate,
} from "@yourgpt/copilot-sdk-react";

// Only loads gpt-tokenizer on first call
const tokens = await countTokensAccurate("Hello world");
const msgTokens = await countMessagesTokensAccurate(llmMessages);
```

### Dispatcher

```typescript
import { estimateTokens } from "@yourgpt/copilot-sdk-react";
import type { TokenEstimationMode } from "@yourgpt/copilot-sdk-react";

// mode: "fast" | "accurate" | "off"
const tokens = estimateTokens(llmMessages, "fast");
```

Set via `tokenEstimation` in `useMessageHistory`:

```typescript
useMessageHistory({ tokenEstimation: "accurate" });
```

---

## 4. Session Persistence

Survive page reloads with zero extra code.

```typescript
useMessageHistory({
  persistSession: true,
  storageKey: "my-app-chat", // default: "copilot-session"
});
```

| What is persisted                  | Where                                                      |
| ---------------------------------- | ---------------------------------------------------------- |
| `compactionState` (small metadata) | `localStorage` — sync, available immediately on cold start |
| `displayMessages` (can be large)   | `IndexedDB` — async, avoids localStorage quota issues      |

Both are keyed by `storageKey`. Multiple chat instances can coexist with different keys.

Clear everything (including storage) with:

```typescript
const { resetSession } = useMessageHistory({ persistSession: true });
await resetSession();
```

---

## 5. useContextStats

Live snapshot of context window usage. Updates reactively on every message send.

```typescript
import { useContextStats } from "@yourgpt/copilot-sdk-react";

function ContextMonitor() {
  const {
    contextUsage,        // Full breakdown by bucket (richest field)
    totalTokens,         // Convenience: total estimated tokens
    usagePercent,        // Convenience: window fill 0–1
    contextChars,        // Characters contributed by AI context injections
    toolCount,           // Number of currently registered tools
    messageCount,        // Visible (non-system) messages
    lastResponseUsage,   // Token usage from last assistant message
  } = useContextStats();

  // Breakdown by bucket
  const historyTokens = contextUsage?.breakdown.history.tokens;
  const systemPercent = contextUsage?.breakdown.systemPrompt.percent;

  return (
    <div>
      <p>{Math.round(usagePercent * 100)}% of context used</p>
      <p>{totalTokens} tokens / {toolCount} tools</p>
      {lastResponseUsage && (
        <p>Last turn: {lastResponseUsage.total_tokens} tokens</p>
      )}
    </div>
  );
}
```

### Return type

```typescript
interface ContextStats {
  contextUsage: ContextUsage | null; // null until first message
  totalTokens: number;
  usagePercent: number; // 0 until first message
  contextChars: number;
  toolCount: number;
  messageCount: number;
  lastResponseUsage: MessageTokenUsage | null;
}

interface MessageTokenUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}
```

---

## 6. AgentLoop API

`AbstractAgentLoop` is the framework-agnostic core that manages the tool execution loop, approvals, and cancellation.

```typescript
import { AbstractAgentLoop } from "@yourgpt/copilot-sdk";

const loop = new AbstractAgentLoop(
  {
    maxIterations: 20,
    tools: [myTool],
  },
  {
    onToolExecutionsChange: (executions) => setExecutions(executions),
    onToolApprovalRequired: (execution) => showApprovalModal(execution),
  },
);

// Register/unregister tools at runtime
loop.registerTool(weatherTool);
loop.unregisterTool("old_tool");

// Execute tool calls returned by the LLM
const results = await loop.executeToolCalls(toolCallsFromLLM);

// Cancel in-flight execution
loop.cancel();
```

### Config

```typescript
interface AgentLoopConfig {
  maxIterations?: number; // default: 20
  maxExecutionHistory?: number; // default: 100
  tools?: ToolDefinition[];
}
```

Tools use reference counting so React StrictMode double-invocations don't leave orphaned registrations.

---

## 7. Tools — useTool / useTools / ToolDefinition

### useTool

Register a single client-side tool from a React component. Accepts both Zod schemas and JSON Schema.

```typescript
import { useTool } from "@yourgpt/copilot-sdk-react";
import { z } from "zod";

function MyComponent() {
  useTool({
    name: "navigate_to_page",
    description: "Navigate to a page in the app",
    inputSchema: z.object({
      path: z.string().describe("Route path to navigate to"),
    }),
    handler: async ({ path }) => {
      router.push(path);
      return { success: true };
    },
    // Optional UI rendering
    render: ({ args, result }) => <NavigationCard path={args.path} />,
  });
}
```

### useTools (ToolSet pattern)

Register multiple tools at once using the Vercel AI SDK `ToolSet` pattern:

```typescript
import { useTools, tool } from "@yourgpt/copilot-sdk-react";

function MyApp() {
  useTools({
    get_weather: tool({
      description: "Get weather for a location",
      inputSchema: {
        type: "object",
        properties: { location: { type: "string" } },
        required: ["location"],
      },
      handler: async ({ location }) => fetchWeather(location),
    }),
    open_modal: tool({
      description: "Open a UI modal",
      inputSchema: z.object({ id: z.string() }),
      handler: async ({ id }) => {
        openModal(id);
        return { success: true };
      },
    }),
  });
}
```

### UseToolConfig reference

```typescript
interface UseToolConfig<TParams> {
  name: string;
  description: string;
  inputSchema: ZodSchema | JSONSchema; // Both accepted
  handler: (
    params: TParams,
    context?: ToolContext,
  ) => Promise<ToolResponse> | ToolResponse;

  // UI
  render?: (props: ToolRenderProps<TParams>) => React.ReactNode;
  title?: string | ((args: TParams) => string);
  executingTitle?: string | ((args: TParams) => string);
  completedTitle?: string | ((args: TParams) => string);

  // Behaviour
  available?: boolean; // default: true
  needsApproval?: boolean;
  approvalMessage?: string | ((params: TParams) => string);
  hidden?: boolean; // default: false — see Hidden Tools
  aiResponseMode?: AIResponseMode;
  aiContext?: string | ((result, args) => string);
  resultConfig?: ToolResultConfig;

  // Loading strategy
  deferLoading?: boolean; // see Deferred Tools
  profiles?: string[];
  searchKeywords?: string[];
  group?: string;
  category?: string;
}
```

### Deferred Tools

Large tool registries can bloat the LLM request payload. Mark tools with `deferLoading: true` to keep them out of the default request — they are auto-detected and injected only when the user's query semantically matches the tool.

```typescript
useTool({
  name: "run_sql_query",
  description: "Execute a SQL query against the database",
  deferLoading: true, // Not sent on every request
  searchKeywords: ["sql", "query", "database", "table"],
  inputSchema: z.object({ query: z.string() }),
  handler: async ({ query }) => db.execute(query),
});
```

Auto-detection uses `description` + `searchKeywords` to score relevance against the current message. No configuration required.

### Hidden Tools

Register tools that execute silently — they run when called by the AI but are never shown in the tool execution UI.

```typescript
useTool({
  name: "log_analytics_event",
  description: "Log a UI analytics event",
  hidden: true, // Never rendered in chat UI
  inputSchema: z.object({ event: z.string(), data: z.record(z.unknown()) }),
  handler: async ({ event, data }) => {
    analytics.track(event, data);
    return {};
  },
});
```

### Fallback Tool Renderer

The `<CopilotChat>` component resolves a renderer for each tool execution using this priority chain:

1. **`toolRenderers[toolName]`** — per-tool renderer map passed to `<CopilotChat>`
2. **`tool.render`** — render function attached to the `ToolDefinition` via `useTool`
3. **`mcpToolRenderer`** — catch-all for tools with `source: "mcp"`
4. **`fallbackToolRenderer`** — catch-all for any tool not matched above
5. **Built-in default** — generic tool execution card

```tsx
<CopilotChat
  // Highest priority — per-tool
  toolRenderers={{
    get_weather: ({ args, result }) => <WeatherCard {...result} />,
  }}
  // MCP catch-all
  mcpToolRenderer={({ toolName, args, result }) => <MCPCard name={toolName} />}
  // Universal catch-all
  fallbackToolRenderer={({ toolName, args, result }) => (
    <pre>{JSON.stringify(result, null, 2)}</pre>
  )}
/>
```

---

## 8. Message Grouping

`groupConsecutiveMessages` groups consecutive messages of the same role into visual clusters. Useful for building custom chat UIs where adjacent user or assistant messages should appear as one block.

Available from the message-utils module:

```typescript
import {
  toLLMMessages,
  toLLMMessage,
  keepToolPairsAtomic,
} from "@yourgpt/copilot-sdk-react";
```

Core invariant: **tool-call pairs are always atomic.** An assistant message with `tool_calls` is never separated from its corresponding tool-result messages during any windowing or pruning operation.

---

## 9. Server: compactSession

The `compactSession` utility powers the `/api/compact` endpoint for `summary-buffer` compaction. It calls Claude (defaults to `claude-haiku-4-5`) to produce a structured summary that preserves:

- User goals and requests
- Technical decisions and chosen approaches
- Tool call outcomes (name, key args, result status)
- Errors and resolutions
- Pending tasks and current work state

```typescript
// app/api/compact/route.ts
import { compactSession } from "@yourgpt/copilot-sdk/server";

export async function POST(req: Request) {
  const { messages, existingSummary, workingMemory } = await req.json();

  const { summary } = await compactSession({
    messages,
    existingSummary, // Passed in subsequent compactions for rolling summaries
    workingMemory, // User-pinned facts (addToWorkingMemory)
    model: "claude-haiku-4-5", // default
    maxSummaryTokens: 1024, // default
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  return Response.json({ summary });
}
```

### CompactSessionOptions

```typescript
interface CompactSessionOptions {
  messages: Array<{ role: string; content?: string | null }>;
  existingSummary?: string | null;
  workingMemory?: string[];
  model?: string; // default: "claude-haiku-4-5"
  maxSummaryTokens?: number; // default: 1024
  apiKey?: string; // fallback: process.env.ANTHROPIC_API_KEY
  apiBaseUrl?: string; // default: "https://api.anthropic.com"
  fetchImpl?: typeof fetch;
}
```

---

## Quick-start: Full Setup

```tsx
// app/layout.tsx
import { CopilotProvider } from "@yourgpt/copilot-sdk-react";

export default function RootLayout({ children }) {
  return (
    <CopilotProvider
      widgetToken="YOUR_TOKEN"
      messageHistory={{
        strategy: "summary-buffer",
        maxContextTokens: 128000,
        compactionThreshold: 0.75,
        compactionUrl: "/api/compact",
        persistSession: true,
        storageKey: "my-app",
        onCompaction: (e) => console.log("Compacted:", e),
      }}
    >
      {children}
    </CopilotProvider>
  );
}
```

```tsx
// components/ChatPanel.tsx
import { useMessageHistory, useContextStats } from "@yourgpt/copilot-sdk-react";

export function ChatPanel() {
  const { tokenUsage, isCompacting, compactSession } = useMessageHistory();
  const { usagePercent, toolCount } = useContextStats();

  return (
    <div>
      <p>
        {Math.round(usagePercent * 100)}% context used · {toolCount} tools
      </p>
      {tokenUsage.isApproaching && (
        <button onClick={() => compactSession()}>Compact now</button>
      )}
      {isCompacting && <span>Summarizing history…</span>}
    </div>
  );
}
```
