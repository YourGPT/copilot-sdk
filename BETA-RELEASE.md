# Beta Release Reel

Five headline features shipping in the Copilot SDK beta.

---

## 1. Skills System

On-demand instruction playbooks the AI loads at runtime. Keep prompts lean — behavior is injected only when relevant.

|         | Path                                       |
| ------- | ------------------------------------------ |
| Docs    | `apps/docs/content/docs/skills/index.mdx`  |
|         | `apps/docs/content/docs/skills/client.mdx` |
|         | `apps/docs/content/docs/skills/server.mdx` |
| Example | `examples/skills-demo/`                    |

**Highlights:** Three strategies (eager, auto, manual) — inline + file + URL sources — `defineSkill()` helper — collision detection — `load_skill` tool auto-registered.

---

## 2. Generative UI

AI renders structured UI components — cards, tables, stat tiles, HTML — inline inside the chat. Not just text.

|         | Path                                       |
| ------- | ------------------------------------------ |
| Docs    | `apps/docs/content/docs/generative-ui.mdx` |
| Example | `examples/generative-ui-demo/`             |

**Highlights:** Built-in renderers (Card, Table, Stat, Html) — `useGenerativeUI()` hook — `toolRenderers` map for custom components — iframe sandbox for AI-generated HTML.

---

## 3. Fallback Chain & Routing

Chain multiple LLM providers with automatic failover. One runtime, multiple models, zero downtime.

|         | Path                                            |
| ------- | ----------------------------------------------- |
| Docs    | `apps/docs/content/docs/providers/fallback.mdx` |
| Example | `examples/fallback-demo/`                       |

**Highlights:** Priority + round-robin routing — per-model retry with exponential backoff — `onFallback` / `onRetry` callbacks — pluggable `RoutingStore` for serverless (Redis, KV).

---

## 4. File Attachments

Drag-and-drop file and media attachments in chat. Upload, preview, and forward to the server runtime.

|         | Path                                                                               |
| ------- | ---------------------------------------------------------------------------------- |
| Docs    | `apps/docs/content/docs/chat/attachments.mdx`                                      |
| Example | Used in `examples/skills-demo/` and `examples/ollama-demo/` (no dedicated example) |

**Highlights:** `AttachmentStrip` thumbnail preview — drop-zone overlay — `useAttachments()` for headless access — automatic server forwarding — error handling built-in.

---

## 5. Knowledge Base

Connect external knowledge sources so the AI can search and cite real data in responses.

|         | Path                            |
| ------- | ------------------------------- |
| Docs    | Not yet documented              |
| Example | `examples/knowledge-base-demo/` |

**Highlights:** RAG-powered retrieval — plug into any vector store — cite sources in responses — works with the agentic loop for multi-step research.

---

## Status

| Feature          | Docs | Example | README |          Ready          |
| ---------------- | :--: | :-----: | :----: | :---------------------: |
| Skills System    | Yes  |   Yes   |   No   |         Refine          |
| Generative UI    | Yes  |   Yes   |   No   |         Refine          |
| Fallback Chain   | Yes  |   Yes   |  Yes   |         Refine          |
| File Attachments | Yes  | Partial |   No   | Needs dedicated example |
| Knowledge Base   |  No  | Minimal |   No   |  Needs docs + example   |
