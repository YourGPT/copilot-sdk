# Tool Management Branch Summary

Branch: `codex/tool-management-core`

## Scope

This branch adds the first full tool-management stack across `copilot-sdk`, `llm-sdk`, and the experimental demos.

It covers:

- tool profiles and selective loading
- deferred tool loading
- manual tool search fallback
- native provider tool search hooks for Anthropic and OpenAI
- prompt-side tool result truncation and context compaction groundwork
- mixed client/server tool catalog support
- provider payload debug logging
- experimental scale-testing demo with 100 tools

## Main Features Added

### 1. Framework-agnostic prompt/tool optimization (`copilot-sdk`)

Added shared optimization support in the chat/core layer:

- tool profile selection
- dynamic tool narrowing
- tool result truncation controls
- context budget reporting
- history compaction with continuity summaries

Public APIs added:

- `setOptimizationConfig(...)`
- `setToolProfile(...)`
- `getContextUsage()`

Main files:

- `packages/copilot-sdk/src/chat/optimizations.ts`
- `packages/copilot-sdk/src/chat/ChatWithTools.ts`
- `packages/copilot-sdk/src/chat/classes/AbstractChat.ts`
- `packages/copilot-sdk/src/core/types/tools.ts`

### 2. Tool metadata and selection pipeline (`llm-sdk`)

Added richer tool metadata and request-time selection:

- `category`
- `group`
- `profiles`
- `searchKeywords`
- `deferLoading`

Selection features:

- profile-based filtering
- include/exclude selectors
- dynamic ranking by recent query/context
- strict deferred loading mode
- request-level `toolProfile`

Main files:

- `packages/llm-sdk/src/core/stream-events.ts`
- `packages/llm-sdk/src/server/tool-selection.ts`
- `packages/llm-sdk/src/server/runtime.ts`
- `packages/llm-sdk/src/server/agent-loop.ts`

### 3. Manual deferred tool search fallback

Added SDK-managed `search_tools` fallback for providers/models without native search support.

Behavior:

- full tool catalog stays on the server
- deferred tools stay out of the initial model-facing tool list
- model can call `search_tools`
- runtime loads matching deferred tools into the next loop iteration

Supports:

- mixed server tools + client tools
- profile-aware search
- BM25-style ranking

Main files:

- `packages/llm-sdk/src/server/tool-selection.ts`
- `packages/llm-sdk/src/server/runtime.ts`

### 4. Native provider tool search support

Added provider-aware search mode selection:

- `search.mode = "auto" | "native" | "manual"`

Current behavior:

- Anthropic Sonnet 4 / Opus 4 supported models -> native Anthropic search path
- OpenAI `gpt-5.4+` supported models -> internal OpenAI Responses-based native path
- all other providers/models -> manual `search_tools` fallback

Anthropic native path:

- adds `tool_search_tool_bm25_20251119` or regex variant
- passes deferred tools with `defer_loading: true`

OpenAI native path:

- uses internal Responses-based adapter branch
- keeps public SDK/frontend usage unchanged

Main files:

- `packages/llm-sdk/src/adapters/anthropic.ts`
- `packages/llm-sdk/src/adapters/openai.ts`
- `packages/llm-sdk/src/server/tool-selection.ts`

### 5. Mixed client/server catalog support

Added `toolCatalog` transport support so the runtime can search/select from the full catalog:

- server tools from runtime config
- client tools registered in the browser

This allows deferred client tools to be discovered by search even when they are not initially exposed to the model.

Main files:

- `packages/copilot-sdk/src/chat/interfaces/ChatTransport.ts`
- `packages/copilot-sdk/src/chat/adapters/HttpTransport.ts`
- `packages/copilot-sdk/src/chat/classes/AbstractChat.ts`
- `packages/llm-sdk/src/server/types.ts`
- `packages/llm-sdk/src/server/runtime.ts`

### 6. Provider payload logging

Added adapter-level debug payload logging for request/response inspection.

Supported across:

- OpenAI
- Anthropic
- Azure
- Google
- xAI
- Ollama

Current behavior:

- logs request payloads
- logs final provider responses
- suppresses per-event stream spam

Main file:

- `packages/llm-sdk/src/adapters/base.ts`

### 7. Experimental Tool Scale Lab

Added a dedicated experimental demo for scale testing:

- 100 tools total
- 30 server tools
- 70 client tools
- profile switching
- deferred loading
- manual/native search path testing
- provider behavior testing

Main files:

- `examples/experimental/app/tool-scale/page.tsx`
- `examples/experimental/app/api/chat/tool-scale/route.ts`
- `examples/experimental/lib/tool-scale/catalog.ts`
- `examples/experimental/lib/tool-scale/server-tools.ts`
- `examples/experimental/lib/tool-scale/client-tools.ts`

## Config Examples

### Runtime tool selection

```ts
agentLoop: {
  enabled: true,
  toolSelection: {
    enabled: true,
    defaultProfile: "support",
    includeUnprofiled: false,
    dynamicSelection: {
      enabled: true,
      maxTools: 6,
    },
    search: {
      enabled: true,
      mode: "auto",
      strictDeferredLoading: true,
      maxResults: 6,
      metaToolName: "search_tools",
      anthropicVariant: "bm25",
    },
  },
}
```

### Client-side optimization

```ts
optimization: {
  toolProfiles: {
    enabled: true,
    defaultProfile: "support",
  },
  toolResultConfig: {
    truncation: {
      enabled: true,
      strategy: "smart",
      hardMaxChars: 12000,
    },
  },
  contextManagement: {
    enabled: true,
    history: {
      maxMessages: 20,
      pruneStrategy: "summarize",
    },
  },
  contextBudget: {
    enabled: true,
    budget: {
      contextWindowTokens: 128000,
      toolResultsShare: 0.3,
    },
  },
}
```

## Current Known Caveats

These are not fully closed out yet:

- mixed same-turn server + client tool calls still need more hardening in the runtime loop
- OpenAI manual fallback + continuation path needs more validation
- OpenAI native Responses path currently preserves the SDK contract, but is not full event-by-event Responses streaming yet
- no dedicated automated tests were added in this branch yet

## Suggested Next Steps

- add tests for tool selection, deferred loading, and continuation ordering
- tighten manual search scoring so profile-only matches do not leak through
- harden mixed same-turn server/client tool execution ordering
- improve OpenAI Responses-native streaming parity
