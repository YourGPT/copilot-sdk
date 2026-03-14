# Skills System

Skills are instruction playbooks the AI loads on demand. They shape the model's **behavior** — separate from Tools, which perform actions.

A skill is a Markdown file (or inline string) containing instructions. Skills can be:

- **eager** — always injected into the system prompt
- **auto** — listed in a catalog; the AI calls `load_skill` to retrieve them when relevant
- **manual** — available via `load_skill` but not advertised in the catalog

---

## Table of Contents

1. [Concepts](#1-concepts)
2. [Client-side: SkillProvider + useSkill](#2-client-side-skillprovider--useskill)
3. [Server-side: loadSkills](#3-server-side-loadskills)
4. [Skill File Format](#4-skill-file-format)
5. [defineSkill helper](#5-defineskill-helper)
6. [useSkillStatus](#6-useskillstatus)
7. [Source precedence & collision detection](#7-source-precedence--collision-detection)
8. [Type Reference](#8-type-reference)
9. [Full Example](#9-full-example)

---

## 1. Concepts

| Strategy | Behavior                                                                                            |
| -------- | --------------------------------------------------------------------------------------------------- |
| `eager`  | Content prepended to system prompt on every request. Always active.                                 |
| `auto`   | Listed in the skill catalog appended to the system prompt. AI calls `load_skill({ name })` to load. |
| `manual` | Accessible via `load_skill` but not advertised — for internal/conditional skills.                   |

The `load_skill` tool is automatically registered when a `<SkillProvider>` is present (client) or when `loadSkills()` builds the tools object (server). No manual wiring required.

---

## 2. Client-side: SkillProvider + useSkill

### SkillProvider

Wrap your app (inside `<CopilotProvider>`) to enable client-side skills:

```tsx
import { SkillProvider, defineSkill } from "@yourgpt/copilot-sdk-react";

const brandVoice = defineSkill({
  name: "brand-voice",
  description: "Ensures responses match our brand tone and terminology",
  strategy: "eager",
  source: {
    type: "inline",
    content:
      "Always respond in a friendly, concise tone. Use 'we' not 'I'. Avoid jargon.",
  },
});

const codeReview = defineSkill({
  name: "code-review",
  description: "Performs structured code reviews with actionable feedback",
  strategy: "auto", // AI loads this on demand
  source: {
    type: "inline",
    content: "When reviewing code: 1) Check for bugs first...",
  },
});

export default function App() {
  return (
    <CopilotProvider widgetToken="...">
      <SkillProvider skills={[brandVoice, codeReview]}>
        <YourApp />
      </SkillProvider>
    </CopilotProvider>
  );
}
```

> **Note:** `<SkillProvider>` only supports `inline` source skills client-side. For `file` or `url` sources, use `loadSkills()` on the server.

### useSkill

Register a skill from deep inside the component tree — it activates on mount and cleans up on unmount.

```tsx
import { useSkill } from "@yourgpt/copilot-sdk-react";

function CheckoutPage() {
  useSkill({
    name: "checkout-flow",
    description: "Guides the user through the checkout process step by step",
    strategy: "auto",
    source: {
      type: "inline",
      content: `
## Checkout Assistant

When the user asks about checkout:
1. Confirm their cart items
2. Check for applicable promo codes
3. Walk through shipping options
4. Confirm payment method before submitting
      `,
    },
  });

  return <CheckoutUI />;
}
```

The skill is automatically unregistered when `CheckoutPage` unmounts.

**Dev warning:** If an inline skill exceeds 2000 characters in development, a console warning is shown. Large inline skills are sent on every request — consider using a server-side file skill instead.

---

## 3. Server-side: loadSkills

For `file` and `url` sources, or when you want server-controlled skill loading:

```typescript
// app/api/chat/route.ts
import path from "path";
import { loadSkills } from "@yourgpt/copilot-sdk/server";

export async function POST(req: Request) {
  const { messages, __skills } = await req.json();

  const { skills, buildSystemPrompt, tools, diagnostics } = await loadSkills({
    // Source 1: .md files from a local directory (highest precedence)
    dir: path.join(process.cwd(), "skills"),

    // Source 2: Remote .md URLs
    remoteUrls: ["https://cdn.myapp.com/skills/support-policy.md"],

    // Source 3: Inline skills forwarded from client (lowest precedence)
    clientSkills: __skills ?? [],
  });

  // Log any name collisions
  if (diagnostics.length) {
    console.warn("Skill collisions:", diagnostics);
  }

  const systemPrompt = buildSystemPrompt(
    "You are a helpful assistant for Acme Corp.",
  );

  // Pass tools.load_skill to your AI provider
  return streamText({
    model: anthropic("claude-sonnet-4-6"),
    system: systemPrompt,
    messages,
    tools: {
      ...tools, // includes load_skill
      ...myOtherTools,
    },
  });
}
```

### loadSkills options

```typescript
interface LoadSkillsOptions {
  dir?: string; // Path to /skills directory (Node.js only)
  remoteUrls?: string[]; // Remote .md URLs to fetch
  clientSkills?: ClientInlineSkill[]; // Forwarded from useSkill() hooks
}
```

### loadSkills result

```typescript
interface LoadSkillsResult {
  skills: ResolvedSkill[];
  diagnostics: SkillDiagnostic[];

  // Build system prompt: prepends eager content, appends auto catalog
  buildSystemPrompt(basePrompt?: string): string;

  // Ready-to-use load_skill tool definition
  tools: {
    load_skill: {
      description: string;
      parameters: { ... };
      execute: (args: { name: string }) => Promise<LoadSkillResult | LoadSkillError>;
    };
  };
}
```

### Forwarding client skills to the server

`<SkillProvider>` automatically syncs inline skills to `CopilotProvider`, which includes them in every API request as `__skills`. Read them in your route handler:

```typescript
const { messages, __skills } = await req.json();

const { buildSystemPrompt, tools } = await loadSkills({
  dir: path.join(process.cwd(), "skills"),
  clientSkills: __skills ?? [], // Inline skills from useSkill() hooks
});
```

---

## 4. Skill File Format

Skill files are Markdown with an optional YAML frontmatter block.

```markdown
---
name: code-review
description: Performs structured code reviews with actionable feedback
strategy: auto
version: 1.2.0
---

## Code Review Instructions

When asked to review code, follow this structure:

1. **Correctness** — Check for logic errors and edge cases
2. **Security** — Flag injection risks, exposed secrets, insecure defaults
3. **Performance** — Note O(n²) loops, unnecessary re-renders, missing indexes
4. **Style** — Suggest naming and structure improvements (non-blocking)

Always include a summary section with an overall assessment.
```

### Frontmatter fields

| Field         | Required    | Description                                                                           |
| ------------- | ----------- | ------------------------------------------------------------------------------------- |
| `name`        | Recommended | Skill name. Derived from filename if omitted (e.g. `code-review.md` → `code-review`). |
| `description` | Recommended | One-line description shown in the AI's skill catalog.                                 |
| `strategy`    | No          | `eager`, `auto`, or `manual`. Default: `auto`.                                        |
| `version`     | No          | Informational version string.                                                         |

### Directory layout

```
skills/
├── brand-voice.md          # Flat .md file
├── code-review.md
└── sql-expert/
    └── SKILL.md            # Folder-based skill (use for multi-file skills)
```

For folder-based skills, place the main skill file at `<folder>/SKILL.md`. The folder name is used as the skill name unless overridden by frontmatter.

---

## 5. defineSkill helper

Type-safe factory for creating skill definitions. An identity function with TypeScript inference — same pattern as `useTool`.

```typescript
import { defineSkill } from "@yourgpt/copilot-sdk-react";
// or from server:
import { defineSkill } from "@yourgpt/copilot-sdk/server";

const mySkill = defineSkill({
  name: "api-docs-helper",
  description: "Helps users understand and use the Acme API",
  strategy: "auto",
  version: "2.0.0",
  source: {
    type: "inline",
    content: "When explaining API endpoints, always include example requests...",
  },
});

// Reuse in multiple providers
<SkillProvider skills={[mySkill]} />
```

---

## 6. useSkillStatus

Observe the live skill registry state from any component inside `<SkillProvider>`:

```tsx
import { useSkillStatus } from "@yourgpt/copilot-sdk-react";

function DebugPanel() {
  const { skills, count, has } = useSkillStatus();

  return (
    <div>
      <p>{count} skill(s) active</p>
      {has("code-review") && <Badge>Code Review</Badge>}
      <ul>
        {skills.map((s) => (
          <li key={s.name}>
            {s.name} ({s.strategy ?? "auto"})
          </li>
        ))}
      </ul>
    </div>
  );
}
```

### Return type

```typescript
interface UseSkillStatusReturn {
  skills: ResolvedSkill[]; // All currently registered skills
  count: number; // Number of registered skills
  has: (name: string) => boolean; // Check if a named skill is active
}
```

---

## 7. Source Precedence & Collision Detection

When the same skill name appears in multiple sources, the higher-precedence source wins and a diagnostic is recorded.

```
server-dir  >  remote-url  >  client-inline
```

```typescript
const { diagnostics } = await loadSkills({ ... });

// diagnostics: SkillDiagnostic[]
// [{
//   type: "collision",
//   name: "code-review",
//   winner: "server-dir",
//   loser: "client-inline",
// }]
```

This lets you safely override client-provided skills with authoritative server versions — for example, preventing users from injecting their own `brand-voice` skill that conflicts with your official one.

---

## 8. Type Reference

```typescript
type SkillStrategy = "eager" | "auto" | "manual";

type SkillSource =
  | { type: "inline"; content: string }
  | { type: "url"; url: string }
  | { type: "file"; path: string };

interface SkillDefinition {
  name: string;
  description: string;
  source: SkillSource;
  strategy?: SkillStrategy; // default: "auto"
  version?: string;
}

interface ResolvedSkill extends SkillDefinition {
  content: string; // Fully resolved content string
}

interface ClientInlineSkill {
  name: string;
  description: string;
  content: string;
  strategy?: SkillStrategy;
}

interface SkillDiagnostic {
  type: "collision";
  name: string;
  winner: "server-dir" | "remote-url" | "client-inline";
  loser: "server-dir" | "remote-url" | "client-inline";
}

interface LoadSkillResult {
  name: string;
  description: string;
  strategy: SkillStrategy;
  content: string;
  source: "server-dir" | "remote-url" | "client-inline";
}

interface LoadSkillError {
  error: string;
}
```

---

## 9. Full Example

### Project structure

```
skills/
├── brand-voice.md     # eager — always active
└── sql-expert.md      # auto — loaded on demand
```

```markdown
## <!-- skills/brand-voice.md -->

name: brand-voice
description: Acme Corp tone and style guide
strategy: eager

---

Always respond in a friendly, professional tone.
Refer to the product as "Acme" (not "the platform").
Use metric units. Avoid passive voice.
```

```markdown
## <!-- skills/sql-expert.md -->

name: sql-expert
description: Writes and explains SQL queries for our PostgreSQL schema
strategy: auto

---

## SQL Expert

Our database uses PostgreSQL 15. Key tables:

- users(id, email, plan, created_at)
- orders(id, user_id, total, status, created_at)
- products(id, name, price, stock)

When writing queries:

1. Always use parameterized queries ($1, $2...)
2. Add LIMIT clauses to SELECT queries
3. Explain the query in plain English after writing it
```

### API route

```typescript
// app/api/chat/route.ts
import path from "path";
import { loadSkills } from "@yourgpt/copilot-sdk/server";
import { streamText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";

export async function POST(req: Request) {
  const { messages, __skills } = await req.json();

  const { buildSystemPrompt, tools } = await loadSkills({
    dir: path.join(process.cwd(), "skills"),
    clientSkills: __skills ?? [],
  });

  return streamText({
    model: anthropic("claude-sonnet-4-6"),
    system: buildSystemPrompt("You are a helpful assistant for Acme Corp."),
    messages,
    tools,
  }).toDataStreamResponse();
}
```

### React app

```tsx
// app/layout.tsx
import { CopilotProvider } from "@yourgpt/copilot-sdk-react";
import { SkillProvider, defineSkill } from "@yourgpt/copilot-sdk-react";

// Extra client-only skill (e.g. page-specific context)
const checkoutSkill = defineSkill({
  name: "checkout-helper",
  description: "Helps with the checkout flow",
  strategy: "auto",
  source: { type: "inline", content: "When helping with checkout..." },
});

export default function Layout({ children }) {
  return (
    <CopilotProvider widgetToken="YOUR_TOKEN" apiUrl="/api/chat">
      <SkillProvider skills={[checkoutSkill]}>{children}</SkillProvider>
    </CopilotProvider>
  );
}
```

```tsx
// app/dashboard/page.tsx — add a page-scoped skill
import { useSkill, useSkillStatus } from "@yourgpt/copilot-sdk-react";

export default function DashboardPage() {
  useSkill({
    name: "dashboard-context",
    description: "Knows about the current dashboard state",
    strategy: "eager",
    source: {
      type: "inline",
      content:
        "The user is viewing the analytics dashboard. Current date range: last 30 days.",
    },
  });

  const { count } = useSkillStatus();

  return (
    <div>
      <p>{count} skills active</p>
      <Dashboard />
    </div>
  );
}
```
