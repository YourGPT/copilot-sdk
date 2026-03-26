# Storage Adapter (Alpha)

> **Status**: Alpha — API may change. Available since `@yourgpt/llm-sdk@1.5.0-alpha`.

## Quick Start

```ts
import { createRuntime } from "@yourgpt/llm-sdk";
import { createAnthropic } from "@yourgpt/llm-sdk/anthropic";
import { createYourGPT } from "@yourgpt/llm-sdk/yourgpt";

// 1. Create adapter (server-side only)
const yourgpt = createYourGPT({
  apiKey: process.env.YOURGPT_API_KEY,
  widgetUid: process.env.YOURGPT_WIDGET_UID,
  // endpoint defaults to https://api.yourgpt.ai
  // Override for dev: endpoint: 'http://localhost:3000'
});

// 2. Plug into runtime
const runtime = createRuntime({
  provider: createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY }),
  model: "claude-haiku-4-5",
  storage: yourgpt, // ← enables automatic persistence
});

// 3. Endpoints are one-liners
app.post("/api/copilot/chat", async (req, res) => {
  const result = await runtime.chat(req.body);
  res.json(result); // includes threadId
});

app.post("/api/copilot/stream", async (req, res) => {
  await runtime.stream(req.body).pipeToResponse(res);
});

// 4. Optional: file upload
app.post("/api/copilot/upload", async (req, res) => {
  const result = await yourgpt.uploadFile(req.body);
  res.json(result);
});
```

## What Happens Automatically

| Event                       | Without storage         | With storage                                   |
| --------------------------- | ----------------------- | ---------------------------------------------- |
| First message (no threadId) | Uses local thread ID    | Creates session via API, returns real threadId |
| User sends message          | Just forwarded to LLM   | Saved to session, then forwarded               |
| LLM responds                | Just returned to client | Saved to session, then returned                |
| Tool calls + results        | Not persisted           | Saved as tool messages                         |
| File attachment             | Base64 in payload       | Uploaded to storage, URL in payload            |
| Session creation fails      | N/A                     | Fallback local ID, chat continues              |

## Configuration

### `createYourGPT(config)`

| Option      | Required | Default                  | Description                |
| ----------- | -------- | ------------------------ | -------------------------- |
| `apiKey`    | Yes      | —                        | YourGPT API key            |
| `widgetUid` | Yes      | —                        | Widget UID (project scope) |
| `endpoint`  | No       | `https://api.yourgpt.ai` | API base URL               |

### `createRuntime({ storage })`

The `storage` option accepts any `StorageAdapter`. The runtime calls:

- `storage.createSession()` — when request has no threadId
- `storage.saveMessages()` — before + after LLM call
- `storage.uploadFile()` — not called by runtime (used via upload endpoint)

### Environment Variables (Server)

```env
# Required
YOURGPT_API_KEY=apk-your-key-here
YOURGPT_WIDGET_UID=your-widget-uid-here

# Optional (defaults to production)
YOURGPT_API_ENDPOINT=https://api.yourgpt.ai

# LLM provider
ANTHROPIC_API_KEY=sk-ant-...
```

## Client Setup

No special client configuration needed for sessions. The client SDK automatically:

1. Reads `threadId` from server response
2. Uses it for subsequent requests
3. Uses it as the local thread ID (single ID system)

### File uploads (client)

The `upload` prop handles all upload modes — string, object, or function:

```tsx
// Simple — just a URL:
<CopilotChat upload="/api/copilot/upload" attachmentsEnabled />

// With auth headers:
<CopilotChat upload={{
  url: "/api/copilot/upload",
  headers: () => ({ Authorization: `Bearer ${token}` }),
}} />

// Full custom:
<CopilotChat upload={async (file) => {
  const url = await myS3Upload(file);
  return { type: 'image', url, mimeType: file.type, filename: file.name };
}} />
```

## Custom StorageAdapter

Implement the interface for any backend:

```ts
import type { StorageAdapter } from "@yourgpt/llm-sdk";

const myStorage: StorageAdapter = {
  async createSession(data) {
    // Your DB call
    return { id: "session-123" };
  },
  async saveMessages(sessionId, messages) {
    // Your DB call
  },
  // Optional:
  async uploadFile(file) {
    // Your storage call
    return { url: "https://..." };
  },
};

const runtime = createRuntime({ provider, model, storage: myStorage });
```

## Error Handling

- `createSession` failure → Fallback local ID, storage skipped, chat works
- `saveMessages` failure → Logged, chat continues (fire-and-forget)
- `uploadFile` failure → Error returned to client (4xx/5xx)
- All errors are logged with `[Runtime]` prefix

### `onError` callback

```ts
const yourgpt = createYourGPT({
  apiKey,
  widgetUid,
  onError: (error, operation, params) => {
    // operation: "createSession" | "saveMessages" | "uploadFile"
    // params: { sessionId, messageCount, roles, filename, mimeType, ... }
    logger.error(`[YourGPT:${operation}]`, error.message, params);
  },
});
```

## Alpha Notes

- The `endpoint` option in `createYourGPT` will become internal in GA (defaults to production API)
- `getSessions()` and `getMessages()` on StorageAdapter are reserved for future thread sync
- File upload uses pre-signed URLs via `/copilot-sdk/getSignedUrl` — contract may change
