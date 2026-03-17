# Message Actions

> `release/alpha` — adds a compound component API for registering floating action buttons on chat messages. Declarative, role-based, fully composable — same pattern as shadcn/Radix.

---

## Table of Contents

1. [What Was Built](#what-was-built)
2. [Breaking Changes](#breaking-changes)
3. [New APIs](#new-apis)
4. [Usage Examples](#usage-examples)
5. [How It Works Internally](#how-it-works-internally)
6. [Also Shipped — ChatPrimitives Namespace](#also-shipped--chatprimitives-namespace)

---

## What Was Built

A compound component API for adding floating action buttons to chat messages — copy, edit, feedback, or fully custom actions — declared as children of `<CopilotChat>`.

Actions appear on hover, floating below the message bubble. Role-based — configure `assistant` and `user` separately.

---

## Breaking Changes

**None.** If no `<CopilotChat.MessageActions>` children are declared, nothing changes. Existing chat UI looks and behaves identically.

---

## New APIs

### Compound components

```
CopilotChat.MessageActions   — registers actions for a role
CopilotChat.CopyAction       — built-in copy to clipboard (with check feedback)
CopilotChat.EditAction       — built-in edit (user messages, wired to inline edit)
CopilotChat.FeedbackAction   — built-in thumbs up/down
CopilotChat.Action           — fully custom action
```

### Props

```tsx
// MessageActions
role: "user" | "assistant"

// CopyAction
tooltip?: string
className?: string

// EditAction
tooltip?: string
className?: string

// FeedbackAction
onFeedback?: (message: ChatMessage, type: "helpful" | "not-helpful") => void
tooltip?: string
className?: string

// Action
id?: string
icon: ReactNode
tooltip: string
onClick: (props: { message: ChatMessage }) => void
hidden?: boolean | ((props: { message: ChatMessage }) => boolean)
className?: string
```

---

## Usage Examples

### Zero config — no actions (default)

```tsx
<CopilotChat />
// No action buttons shown — clean slate
```

---

### Copy on assistant, Edit on user

```tsx
<CopilotChat>
  <CopilotChat.MessageActions role="assistant">
    <CopilotChat.CopyAction />
  </CopilotChat.MessageActions>

  <CopilotChat.MessageActions role="user">
    <CopilotChat.EditAction />
  </CopilotChat.MessageActions>
</CopilotChat>
```

---

### Copy + Feedback on assistant

```tsx
<CopilotChat>
  <CopilotChat.MessageActions role="assistant">
    <CopilotChat.CopyAction />
    <CopilotChat.FeedbackAction
      onFeedback={(message, type) => {
        sendFeedback({ messageId: message.id, type });
      }}
    />
  </CopilotChat.MessageActions>
</CopilotChat>
```

---

### Custom action

```tsx
<CopilotChat>
  <CopilotChat.MessageActions role="assistant">
    <CopilotChat.CopyAction />
    <CopilotChat.Action
      icon={<ShareIcon />}
      tooltip="Share"
      onClick={({ message }) => share(message.content)}
    />
  </CopilotChat.MessageActions>
</CopilotChat>
```

---

### Conditional action (hide based on message)

```tsx
<CopilotChat>
  <CopilotChat.MessageActions role="assistant">
    <CopilotChat.CopyAction />
    <CopilotChat.Action
      icon={<FlagIcon />}
      tooltip="Report"
      hidden={({ message }) => !message.content}
      onClick={({ message }) => report(message.id)}
    />
  </CopilotChat.MessageActions>
</CopilotChat>
```

---

### Disable all actions for a role

```tsx
<CopilotChat>
  <CopilotChat.MessageActions role="assistant">
    {/* empty — no actions for assistant */}
  </CopilotChat.MessageActions>
</CopilotChat>
```

---

### Full setup — both roles

```tsx
<CopilotChat>
  <CopilotChat.MessageActions role="assistant">
    <CopilotChat.CopyAction />
    <CopilotChat.FeedbackAction onFeedback={(msg, type) => log(msg.id, type)} />
    <CopilotChat.Action
      icon={<BookmarkIcon />}
      tooltip="Save"
      onClick={({ message }) => save(message)}
    />
  </CopilotChat.MessageActions>

  <CopilotChat.MessageActions role="user">
    <CopilotChat.EditAction />
    <CopilotChat.Action
      icon={<DeleteIcon />}
      tooltip="Delete"
      onClick={({ message }) => deleteMessage(message.id)}
    />
  </CopilotChat.MessageActions>
</CopilotChat>
```

---

## How It Works Internally

**Files created/modified:**

- `message-actions-context.tsx` _(new)_ — React context storing registered actions per role
- `message-actions-compound.tsx` _(new)_ — compound components (`MessageActions`, `CopyAction`, `EditAction`, `FeedbackAction`, `Action`)
- `chat.tsx` — wrapped with `MessageActionsProvider`, compound components added to `Chat.*` namespace
- `default-message.tsx` — `FloatingActions` helper reads from context, renders on `group-hover/message`

**Flow:**

1. `<CopilotChat.MessageActions role="assistant">` scans its children's props via `React.Children.forEach`, builds a `RegisteredAction[]`
2. `useLayoutEffect` registers them into `MessageActionsContext`
3. `DefaultMessage` renders `<FloatingActions>` for each message
4. `FloatingActions` calls `ctx.getActions(role)` — if empty, renders nothing

**Copy action** has local state (`copiedId`) — switches icon to ✓ for 1.5s then reverts.

**Edit action** routes to the existing `startEdit()` function already in `DefaultMessage` — no duplication.

---

## Also Shipped — `ChatPrimitives` Namespace

A `ChatPrimitives` export was also added for headless composition:

```tsx
import { ChatPrimitives as Chat } from "@yourgpt/copilot-sdk-ui";

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

| Primitive             | Description                                  |
| --------------------- | -------------------------------------------- |
| `Chat.MessageList`    | Render-prop message list, reads from context |
| `Chat.DefaultMessage` | Full SDK message bubble, use as fallback     |
| `Chat.Header`         | Chat header bar                              |
| `Chat.Welcome`        | Welcome screen (no messages)                 |
| `Chat.Input`          | Composer / input box                         |
| `Chat.ScrollAnchor`   | Auto-scroll anchor                           |
| `Chat.Message`        | Low-level row wrapper                        |
| `Chat.MessageAvatar`  | Avatar with fallback                         |
| `Chat.MessageContent` | Content bubble, supports markdown            |
| `Chat.MessageActions` | Action bar layout primitive                  |
| `Chat.MessageAction`  | Single action button with tooltip            |
| `Chat.Loader`         | Streaming indicator                          |
