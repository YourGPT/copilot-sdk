# Conversation Branching

> Branch `feat/branching` — implements the same UX pattern as ChatGPT, Claude.ai, and Gemini:
> editing a user message creates a parallel conversation path, preserving the original,
> with `← N/M →` navigation between variants.

---

## Table of Contents

1. [Live Demo](#live-demo)
2. [What Was Built](#what-was-built)
3. [Breaking Changes](#breaking-changes)
4. [New APIs](#new-apis)
5. [Database / Persistence Changes](#database--persistence-changes)
6. [User Adoption](#user-adoption)
7. [Framework-Agnostic Usage](#framework-agnostic-usage)
8. [How It Works Internally](#how-it-works-internally)

---

## Live Demo

A full working demo is in the **experimental** examples project.

**Location:** `examples/experimental/`
**Route:** `/branching`

```bash
cd examples/experimental
pnpm dev
# → http://localhost:3000/branching
```

### What the demo shows

Two-panel layout inside a single `CopilotProvider`:

```
┌─────────────────────────────────────────────────────────────┐
│  ← Back   Conversation Branching Demo   [feat/branching]    │
├──────────────────────────┬──────────────────────────────────┤
│  Branch Tree             │  CopilotChat                    │
│                          │                                  │
│  Branch Tree             │  [user: Hello]  ← 1/2 →         │
│  4 total · 3 visible     │  [assistant: Hi there]          │
│  branched ✦              │                                  │
│                          │  [user: Tell me more] ✏         │
│  ● U Hello               │  [assistant: Sure…]             │
│  ├── ● A Hi there  ×2   │                                  │
│  └── · A Hey             │  ────────────────────────────── │
│      └── ● U Tell me…   │  [input field]                  │
│          └── ● A Sure…  │                                  │
└──────────────────────────┴──────────────────────────────────┘
```

- **Left panel** (`BranchTreePanel`) — reads `getAllMessages()` live. Green dot = on active path, grey = inactive branch. `×N` badge = sibling count. Click any node to call `switchBranch()`.
- **Right panel** — standard `CopilotChat`. Edit ✏ button appears on hover over user messages. `← N/M →` navigator appears below user messages when variants exist.

### Demo source files

| File                                                             | Purpose                                    |
| ---------------------------------------------------------------- | ------------------------------------------ |
| `examples/experimental/app/branching/page.tsx`                   | Page: `CopilotProvider` + two-panel layout |
| `examples/experimental/components/branching/BranchTreePanel.tsx` | Live tree visualization component          |
| `examples/experimental/app/api/chat/branching/route.ts`          | Anthropic API route (haiku, short replies) |

### Key code pattern in the demo

```tsx
// page.tsx — both panels share one CopilotProvider
<CopilotProvider runtimeUrl="/api/chat/branching">
  <BranchTreePanel />   {/* reads getAllMessages(), calls switchBranch() */}
  <CopilotChat ... />   {/* edit button + BranchNavigator built-in */}
</CopilotProvider>

// BranchTreePanel.tsx — the core hook usage
const { messages, getAllMessages, getBranchInfo, switchBranch, hasBranches } = useCopilot();
const allMessages = getAllMessages();          // all branches
const visibleIds = new Set(messages.map(m => m.id)); // active path
```

---

## What Was Built

### Core Data Layer

| File                                   | What Changed                                                                                                                                                                                                          |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/chat/branching/MessageTree.ts`    | **New.** Pure TypeScript tree utility. Bidirectional flat-map: `parentId` + `childrenIds[]` + `activeChildMap`. No React dependency.                                                                                  |
| `src/chat/branching/index.ts`          | **New.** Barrel export.                                                                                                                                                                                               |
| `src/chat/types/message.ts`            | Added `parentId?: string \| null` and `childrenIds?: string[]` to `UIMessage`.                                                                                                                                        |
| `src/core/types/message.ts`            | Added `parent_id?: string \| null` and `children_ids?: string[]` to `Message` (persistence layer).                                                                                                                    |
| `src/chat/interfaces/ChatState.ts`     | Added 5 optional branching methods: `setCurrentLeaf`, `getAllMessages`, `getBranchInfo`, `switchBranch`, `hasBranches`.                                                                                               |
| `src/react/internal/ReactChatState.ts` | Replaced `_messages: T[]` array with `MessageTree<T>`. `messages` getter = visible path only.                                                                                                                         |
| `src/chat/classes/AbstractChat.ts`     | `regenerate()` rewritten to be branch-aware (creates sibling instead of destroying). `sendMessage()` extended with `options.editMessageId`. `onMessagesChange` callback now passes all branches via `_allMessages()`. |
| `src/chat/ChatWithTools.ts`            | `sendMessage()` passes through `options.editMessageId`.                                                                                                                                                               |

### React Layer

| File                                       | What Changed                                                                                                                              |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `src/react/internal/ReactChat.ts`          | Added `switchBranch`, `getBranchInfo`, `getAllMessages`, `hasBranches` pass-throughs.                                                     |
| `src/react/internal/ReactChatWithTools.ts` | Same pass-throughs.                                                                                                                       |
| `src/react/internal/useChat.ts`            | Added `switchBranch`, `getBranchInfo`, `editMessage`, `hasBranches` to `UseChatReturn`.                                                   |
| `src/react/context/CopilotContext.tsx`     | Added branching methods to `ChatActions`.                                                                                                 |
| `src/react/provider/CopilotProvider.tsx`   | Wired branching methods into context. `onMessagesChange` effect uses `getAllMessages()`. Added `getAllMessages` to `CopilotContextValue`. |
| `src/react/index.ts`                       | Re-exports `MessageTree`, `BranchInfo`.                                                                                                   |
| `src/chat/index.ts`                        | Re-exports `MessageTree`, `BranchInfo`.                                                                                                   |

### UI Layer

| File                                                  | What Changed                                                                                                                         |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `src/ui/components/ui/branch-navigator.tsx`           | **New.** `← N/M →` purely presentational component.                                                                                  |
| `src/ui/components/composed/chat/types.ts`            | Added `getBranchInfo`, `onSwitchBranch`, `onEditMessage` to `ChatProps`.                                                             |
| `src/ui/components/composed/chat/default-message.tsx` | User messages: pencil edit button on hover, inline textarea edit, `BranchNavigator` shown when siblings exist.                       |
| `src/ui/components/composed/chat/chat.tsx`            | Passes branch props through to each message.                                                                                         |
| `src/ui/components/composed/connected-chat.tsx`       | Pulls `switchBranch`, `getBranchInfo`, `editMessage` from `useCopilot()` and passes to `<Chat />`.                                   |
| `src/ui/hooks/useInternalThreadManager.ts`            | Save path uses `getAllMessages()`. Load paths restore `parentId`/`childrenIds`. `convertToCore` includes `parent_id`/`children_ids`. |
| `src/ui/index.ts`                                     | Exports `BranchNavigator`, `BranchNavigatorProps`.                                                                                   |

---

## Breaking Changes

**None.**

All new fields and methods are optional. Every existing usage continues to work without modification:

| Scenario                                | Behavior                                                                                                                                       |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Messages with no `parentId`             | `getVisibleMessages()` falls back to insertion order (legacy linear)                                                                           |
| `regenerate()` called without arguments | Finds last assistant on visible path — identical to before                                                                                     |
| `sendMessage()` with no third argument  | Identical to before                                                                                                                            |
| `useChat()` / `useCopilot()` consumers  | All branching fields available but optional — no existing destructuring breaks                                                                 |
| `onMessagesChange` callback consumers   | Now receives all branches instead of visible path only — **payload size may increase** if branches exist, but shape is identical (`Message[]`) |
| DB rows with no `parent_id` column      | Auto-migrated via `fromFlatArray()` on load — no manual migration script needed for existing data                                              |

> **Note on `onMessagesChange` payload:** If a user has branched the conversation, the callback now receives all messages across all branches (not just the active path). The shape is the same `Message[]` type. If your persistence layer deduplicates by message ID, no change is needed. If it blindly appends, you may want to upsert by ID instead.

---

## New APIs

### `useCopilot()` / `CopilotProvider`

```typescript
const {
  switchBranch, // (messageId: string) => void
  getBranchInfo, // (messageId: string) => BranchInfo | null
  editMessage, // (messageId: string, newContent: string) => Promise<void>
  hasBranches, // boolean — true if any fork exists
  getAllMessages, // () => UIMessage[] — all branches, not just visible path
} = useCopilot();
```

### `useChat()`

```typescript
const {
  switchBranch,   // (messageId: string) => void
  getBranchInfo,  // (messageId: string) => BranchInfo | null
  editMessage,    // (messageId: string, newContent: string) => Promise<void>
  hasBranches,    // boolean
} = useChat({ ... });
```

### `<Chat />` props

```typescript
<Chat
  getBranchInfo={(messageId) => BranchInfo | null}
  onSwitchBranch={(messageId) => void}
  onEditMessage={(messageId, newContent) => void}
/>
```

### `BranchInfo` type

```typescript
interface BranchInfo {
  siblingIndex: number; // 0-based — which variant this is
  totalSiblings: number; // how many variants exist at this fork
  siblingIds: string[]; // ordered oldest-first
  hasPrevious: boolean;
  hasNext: boolean;
}
```

### `BranchNavigator` component (UI primitives)

```tsx
import { BranchNavigator } from "@yourgpt/copilot-sdk-ui";

<BranchNavigator
  siblingIndex={info.siblingIndex}
  totalSiblings={info.totalSiblings}
  hasPrevious={info.hasPrevious}
  hasNext={info.hasNext}
  onPrevious={() => switchBranch(info.siblingIds[info.siblingIndex - 1])}
  onNext={() => switchBranch(info.siblingIds[info.siblingIndex + 1])}
/>;
```

### `MessageTree` (framework-agnostic)

```typescript
import { MessageTree, type BranchInfo } from "@yourgpt/copilot-sdk";

const tree = new MessageTree(messages);
tree.getVisibleMessages(); // active path only
tree.getAllMessages(); // all branches
tree.getBranchInfo(messageId); // BranchInfo | null
tree.switchBranch(messageId);
tree.hasBranches; // boolean
```

---

## Database / Persistence Changes

### New columns needed

Two new optional columns on your messages table:

```sql
ALTER TABLE messages
  ADD COLUMN parent_id TEXT REFERENCES messages(id),
  ADD COLUMN children_ids JSONB DEFAULT '[]';
```

| Column         | Type                    | Nullable | Description                                                   |
| -------------- | ----------------------- | -------- | ------------------------------------------------------------- |
| `parent_id`    | `TEXT` / `VARCHAR`      | YES      | ID of parent message. `NULL` = root. Missing = legacy linear. |
| `children_ids` | `JSON` array of strings | YES      | Ordered child IDs for O(1) sibling lookup.                    |

> **These columns are optional.** Existing rows without them are auto-migrated to a linear tree on load via `fromFlatArray()`. No data loss. No required migration for existing rows.

### What gets saved now

When `onMessagesChange` fires (or the thread manager auto-saves), the payload contains **all messages across all branches**, not just the visible path. Each message carries:

```json
{
  "id": "msg-abc",
  "role": "assistant",
  "content": "...",
  "parent_id": "msg-xyz",
  "children_ids": []
}
```

### What gets loaded

When a thread is loaded (auto-restore or `switchThread`), the SDK maps:

```
DB row.parent_id     → UIMessage.parentId
DB row.children_ids  → UIMessage.childrenIds
```

The `MessageTree` is rebuilt from these fields. The last child at each fork becomes the active path (matches what was active when saved).

### localStorage (built-in persistence)

No changes needed. The SDK's `localStorageAdapter` serializes the full `Thread` object including messages. The new fields are automatically included when present.

### Server persistence (`serverAdapter`)

Your API endpoints that receive `PUT /threads/:id` payloads will now see `parent_id` and `children_ids` on each message object. Store them as-is. If your schema doesn't have these columns yet, the fields are simply ignored — no error.

### Upsert strategy (recommended)

Since branched conversations can have multiple messages with the same `parent_id`, always **upsert by message ID** rather than replacing the array:

```typescript
// ✅ Safe for branching
await db.messages.upsert({ id: msg.id, ...msg });

// ⚠️ Loses inactive branches
await db.threads.update({ messages: visibleMessages });
```

---

## User Adoption

### Zero-config (CopilotChat users)

If you use `<CopilotChat />`, branching is **already active**. No code changes needed.

- Edit button appears on hover over any user message
- `← 1/2 →` navigator appears below user messages when variants exist
- Regenerate creates a branch instead of overwriting

### Manual wiring (`<Chat />` users)

Wire the three props from `useCopilot()`:

```tsx
function MyChat() {
  const { switchBranch, getBranchInfo, editMessage } = useCopilot();

  return (
    <Chat
      getBranchInfo={getBranchInfo}
      onSwitchBranch={switchBranch}
      onEditMessage={editMessage}
    />
  );
}
```

### Custom message renderers

If you render messages manually, use `getBranchInfo` + `BranchNavigator`:

```tsx
function MyMessage({ message }) {
  const { switchBranch, getBranchInfo } = useCopilot();
  const info = message.role === "user" ? getBranchInfo(message.id) : null;

  return (
    <div>
      <p>{message.content}</p>
      {info && (
        <BranchNavigator
          {...info}
          onPrevious={() =>
            switchBranch(info.siblingIds[info.siblingIndex - 1])
          }
          onNext={() => switchBranch(info.siblingIds[info.siblingIndex + 1])}
        />
      )}
    </div>
  );
}
```

### Programmatic branching

```typescript
// Edit a message (creates new branch from same parent)
await editMessage("msg-abc", "Updated question text");

// Navigate between variants
switchBranch("msg-xyz");

// Check if branches exist
if (hasBranches) {
  const info = getBranchInfo("msg-abc");
  // info.totalSiblings, info.siblingIndex, etc.
}

// Persist all branches (not just visible path)
const allMessages = getAllMessages();
await saveToServer(allMessages);
```

---

## Framework-Agnostic Usage

All branching primitives are exported from the core package (no React required):

```typescript
import { MessageTree, type BranchInfo } from "@yourgpt/copilot-sdk";

// Build a tree from saved messages
const tree = new MessageTree(savedMessages);

// Get what to send to the AI (active path only)
const apiMessages = tree.getVisibleMessages();

// Get everything to persist
const allMessages = tree.getAllMessages();

// Navigate
tree.switchBranch(messageId);
const info = tree.getBranchInfo(messageId); // BranchInfo | null

// Migrate legacy flat arrays
const linked = MessageTree.fromFlatArray(legacyMessages);
```

---

## How It Works Internally

### Data structure

Each message carries two optional fields:

```
parentId: string | null | undefined
  null      = root message (first in conversation)
  undefined = legacy linear message (pre-branching)
  string    = ID of parent message

childrenIds: string[]
  Ordered list of direct child IDs (oldest-first)
```

The `MessageTree` maintains three maps:

| Map              | Key                      | Value           | Purpose                           |
| ---------------- | ------------------------ | --------------- | --------------------------------- |
| `nodeMap`        | messageId                | Message         | O(1) message lookup               |
| `childrenOf`     | parentId (or `__root__`) | `string[]`      | All children at a fork            |
| `activeChildMap` | parentId                 | active child ID | Which branch is currently visible |

### Regenerate flow

```
Before:  user → assistant-A
                    ↑ currentLeaf

1. setCurrentLeaf(user.id)   → rewind to user
2. processRequest()          → AI generates assistant-B
3. addMessage(assistant-B)   → becomes active child of user

After:   user → assistant-A  (inactive, navigable via ←)
              ↘ assistant-B  (active)
```

### Edit flow

```
Before:  user-A → assistant-A

1. sendMessage("new text", { editMessageId: "user-A" })
2. newParentId = user-A.parentId (= null, root)
3. setCurrentLeaf(null)          → rewind to before user-A
4. create user-B with parentId=null
5. processRequest()              → AI generates assistant-B

After:  user-A → assistant-A  (inactive)
        user-B → assistant-B  (active)
```

### Visible path vs all messages

```
getAllMessages()       → every message across every branch (for persistence)
getVisibleMessages()  → root → currentLeaf along activeChildMap (for UI + API)
```

The API always receives `getVisibleMessages()`. Inactive branches are never sent to the model.
