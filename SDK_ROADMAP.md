# YourGPT Copilot SDK - Feature Roadmap

> The most developer-friendly AI SDK with unique **App Context Awareness** features.

---

## What Makes Us Different

| Feature              | CopilotKit | Vercel AI SDK | **YourGPT**   |
| -------------------- | ---------- | ------------- | ------------- |
| Screenshot capture   | -          | -             | **Yes**       |
| Console log analysis | -          | -             | **Yes**       |
| Network inspection   | -          | -             | **Yes**       |
| Consent-based UX     | -          | -             | **Yes**       |
| Built-in KB tool     | -          | -             | **Yes**       |
| Intent detection     | -          | -             | **Yes**       |
| Bundle size          | 3.9MB      | ~500KB        | **<200KB**    |
| Framework agnostic   | No         | Partial       | **Yes**       |
| Type safety          | Poor       | Good          | **Excellent** |

---

## V1 Features (Current Release)

### 1. Smart Context Tools

AI automatically detects when it needs additional context from your app.

| Tool           | Trigger Keywords                            | What It Captures                     |
| -------------- | ------------------------------------------- | ------------------------------------ |
| **Screenshot** | "I see", "screen", "UI", "button", "layout" | Current viewport or specific element |
| **Console**    | "error", "bug", "not working", "crash"      | Recent console.log/warn/error        |
| **Network**    | "API", "request", "loading", "timeout"      | Failed fetch/XHR requests            |

**Example Flow:**

```
User: "I'm getting an error on my screen"

AI: "I can help debug this. May I:
     ☑ Capture a screenshot of your screen
     ☑ Check your browser console for errors
     ☐ Review recent failed API requests

     [Allow Selected] [Skip]"

User: [Allow Selected]

AI: "I found 2 errors in your console:
     1. TypeError: Cannot read property 'map' of undefined (line 45)
     2. Warning: Each child should have a unique key prop

     The first error is likely causing your issue..."
```

### 2. Consent-Based System

Privacy-first approach - AI always asks before capturing anything.

```tsx
<YourGPTProvider
  config={{ provider: "openai", apiKey: "..." }}
  tools={{
    screenshot: true, // Enable capability
    console: true,
    network: true,
    requireConsent: true, // Always ask first (default)
  }}
>
  <ChatWindow />
</YourGPTProvider>
```

### 3. Multi-Modal Attachments

```typescript
const { attachments, addFile, addImage, uploadProgress } = useAttachments({
  maxFiles: 5,
  maxSize: "10MB",
  accept: ["image/*", ".pdf", ".csv"],
});
```

- Drag & drop file upload
- Paste images from clipboard
- Screenshot attachment from tools
- Upload progress tracking

### 4. Enhanced Chat with Thinking States

```typescript
const {
  messages,
  sendMessage,
  isLoading,
  thinkingState, // { step: 'Analyzing...', progress: 45 }
  toolCalls, // Currently executing tools
  sources, // Knowledge base citations
} = useChat();
```

### 5. Thread Management

```typescript
const {
  threads,
  currentThread,
  createThread,
  switchThread,
  searchThreads,
  deleteThread,
} = useThreads();
```

---

## V2 Features (Next Release)

### 6. Knowledge Base as Built-in Tool

When you provide YourGPT credentials, the knowledge base tool auto-registers:

```tsx
<YourGPTProvider
  config={{ provider: "openai", apiKey: "..." }}
  yourgpt={{
    apiKey: "yg_...", // Your YourGPT API key
    botId: "bot_123", // Your chatbot ID
  }}
>
  <ChatWindow />
</YourGPTProvider>
```

**How it works:**

1. SDK detects `yourgpt.apiKey` is provided
2. Automatically registers `search_knowledge_base` tool
3. AI calls this tool when users ask questions
4. Responses include source citations

### 7. Artifact System (Like Claude)

```typescript
const {
  artifact,
  isGenerating,
  updateRegion, // Edit specific section
  revertVersion, // Go back to previous version
  exportArtifact,
} = useArtifact({ type: "code" | "document" | "react" });
```

- Split-screen view for code/documents
- Highlight-to-edit functionality
- Version history
- Export options

### 8. Refinement Controls

```typescript
const {
  applyPreset, // 'shorten', 'expand', 'simplify'
  adjustTone, // casual ↔ professional
  adjustLength, // brief ↔ detailed
} = useRefinement();
```

### 9. Voice Integration

```typescript
const {
  isListening,
  transcript,
  startListening,
  stopListening,
  speak, // Text-to-speech
} = useVoice();
```

### 10. Memory System

```typescript
const {
  remember, // Store key information
  recall, // Retrieve by key or semantic search
  forget,
  userPreferences, // Auto-extracted user preferences
} = useMemory({ userId: "user-123" });
```

---

## V3 Features (Future)

### 11. Generative UI

AI can render custom components instead of just text:

```typescript
const { registerComponent, renderComponent } = useGenerativeUI();

registerComponent("DataChart", ChartComponent);
registerComponent("InteractiveForm", FormComponent);

// AI can now respond with:
// <DataChart data={...} /> instead of text tables
```

### 12. Multi-Agent Orchestration

- Agent handoffs between specialists
- Parallel agent execution
- Visual workflow builder

### 13. Advanced Analytics

- Conversation insights
- User behavior patterns
- AI-powered recommendations

---

## Package Architecture

```
@yourgpt/copilot-sdk-core         # Types, utilities, capture logic (vanilla JS)
@yourgpt/copilot-sdk-react        # React hooks and provider
@yourgpt/vue          # Vue composables (coming soon)
@yourgpt/copilot-sdk-ui           # Pre-built chat components
@yourgpt/llm-sdk                  # Multi-provider LLM integration
```

### Framework-Agnostic Design

Core capture logic is written in vanilla JavaScript:

```
@yourgpt/copilot-sdk-core
├── tools/
│   ├── screenshot.ts    # Works in any framework
│   ├── console.ts
│   ├── network.ts
│   └── intentDetector.ts

@yourgpt/copilot-sdk-react           # React wrapper
├── hooks/useTools.ts

@yourgpt/vue             # Vue wrapper (future)
├── composables/useTools.ts
```

---

## Quick Start

```bash
npm install @yourgpt/copilot-sdk-react @yourgpt/copilot-sdk-ui
```

```tsx
import { YourGPTProvider } from "@yourgpt/copilot-sdk-react";
import { ChatWindow } from "@yourgpt/copilot-sdk-ui";

function App() {
  return (
    <YourGPTProvider
      config={{
        provider: "openai",
        apiKey: process.env.OPENAI_API_KEY,
      }}
      tools={{
        screenshot: true,
        console: true,
        network: true,
      }}
    >
      <ChatWindow />
    </YourGPTProvider>
  );
}
```

---

## Implementation Status

### V1 (In Progress)

- [ ] Smart Context Tools (screenshot, console, network)
- [ ] Consent-based permission system
- [ ] Intent detection from user messages
- [ ] Multi-modal attachments
- [ ] Enhanced useChat with thinking states
- [ ] Thread management

### V2 (Planned)

- [ ] Knowledge base as built-in tool
- [ ] Artifact system
- [ ] Refinement controls
- [ ] Voice integration
- [ ] Memory system

### V3 (Future)

- [ ] Generative UI
- [ ] Multi-agent orchestration
- [ ] Advanced analytics

---

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development setup and guidelines.

## License

MIT
