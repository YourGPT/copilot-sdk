# Message History & Compaction

Automatic context window management. Keeps long conversations within token limits without losing important history.

## Strategies

| Strategy          | What it does                                             |
| ----------------- | -------------------------------------------------------- |
| `none` (default)  | No compaction — current behavior, zero breaking changes  |
| `sliding-window`  | Drop oldest messages when over token budget              |
| `selective-prune` | Drop tool results from old turns, keep summaries         |
| `summary-buffer`  | Summarize old turns into a rolling summary (recommended) |

## Usage

```tsx
<CopilotProvider
  runtimeUrl="/api/chat"
  messageHistory={{
    strategy: "summary-buffer",
    maxContextTokens: 80_000,      // total context budget
    reserveForResponse: 4096,      // tokens reserved for AI reply
    recentBuffer: 40,              // keep last N messages verbatim
    compactionThreshold: 0.75,     // compact at 75% full
    toolResultMaxChars: 80_000,    // max chars per tool result
    persistSession: false,
    onCompaction: (e) => console.log("Compacted", e),
    onTokenUsage: (u) => console.log(`${u.percentage * 100}% full`),
  }}
>
```

## How It Works

**Architecture**: `MessageHistoryBridge` (mounted inside `CopilotProvider`) wires `useMessageHistory` into `AbstractChat.buildRequest()` via `setRequestMessageTransform`.

```
User sends message
  → AbstractChat.buildRequest() calls requestMessageTransform(allMessages)
  → Transform splits: historyMessages (before last user msg) + currentTurn (from last user msg)
  → buildSummaryBufferContext() compacts historyMessages only
  → currentTurn always kept verbatim (no broken tool call/result pairs)
  → Compacted history + currentTurn sent to API
  → In-memory store unchanged (full history kept for display)
```

**Auto-compaction**: When `tokenUsage.isApproaching = true` (threshold crossed), `runCompaction` summarizes old messages and updates `compactionState.rollingSummary`. The transform picks up the new summary automatically on next request.

**UI indicators**: When compaction triggers, a system message (`type: "compaction-marker"`) is added to chat:

- Loading: `"Compacting conversation…"` (while summarizing)
- Done: `"Conversation compacted — context window refreshed"` (permanent divider)

## Token Counting

Token usage is computed from the **full display history** (`toLLMMessages(displayMessages)`), not the already-pruned output. This ensures the threshold reflects actual accumulation.

```tsx
// Access token usage directly
const { tokenUsage, compactionState } = useMessageHistory();
// tokenUsage.current, .max, .percentage, .isApproaching
// compactionState.compactionCount, .rollingSummary, .totalTokensSaved
```

## Manual Compaction

```tsx
const { compactSession } = useMessageHistory();

// Trigger manually with optional instructions
await compactSession("Focus on user preferences and key decisions");
```
