# Web Search Implementation - Technical Documentation

> Temporary documentation for the native web search feature implementation.

---

## Current Implementation Status

### Completed

- [x] Native web search for all 3 LLM providers (OpenAI, Google, Anthropic)
- [x] Single API call (was 2 calls before - LLM + search provider)
- [x] Citations displayed as chips below messages (like Perplexity/ChatGPT)
- [x] Tree-shakeable subpath exports (~3KB per provider vs ~50KB for all)
- [x] Unified Citation format across all providers
- [x] HoverCard preview for citations with favicon and domain
- [x] Hidden "Web search" tool step when native citations exist
- [x] Debug logs cleaned up
- [x] Simplified naming (removed "-native" suffix)

---

## Architecture

### Package Structure

```
@yourgpt/copilot-sdk
├── /core                         # Main exports
├── /react                        # React hooks
├── /ui                           # UI components
└── /tools                        # Tree-shakeable tool exports
    ├── /web-search               # Shared types + utilities
    ├── /openai                   # openaiSearch()
    ├── /google                   # googleSearch()
    ├── /anthropic                # anthropicSearch()
    ├── /tavily                   # tavilySearch()
    ├── /serper                   # serperSearch()
    ├── /brave                    # braveSearch()
    ├── /exa                      # exaSearch()
    └── /searxng                  # searxngSearch()
```

### Provider Implementation Files

```
packages/copilot-sdk/src/core/tools/webSearch/providers/
├── openai.ts      # OpenAI Responses API with web_search tool
├── google.ts      # Gemini API with google_search grounding
├── anthropic.ts   # Anthropic Messages API with web_search_20250305
├── tavily.ts      # Tavily API
├── serper.ts      # Serper (Google) API
├── brave.ts       # Brave Search API
├── exa.ts         # Exa (semantic) API
└── searxng.ts     # Self-hosted SearXNG
```

### LLM Adapters with Native Web Search

```
packages/llm-sdk/src/adapters/
├── openai.ts      # webSearch config → web_search_preview tool
├── google.ts      # webSearch config → google_search grounding
└── anthropic.ts   # webSearch config → web_search_20260209 tool
```

---

## Unified Citation Format

All providers normalize to this format:

```typescript
interface Citation {
  index: number; // 1-based index
  url: string; // Source URL
  title: string; // Page title or domain
  domain?: string; // Extracted domain (e.g., "example.com")
  favicon?: string; // Google favicon URL
  citedText?: string; // Relevant excerpt (Anthropic only)
}
```

### Stream Event

```typescript
yield { type: "citation", citations: Citation[] };
```

### Message Metadata

Citations are stored in message metadata:

```typescript
message.metadata.citations: Citation[]
```

---

## Provider-Specific Details

### OpenAI

**Tool Type:** `web_search_preview`
**API:** Chat Completions (streaming)
**Citations:** `delta.annotations[]` with `type: "url_citation"`

```typescript
// Adapter config
webSearch: true | WebSearchConfig;

// Emits during stream
if (annotation.type === "url_citation") {
  collectedCitations.push({
    url: annotation.url_citation.url,
    title: annotation.url_citation.title,
  });
}
```

### Google (Gemini)

**Tool Type:** `{ google_search: {} }`
**API:** generateContent (streaming)
**Citations:** `candidate.groundingMetadata.groundingChunks[]`

```typescript
// Grounding metadata
groundingMetadata: {
  groundingChunks: [
    { web: { uri: string, title?: string } }
  ]
}
```

### Anthropic

**Tool Type:** `web_search_20260209` (streaming adapter) / `web_search_20250305` (standalone)
**API:** Messages (streaming)
**Citations:** `content[].citations[]` with `type: "web_search_result_location"`

```typescript
// Citation format
{
  type: "web_search_result_location",
  url: string,
  title: string,
  cited_text?: string,  // Unique to Anthropic
}
```

**Note:** Anthropic provides `cited_text` - the actual text from the page that was cited.

---

## UI Components

### SourceGroup (`source.tsx`)

Displays citations as chips with hover preview.

```tsx
<SourceGroup
  sources={sources}
  showFavicon={true}
  numbered={false}
  maxVisible={6}
/>
```

### Source (individual chip)

```tsx
<Source
  href="https://example.com/article"
  title="Article Title"
  description="Optional description"
  showFavicon={true}
/>
```

### HoverCard

Uses `@radix-ui/react-hover-card` for preview on hover.
Animation requires `tw-animate-css` (Tailwind v4) in user's project.

---

## Known Issues & Fixes Applied

### 1. Citations Lost After Stream Ends

**Problem:** `useInternalThreadManager` was calling `setMessages()` even without persistence adapter, overwriting metadata.

**Fix:** Added `!adapter` check:

```typescript
useEffect(() => {
  if (!adapter) return; // Skip sync when no persistence
  // ...
}, [adapter, messages]);
```

**File:** `packages/copilot-sdk/src/ui/hooks/useInternalThreadManager.ts`

### 2. Tool Step Showing During Native Search

**Problem:** "Web search" tool step was showing during streaming for native web search.

**Fix:** Don't emit `action:start`/`action:end` for `web_search` tool:

```typescript
if (currentToolUse.name !== "web_search") {
  yield { type: "action:start", ... };
}
```

**File:** `packages/llm-sdk/src/adapters/anthropic.ts`

### 3. Citations Layout

**Problem:** SourceGroup was rendering to the right of message content.

**Fix:** Moved SourceGroup inside the content div in `default-message.tsx`.

### 4. HoverCard Animations

**Problem:** No transition on hover card.

**Solution:** Users need to add `tw-animate-css` package (Tailwind v4):

```bash
pnpm add tw-animate-css
```

```css
@import "tailwindcss";
@import "tw-animate-css";
```

---

## Suggestions for Future Improvements

### 1. Extract Duplicate Utilities

The `extractDomain` function is duplicated in:

- `adapters/openai.ts`
- `adapters/google.ts`
- `adapters/anthropic.ts`
- `ui/components/ui/source.tsx`

**Suggestion:** Create shared `packages/llm-sdk/src/utils/url.ts`

### 2. Add Anthropic to Documentation Tabs

The `web-search.mdx` docs are missing Anthropic tab in provider examples.

### 3. Citation Loading State

Currently citations appear after stream ends. Consider showing a subtle "Searching..." indicator during streaming.

### 4. Consolidate Citation Components

Both `citations.tsx` and `source.tsx` exist. Consider:

- Deprecating one, or
- Clearly documenting when to use each

### 5. Error Boundary for Citations

Add graceful fallback if favicon fails to load (currently just hides).

### 6. Version Consistency

Ensure Anthropic web search version is consistent:

- Adapter: `web_search_20260209`
- Standalone: `web_search_20250305`

Pick one version and use consistently.

---

## Usage Examples

### Native Web Search (Recommended)

```typescript
// In adapter config - single API call
const adapter = createAnthropicAdapter({
  apiKey: process.env.ANTHROPIC_API_KEY,
  model: "claude-sonnet-4-20250514",
  webSearch: true, // Enable native web search
});
```

### Tree-Shakeable Tool Import

```typescript
import { openaiSearch } from "@yourgpt/copilot-sdk/tools/openai";

const webSearch = openaiSearch({
  apiKey: process.env.OPENAI_API_KEY,
  maxResults: 5,
});

const runtime = createRuntime({
  provider: openai,
  model: "gpt-4o",
  tools: [webSearch],
});
```

### Legacy Import (All Providers)

```typescript
import { createWebSearchTool } from "@yourgpt/copilot-sdk/core";

const webSearch = createWebSearchTool({
  provider: "anthropic",
  apiKey: process.env.ANTHROPIC_API_KEY,
});
```

---

## Bundle Size

| Import Pattern                         | Size   |
| -------------------------------------- | ------ |
| `@yourgpt/copilot-sdk/tools/openai`    | ~2.5KB |
| `@yourgpt/copilot-sdk/tools/google`    | ~2.5KB |
| `@yourgpt/copilot-sdk/tools/anthropic` | ~3KB   |
| `@yourgpt/copilot-sdk/tools/tavily`    | ~3KB   |
| `@yourgpt/copilot-sdk/core` (all)      | ~50KB  |

**~85% reduction** when using single provider import.

---

## Testing

### Demo App

```bash
cd examples/web-search-demo
pnpm dev
# Open http://localhost:3009
```

### Test Queries

- "What are the latest AI news?"
- "What's the weather in New York?"
- "Who won the most recent Super Bowl?"
- "What's the current price of Bitcoin?"

---

## Files Modified in This Feature

### New Files

- `packages/copilot-sdk/src/tools/*/index.ts` (8 tool exports)
- `packages/copilot-sdk/src/core/tools/webSearch/providers/*.ts` (8 providers)
- `packages/copilot-sdk/src/ui/components/ui/source.tsx`
- `packages/copilot-sdk/src/ui/components/ui/citations.tsx`
- `examples/web-search-demo/` (entire demo app)
- `apps/docs/content/docs/tools/built-in/web-search.mdx`

### Modified Files

- `packages/llm-sdk/src/adapters/openai.ts` (webSearch support)
- `packages/llm-sdk/src/adapters/google.ts` (webSearch support)
- `packages/llm-sdk/src/adapters/anthropic.ts` (webSearch support)
- `packages/copilot-sdk/src/ui/components/composed/chat/default-message.tsx`
- `packages/copilot-sdk/src/ui/hooks/useInternalThreadManager.ts`
- `packages/copilot-sdk/package.json` (subpath exports)
- `packages/copilot-sdk/tsup.config.ts` (entry points)

---

_Last updated: 2026-02-23_
