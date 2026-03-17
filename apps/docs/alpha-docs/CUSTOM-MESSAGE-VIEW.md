# Custom Message View

> `release/alpha` — adds a `messageView` prop to `CopilotChat` / `Chat` that gives full control over how the message list is rendered. Inject custom UI, conditionally replace messages based on `metadata.type`, or build entirely custom layouts — without touching roles or message history.

---

## Table of Contents

1. [What Was Built](#what-was-built)
2. [Breaking Changes](#breaking-changes)
3. [New API](#new-api)
4. [Usage Examples](#usage-examples)
5. [How It Works Internally](#how-it-works-internally)
6. [Roadmap — Chat.\* Primitives](#roadmap--chat-primitives)

---

## What Was Built

A `messageView` prop on `<CopilotChat>` / `<Chat>` that intercepts message list rendering.

You receive:

- **`messageElements`** — pre-rendered default SDK elements (one per message, may include `null` for filtered messages)
- **`messages`** — raw `ChatMessage[]` for conditional logic

This closes the use case from **issue #74** (custom message types with dedicated renderers) without touching the `role` union or message history format.

---

## Breaking Changes

**None.** Fully additive. Existing `renderMessage`, `toolRenderers`, and all other props are unchanged.

---

## New API

### `messageView` prop

Added to `ChatProps` (and flows through to `CopilotChat` via `...chatProps`).

```ts
messageView?: {
  children?: (props: {
    /** Raw messages array */
    messages: ChatMessage[];
    /** Pre-rendered default SDK elements, one per message */
    messageElements: React.ReactNode[];
  }) => React.ReactNode;
};
```

---

## Usage Examples

### Inject custom UI below messages

```tsx
<CopilotChat
  messageView={{
    children: ({ messageElements }) => (
      <>
        {messageElements}
        <div className="p-4 text-center text-sm text-muted-foreground">
          Powered by YourGPT
        </div>
      </>
    ),
  }}
/>
```

### Custom message types via `metadata.type`

Inject a custom message into the chat (e.g. from a tool handler or agent state), then render it with your own component:

```tsx
<CopilotChat
  messageView={{
    children: ({ messages, messageElements }) => (
      <>
        {messages.map((message, i) => {
          if (message.metadata?.type === "plan") {
            return <PlanCard key={message.id} data={message.metadata} />;
          }
          if (message.metadata?.type === "approval") {
            return <ApprovalCard key={message.id} data={message.metadata} />;
          }
          return messageElements[i];
        })}
      </>
    ),
  }}
/>
```

### Combine with agent state

```tsx
function Chat() {
  const agentState = useMyAgentState();

  return (
    <CopilotChat
      messageView={{
        children: ({ messageElements }) => (
          <div className="flex flex-col gap-4">
            {messageElements}
            {agentState?.steps && <TaskProgress steps={agentState.steps} />}
          </div>
        ),
      }}
    />
  );
}
```

---

## How It Works Internally

**Files changed:** `types.ts`, `chat.tsx` (2 files, ~30 lines total)

In `chat.tsx`, the `messages.map(...)` loop is wrapped in an IIFE that collects rendered elements into a `messageElements` array first, then either:

- Passes them to `messageView.children({ messages, messageElements })` if provided
- Or renders them directly (existing behaviour)

```tsx
{
  (() => {
    const messageElements = messages.map((message, index) => {
      // ...existing render logic unchanged...
    });

    return messageView?.children
      ? messageView.children({ messages, messageElements })
      : messageElements;
  })();
}
```

The loading placeholder and scroll anchor remain outside this block and are unaffected.

`connected-chat.tsx` required no changes — `messageView` flows through automatically via `...chatProps`.

---

## `Chat.*` Primitives — Now Shipped

The headless primitive API described here as a roadmap item has shipped in this same alpha. You can use it today:

```tsx
import { ChatPrimitives as Chat } from "@yourgpt/copilot-sdk/ui";

<CopilotChat>
  <Chat.MessageList>
    {(message) =>
      message.metadata?.type === "plan" ? (
        <PlanCard key={message.id} />
      ) : (
        <Chat.DefaultMessage key={message.id} message={message} />
      )
    }
  </Chat.MessageList>
</CopilotChat>;
```

`messageView` remains the simpler option for quick overrides. `Chat.MessageList` is the lower-level primitive when you need full layout control. Both work — no migration needed between them.

→ Full primitives docs: [CHAT-PRIMITIVES.md](./CHAT-PRIMITIVES.md)
