# Chat Primitives

> `release/alpha` — ships two complementary APIs for headless chat customization: the `ChatPrimitives` namespace (low-level building blocks) and compound components on `CopilotChat.*` (MessageActions, MessageList, DefaultMessage, etc.). Both are non-breaking additive exports.

---

## Table of Contents

1. [What Was Built](#what-was-built)
2. [Breaking Changes](#breaking-changes)
3. [ChatPrimitives Namespace](#chatprimitives-namespace)
4. [CopilotChat Compound Components](#copilotchat-compound-components)
5. [Usage Examples](#usage-examples)
6. [How It Works Internally](#how-it-works-internally)
7. [Relation to `messageView`](#relation-to-messageview)

---

## What Was Built

Two exports that let you compose custom chat UIs at any level of abstraction while the SDK handles all state, streaming, and context internally.

**`ChatPrimitives`** — a named export of individual low-level components. Useful when you import under an alias and want to pick specific pieces.

**`CopilotChat.*` compound extensions** — the same primitives accessible directly on the `CopilotChat` component for inline composition without extra imports.

---

## Breaking Changes

**None.** Both are purely additive. Existing `<CopilotChat />` usage is untouched.

---

## ChatPrimitives Namespace

```tsx
import { ChatPrimitives as Chat } from "@yourgpt/copilot-sdk/ui";
```

### All Primitives

| Primitive             | Description                                               |
| --------------------- | --------------------------------------------------------- |
| `Chat.MessageList`    | Render-prop message list — reads `messages` from context  |
| `Chat.DefaultMessage` | Full SDK message bubble — use as fallback in custom lists |
| `Chat.Header`         | Chat header bar                                           |
| `Chat.Welcome`        | Welcome screen shown when there are no messages           |
| `Chat.Input`          | Composer / input box                                      |
| `Chat.ScrollAnchor`   | Auto-scroll anchor, place at end of message list          |
| `Chat.Message`        | Low-level message row wrapper                             |
| `Chat.MessageAvatar`  | Avatar with fallback initials                             |
| `Chat.MessageContent` | Content bubble — renders markdown, supports streaming     |
| `Chat.MessageActions` | Action bar layout primitive (wraps action buttons)        |
| `Chat.MessageAction`  | Single action icon button with tooltip                    |
| `Chat.Loader`         | Streaming / thinking indicator                            |

### `Chat.MessageList` props

```ts
interface MessageListProps {
  children?: (message: ChatMessage, index: number) => React.ReactNode;
  className?: string;
}
```

When `children` is provided, called once per message — return your custom component or fall back to `Chat.DefaultMessage`. When omitted, renders all messages with `DefaultMessage`.

---

## CopilotChat Compound Components

The `ChatPrimitives` are also mounted on the `CopilotChat` export:

```tsx
import { CopilotChat } from "@yourgpt/copilot-sdk/ui";

CopilotChat.MessageActions; // compound action registrar (see MESSAGE-ACTIONS.md)
CopilotChat.CopyAction; // built-in copy button
CopilotChat.EditAction; // built-in inline edit button
CopilotChat.FeedbackAction; // built-in thumbs up/down
CopilotChat.Action; // custom action button
```

These are the action-registration compound components — see [MESSAGE-ACTIONS.md](./MESSAGE-ACTIONS.md) for full docs.

---

## Usage Examples

### Custom message type with fallback

```tsx
import { ChatPrimitives as Chat } from "@yourgpt/copilot-sdk/ui";

<CopilotChat>
  <Chat.MessageList>
    {(message) =>
      message.metadata?.type === "plan" ? (
        <PlanCard key={message.id} message={message} />
      ) : (
        <Chat.DefaultMessage key={message.id} message={message} />
      )
    }
  </Chat.MessageList>
</CopilotChat>;
```

---

### Fully custom layout — compose from scratch

```tsx
import { ChatPrimitives as Chat } from "@yourgpt/copilot-sdk/ui";

<CopilotChat>
  <div className="flex flex-col h-full">
    <Chat.Header />
    <Chat.Welcome />

    <div className="flex-1 overflow-y-auto px-4">
      <Chat.MessageList>
        {(message) => (
          <Chat.Message key={message.id} message={message}>
            <Chat.MessageAvatar message={message} />
            <Chat.MessageContent message={message} />
          </Chat.Message>
        )}
      </Chat.MessageList>
      <Chat.Loader />
      <Chat.ScrollAnchor />
    </div>

    <Chat.Input />
  </div>
</CopilotChat>;
```

---

### Mix primitives with message actions

```tsx
import { ChatPrimitives as Chat } from "@yourgpt/copilot-sdk/ui";

<CopilotChat>
  {/* Register floating action buttons */}
  <CopilotChat.MessageActions role="assistant">
    <CopilotChat.CopyAction />
    <CopilotChat.FeedbackAction onFeedback={(msg, type) => log(msg.id, type)} />
  </CopilotChat.MessageActions>

  {/* Custom message list */}
  <Chat.MessageList>
    {(message) =>
      message.metadata?.type === "approval" ? (
        <ApprovalCard key={message.id} message={message} />
      ) : (
        <Chat.DefaultMessage key={message.id} message={message} />
      )
    }
  </Chat.MessageList>
</CopilotChat>;
```

---

### Per-message action buttons (using primitives directly)

```tsx
import { ChatPrimitives as Chat } from "@yourgpt/copilot-sdk/ui";

<Chat.MessageList>
  {(message) => (
    <Chat.Message key={message.id} message={message}>
      <Chat.MessageAvatar message={message} />
      <div className="flex flex-col gap-1">
        <Chat.MessageContent message={message} />
        <Chat.MessageActions>
          <Chat.MessageAction
            icon={<CopyIcon />}
            tooltip="Copy"
            onClick={() => navigator.clipboard.writeText(message.content ?? "")}
          />
        </Chat.MessageActions>
      </div>
    </Chat.Message>
  )}
</Chat.MessageList>;
```

---

## How It Works Internally

**State access:** `Chat.MessageList` reads `messages` and `registeredTools` from `CopilotChatInternalContext` — the same context `chat.tsx` already provides. No extra wiring needed.

**`messages` + `registeredTools` in context:** Added to `CopilotChatInternalContext` so primitives can access them without prop drilling. `connected-chat.tsx` was unchanged — values flow through the existing context setup in `chat.tsx`.

**Files created/modified:**

- `message-list.tsx` _(new)_ — `Chat.MessageList` component
- `chat.tsx` — added `messages` + `registeredTools` to `CopilotChatInternalContext`; extended `Chat` compound object with `MessageActions`, `CopyAction`, `EditAction`, `FeedbackAction`, `Action`
- `ui/index.ts` — added `ChatPrimitives` export
- `chat/index.ts` — added `MessageList`, all action compound types

---

## Relation to `messageView`

`messageView` prop (see [CUSTOM-MESSAGE-VIEW.md](./CUSTOM-MESSAGE-VIEW.md)) and `Chat.MessageList` solve the same use case — custom message rendering — at different abstraction levels:

|             | `messageView`                                            | `Chat.MessageList`                            |
| ----------- | -------------------------------------------------------- | --------------------------------------------- |
| Style       | Prop on `<CopilotChat>`                                  | Child component inside `<CopilotChat>`        |
| Access      | `messages[]` + pre-rendered `messageElements[]`          | `messages[]` via render-prop                  |
| When to use | Quick overrides, inject extra UI around existing renders | Full layout control, building from primitives |

Both are non-breaking and can coexist. `messageView` remains the simpler option for most cases.
