# Skills System

On-demand instruction sets the AI can load at runtime — keeps the system prompt lean.

## Two Strategies

| Strategy | Behavior                                                |
| -------- | ------------------------------------------------------- |
| `eager`  | Content injected into AI context immediately on mount   |
| `auto`   | Listed in catalog; AI calls `load_skill(name)` to fetch |

## API

```tsx
import { defineSkill, SkillProvider, useSkill } from "@yourgpt/copilot-sdk/react";

// 1. Define a skill
const diagnosticSkill = defineSkill({
  name: "diagnostic",
  description: "Troubleshoot chatbot issues: errors, limits, integrations",
  strategy: "eager",                         // always in context
  source: { type: "inline", content: "..." },
});

const trainingSkill = defineSkill({
  name: "training",
  description: "Manage knowledge base: add FAQs, URLs, files",
  strategy: "auto",                          // AI loads on demand
  source: { type: "inline", content: "..." },
});

// 2. Provide at app level
<CopilotProvider ...>
  <SkillProvider skills={[diagnosticSkill, trainingSkill]}>
    {children}
  </SkillProvider>
</CopilotProvider>

// 3. Register per-route (auto skills only active on that route)
function TrainingLayout() {
  useSkill(trainingSkill); // registers on mount, unregisters on unmount
  return <Outlet />;
}
```

## How It Works

- **Eager**: `SkillProvider` renders an `EagerSkillInjector` which calls `useAIContext` with the skill content. Appears in the AI context as `__skill_eager__:<name>`.
- **Auto**: A `load_skill` tool is registered. The catalog context lists available auto skills. AI calls `load_skill({ name })` → receives full content in tool result.
- **Ref counting**: Multiple `useSkill` calls for the same skill are safe — the registry tracks ref counts and only unregisters when count hits 0.

## Runtime Behavior

```
User navigates to /training
  → useSkill(trainingSkill) mounts
  → Catalog updates: "Available skills:\n- training: Manage knowledge base..."
  → AI can now call load_skill({ name: "training" })

User navigates away
  → useSkill cleanup fires
  → training removed from catalog
```
