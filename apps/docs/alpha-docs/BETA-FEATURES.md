# Beta Features — Complete List

> All features present in `beta` branch but **not yet in `main`** (production).
> Organised by SDK package. Docs/alpha-doc status noted per feature.

---

## Copilot SDK (`@yourgpt/copilot-sdk`)

### 1. Conversation Branching

Edit any user message to fork a new parallel conversation path. Each edit spawns a sibling branch; `← N/M →` arrows let the user navigate between variants — same UX pattern as ChatGPT, Claude.ai, and Gemini.

- **API:** `allowEdit` prop on `<CopilotChat>` · `switchBranch()` · `getAllMessages()` · `BranchNavigator` component
- **Package:** `@yourgpt/copilot-sdk/react` + `@yourgpt/copilot-sdk/ui`
- **Docs page:** `content/docs/chat/branching.mdx`
- **Alpha-doc:** `alpha-docs/BRANCHING.md`

---

### 2. Message History Compaction

Automatic context-window management. When token usage crosses a configurable threshold the SDK compacts old messages using a chosen strategy, without ever shrinking the display history the user sees.

- **Strategies:** `none` (default) · `sliding-window` · `selective-prune` · `summary-buffer` (recommended)
- **API:** `messageHistory` prop on `<CopilotProvider>` · `useMessageHistory()` hook · `compactSession(instructions?)` for manual trigger
- **Package:** `@yourgpt/copilot-sdk/react`
- **Docs page:** `content/docs/context/compaction.mdx`
- **Alpha-doc:** `alpha-docs/message-history-compaction.md`

---

### 3. Skills System

On-demand instruction playbooks the AI loads at runtime. Skills are Markdown files or inline strings. Keeps the system prompt lean by deferring behaviour descriptions until the AI actually needs them.

- **Strategies:** `eager` (always injected) · `auto` (AI calls `load_skill` tool on demand) · `manual` (accessible but not advertised)
- **API:** `<SkillProvider skills={[...]}>` · `defineSkill()` · `useSkill()` · `useSkillStatus()`
- **Package:** `@yourgpt/copilot-sdk/react`
- **Docs page:** `content/docs/skills/client.mdx` + `content/docs/skills/server.mdx`
- **Alpha-doc:** `alpha-docs/SKILLS.md` + `alpha-docs/skills-system.md`

---

### 4. Chat Primitives (`ChatPrimitives` namespace)

A complete set of low-level building blocks for composing fully custom chat UIs. Every primitive reads state from SDK context internally — no manual wiring needed.

- **Primitives:** `MessageList` · `DefaultMessage` · `Header` · `Welcome` · `Input` · `ScrollAnchor` · `Message` · `MessageAvatar` · `MessageContent` · `MessageActions` · `MessageAction` · `Loader`
- **API:** `import { ChatPrimitives as Chat } from "@yourgpt/copilot-sdk/ui"` or via `CopilotChat.*` compound extensions
- **Package:** `@yourgpt/copilot-sdk/ui`
- **Docs page:** `content/docs/customizations/chat-primitives.mdx`
- **Alpha-doc:** `alpha-docs/CHAT-PRIMITIVES.md`

---

### 5. Custom Message View (`messageView` prop)

Intercepts the message-list render loop and hands both raw messages and pre-rendered SDK elements to a render-prop callback. Use it to inject custom UI, conditionally replace messages by type, or build entirely custom layouts.

- **API:** `<CopilotChat messageView={{ children: ({ messages, messageElements }) => ReactNode }} />`
- **Package:** `@yourgpt/copilot-sdk/ui`
- **Docs page:** `content/docs/customizations/custom-message-view.mdx`
- **Alpha-doc:** `alpha-docs/CUSTOM-MESSAGE-VIEW.md`

---

### 6. Message Actions (Compound Components)

Declarative floating action buttons on chat messages — copy, inline edit, thumbs up/down, or fully custom actions. Role-based configuration (user vs assistant). Appears on hover; same compound-component pattern as shadcn/Radix.

- **API:** `CopilotChat.MessageActions` · `CopilotChat.CopyAction` · `CopilotChat.EditAction` · `CopilotChat.FeedbackAction` · `CopilotChat.Action`
- **Package:** `@yourgpt/copilot-sdk/ui`
- **Docs page:** `content/docs/chat/message-actions.mdx`
- **Alpha-doc:** `alpha-docs/MESSAGE-ACTIONS.md`

---

### 7. File Attachments

Drag-and-drop file and media attachments in chat. Includes an `AttachmentStrip` thumbnail strip, a drop-zone overlay, upload error handling, and automatic forwarding to the server runtime.

- **API:** Auto-enabled when `runtimeUrl` is set · `useAttachments()` for headless access
- **Package:** `@yourgpt/copilot-sdk/ui`
- **Docs page:** `content/docs/attachments.mdx`
- **Alpha-doc:** ✗ not covered

---

### 8. Headless Primitives (`useCopilotEvent` + `useMessageMeta`)

Subscribe to raw stream events and read per-message metadata without using any SDK UI components. The foundation for building fully headless integrations (Slack bots, custom renderers, etc.).

- **Events:** `thinking:delta` · `action:start` · `action:end` · `loop:iteration` · `*` (catch-all)
- **API:** `useCopilotEvent(event, handler)` · `useMessageMeta(messageId)` → `{ tokenUsage, metadata }`
- **Package:** `@yourgpt/copilot-sdk/react`
- **Docs page:** `content/docs/headless.mdx`
- **Alpha-doc:** ✗ not covered

---

### 9. Context Stats (`useContextStats`)

Real-time reactive context window usage. Returns token counts and percentages updated after every LLM call, plus a convenient chars-based estimate before the first send.

- **API:** `const { contextUsage, totalTokens, usagePercent } = useContextStats()`
- **Package:** `@yourgpt/copilot-sdk/react`
- **Docs page:** `content/docs/context/token-tracking.mdx`
- **Alpha-doc:** `alpha-docs/CONTEXT-MANAGEMENT.md` §5

---

### 10. Thread Management + Thread Picker

Enhanced multi-thread support with `activeLeafId` (tracks the active conversation leaf), a `ThreadPicker` UI component for switching between saved threads, and a localStorage adapter for zero-config thread persistence.

- **API:** `<ThreadPicker />` from `@yourgpt/copilot-sdk/ui` · `useThread()` hook · `localStorageAdapter`
- **Package:** `@yourgpt/copilot-sdk/react` + `@yourgpt/copilot-sdk/ui`
- **Docs page:** `content/docs/context/session.mdx` (partial)
- **Alpha-doc:** ✗ not covered

---

### 11. Agent Iteration Tracking

Track how many tool-use loops the agent has run in a single turn. Enforce a `maxAgentIterations` cap to prevent runaway loops. Exposes checkpoint exports for state inspection.

- **API:** `agentIteration` value from `useContextStats()` · `maxAgentIterations` on `<CopilotProvider>` · `allowEdit` prop on `<CopilotChat>`
- **Package:** `@yourgpt/copilot-sdk/react`
- **Docs page:** `content/docs/tools/agentic-loop.mdx`
- **Alpha-doc:** `alpha-docs/CONTEXT-MANAGEMENT.md` §6

---

### 12. Deferred Tools

Tools not eagerly sent to the LLM. Instead they sit in a registry and are only included in the request when the user message semantically matches them via BM25 search. Reduces tokens significantly for large tool sets.

- **API:** `useTool({ name: "...", deferred: true, description: "...", ... })`
- **Package:** `@yourgpt/copilot-sdk/react`
- **Docs page:** `content/docs/tools/deferred-tools.mdx`
- **Alpha-doc:** `alpha-docs/CONTEXT-MANAGEMENT.md` §7

---

### 13. Hidden Tools

Tools registered with the SDK but never sent to the LLM. Used for client-side execution the AI triggers indirectly, or for internal state mutations that should never appear in the model's tool list.

- **API:** `useTool({ name: "...", hidden: true, ... })`
- **Package:** `@yourgpt/copilot-sdk/react`
- **Docs page:** `content/docs/tools/hidden-tools.mdx`
- **Alpha-doc:** `alpha-docs/CONTEXT-MANAGEMENT.md` §7

---

### 14. Fallback Tool Renderer

A catch-all render function for tool calls that have no registered renderer. Prevents unknown or dynamically-named tool calls from showing a blank area in the chat.

- **API:** `<CopilotChat fallbackToolRenderer={(tool) => <MyFallback tool={tool} />} />`
- **Package:** `@yourgpt/copilot-sdk/ui`
- **Docs page:** partial — `content/docs/tools/` section
- **Alpha-doc:** `alpha-docs/CONTEXT-MANAGEMENT.md` §7

---

### 15. Message Grouping

Consecutive tool call + tool result pairs are visually grouped in the chat UI instead of rendering as separate message bubbles. Keeps the conversation thread readable during multi-step agent runs.

- **API:** Automatic — internal `groupConsecutiveToolMessages` config
- **Package:** `@yourgpt/copilot-sdk/ui`
- **Docs page:** ✗ no dedicated page
- **Alpha-doc:** `alpha-docs/CONTEXT-MANAGEMENT.md` §8

---

### 16. CSS Class Reference

Comprehensive reference for all `csdk-*` CSS classes applied to every chat UI element. Enables deterministic custom theming without touching component internals.

- **API:** Target `.csdk-chat` · `.csdk-message` · `.csdk-input` · `.csdk-overlay` etc. in your stylesheets
- **Package:** `@yourgpt/copilot-sdk/ui`
- **Docs page:** `content/docs/customizations/css-classes.mdx`
- **Alpha-doc:** ✗ not covered

---

### 17. Generative UI — Experimental

The AI can render rich HTML components inline inside the chat using Tailwind CSS and Chart.js, generated from tool call results. Ships with a single `HtmlRenderer` in a sandboxed iframe.

- **Renderer:** `HtmlRenderer` (sandboxed iframe with Tailwind CSS + Chart.js)
- **API:** `import { generativeUITool, useGenerativeUI } from "@yourgpt/copilot-sdk/experimental"` — register `generativeUITool` as a tool, use `useGenerativeUI()` to render results
- **Package:** `@yourgpt/copilot-sdk/experimental`
- **Docs page:** `content/docs/generative-ui.mdx` (page existed on main; full demo + renderers added in beta)
- **Alpha-doc:** ✗ not covered

---

### 18. Streaming Enhancements (Pre-created Message IDs)

Messages receive stable IDs before streaming begins, enabling optimistic UI updates, correct server-side event ordering, and `useMessageMeta()` access from the very first chunk.

- **API:** Internal — no breaking API change. Consumed transparently by `useMessageMeta(id)`.
- **Package:** `@yourgpt/copilot-sdk` (core)
- **Docs page:** ✗ not documented
- **Alpha-doc:** ✗ not covered

---

## LLM SDK (`@yourgpt/llm-sdk`)

### 19. Fallback Chain & Routing Strategies

Chain multiple LLM providers or models with automatic failover. Supports `priority` (try in order) and `round-robin` routing. Per-model retry with exponential or fixed backoff. Pluggable `RoutingStore` for serverless environments (Redis, Upstash, Cloudflare KV).

- **API:** `createFallbackChain([provider1, provider2], { routing: "round-robin", retries: 3, backoff: "exponential", onFallback, onRetry })` → pass result to `createRuntime({ provider: chain })`
- **Package:** `@yourgpt/llm-sdk` — `fallback` module
- **Docs page:** `content/docs/providers/fallback.mdx`
- **Alpha-doc:** ✗ not covered

---

### 20. Tool Profiles + BM25 Tool Search

For large tool sets (50+ tools), tools are grouped into named profiles and ranked per-request using BM25. Only the most relevant tools are forwarded to the LLM, keeping per-request token cost low. Also supports native provider search (Anthropic / OpenAI).

- **API:** `createRuntime({ toolProfiles: { defaultProfile: "core", profiles: { ... } }, maxEagerTools: 20, exposeWhenExceeds: 40 })`
- **Package:** `@yourgpt/llm-sdk/server`
- **Docs page:** ✗ no dedicated page yet
- **Alpha-doc:** `alpha-docs/CONTEXT-MANAGEMENT.md` §7

---

### 21. YourGPT Provider (`createYourGPT`)

First-party storage adapter for the YourGPT backend. Plugging it into `createRuntime({ storage })` auto-creates sessions on first message, persists every user message + assistant response + tool pair, and provides a one-liner file upload endpoint.

- **API:** `import { createYourGPT } from "@yourgpt/llm-sdk/yourgpt"` → `createRuntime({ provider, model, storage: createYourGPT({ apiKey, widgetUid }) })`
- **Package:** `@yourgpt/llm-sdk/yourgpt`
- **Docs page:** `content/docs/server/storage.mdx`
- **Alpha-doc:** `alpha-docs/STORAGE-ADAPTER.md`

---

### 22. Resolvable Pattern

Any runtime config value — system prompt, model ID, tools list, max tokens — can be a static value, a synchronous function, or an async function. Evaluated fresh on every request, enabling per-user or per-tenant dynamic configuration.

- **API:** `createRuntime({ systemPrompt: async (req) => getPromptFor(req.userId), model: (req) => req.body.model ?? "gpt-4o" })`
- **Package:** `@yourgpt/llm-sdk` + `@yourgpt/copilot-sdk`
- **Docs page:** ✗ no dedicated page
- **Alpha-doc:** ✗ not covered

---

### 23. New Provider Adapters (Azure, xAI, Ollama)

Official adapters for Azure OpenAI, xAI (Grok), and Ollama (local models) added alongside the existing OpenAI, Anthropic, and Google adapters. Drop-in compatible with `createRuntime` and the fallback chain.

- **API:** `import { createAzure } from "@yourgpt/llm-sdk/azure"` · `import { createXAI } from "@yourgpt/llm-sdk/xai"` · `import { createOllama } from "@yourgpt/llm-sdk/ollama"`
- **Package:** `@yourgpt/llm-sdk`
- **Docs page:** `content/docs/providers/xai.mdx` + `content/docs/providers/ollama.mdx` (existed on main)
- **Alpha-doc:** ✗ not covered

---

### 24. Context Budget / Tool Result Truncation

Automatically truncates tool results that exceed `toolResultMaxChars` before they are included in the LLM context, preventing a single large tool response from blowing the context window.

- **API:** `<CopilotProvider messageHistory={{ toolResultMaxChars: 80_000 }}>` (client) · runtime enforces server-side
- **Package:** `@yourgpt/llm-sdk/server` + `@yourgpt/copilot-sdk`
- **Docs page:** `content/docs/context/compaction.mdx` (partial)
- **Alpha-doc:** `alpha-docs/CONTEXT-MANAGEMENT.md` + `alpha-docs/message-history-compaction.md`

---

### 25. Server-side Compaction Endpoint

A `compactSession()` function on the server runtime that summarises a stored conversation before the next LLM call. Pairs with the client-side compaction system and can be triggered via a dedicated API route.

- **API:** `runtime.compactSession(threadId, instructions?)`
- **Package:** `@yourgpt/llm-sdk/server`
- **Docs page:** `content/docs/context/compaction.mdx`
- **Alpha-doc:** `alpha-docs/message-history-compaction.md`

---

## Missing Docs Summary

Features that are **in beta code** but have **no proper docs page** yet:

| Feature                                  | SDK                       | Coverage               |
| ---------------------------------------- | ------------------------- | ---------------------- |
| Tool Profiles + BM25 Tool Search         | `llm-sdk`                 | Alpha-doc only         |
| Message Grouping                         | `copilot-sdk`             | Alpha-doc only (brief) |
| Thread Picker (full guide)               | `copilot-sdk`             | Not documented         |
| Resolvable Pattern                       | `llm-sdk` + `copilot-sdk` | Not documented         |
| Fallback Tool Renderer                   | `copilot-sdk`             | Alpha-doc only         |
| Streaming Enhancements (pre-created IDs) | `copilot-sdk`             | Not documented         |
