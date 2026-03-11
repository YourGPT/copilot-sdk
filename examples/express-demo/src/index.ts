import "dotenv/config";
import express from "express";
import cors from "cors";
import { createRuntime, type ToolDefinition } from "@yourgpt/llm-sdk";
import { createAnthropic } from "@yourgpt/llm-sdk/anthropic";
import { createOpenAI } from "@yourgpt/llm-sdk/openai";

const app = express();
const BODY_SIZE_LIMIT = process.env.BODY_SIZE_LIMIT || "100mb";

app.use(cors());
app.use(express.json({ limit: BODY_SIZE_LIMIT }));
app.use(express.urlencoded({ extended: true, limit: BODY_SIZE_LIMIT }));

// ============================================
// DUMMY KNOWLEDGE BASE DATA
// ============================================

const KNOWLEDGE_BASE_DATA = [
  {
    doc_id: "kb_001",
    content:
      "YourGPT Copilot SDK is a powerful toolkit for building AI-powered chat interfaces. It supports multiple LLM providers including OpenAI, Anthropic Claude, Google Gemini, and local models via Ollama.",
    score: 0.95,
  },
  {
    doc_id: "kb_002",
    content:
      "To install the SDK, run: npm install @yourgpt/llm-sdk. The SDK provides createRuntime() for server-side usage and CopilotProvider for React clients.",
    score: 0.92,
  },
  {
    doc_id: "kb_003",
    content:
      "Server-side tools are defined with location: 'server' and include a handler function. The handler is executed on the server and results are sent back to the LLM for processing.",
    score: 0.89,
  },
  {
    doc_id: "kb_004",
    content:
      "The agent loop automatically handles multi-turn tool calls. Configure maxIterations in agentLoop config to limit the number of turns. Default is 20 iterations.",
    score: 0.87,
  },
  {
    doc_id: "kb_005",
    content:
      "For billing and usage tracking, use the onFinish callback which provides token usage data. Usage data is available server-side only and is stripped before sending to clients.",
    score: 0.85,
  },
  {
    doc_id: "kb_006",
    content:
      "Pricing for YourGPT services: Basic plan is $29/month with 100k tokens. Pro plan is $99/month with 1M tokens. Enterprise plans with custom limits available.",
    score: 0.82,
  },
  {
    doc_id: "kb_007",
    content:
      "To enable debug logging, set debug: true in createRuntime config. This will log all tool calls, LLM requests, and streaming events to the console.",
    score: 0.8,
  },
];

// ============================================
// SERVER-SIDE TOOL: SEARCH KNOWLEDGE BASE
// ============================================

const serverTools: ToolDefinition[] = [
  {
    name: "search_knowledge_base",
    description:
      "Search the knowledge base for relevant documents. Use this when the user asks questions about YourGPT, the SDK, pricing, features, or how to use the product.",
    location: "server",
    // HIDDEN: This tool runs silently - user won't see it in the chat UI
    hidden: true,
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The search query to find relevant documents",
        },
        limit: {
          type: "number",
          description: "Maximum number of results to return (1-10)",
        },
      },
      required: ["query"],
    },
    handler: async (params) => {
      const args = params as { query: string; limit?: number };
      const searchLimit = Math.min(Math.max(args.limit || 3, 1), 10);

      console.log(
        `\n[search_knowledge_base] Query: "${args.query}", Limit: ${searchLimit}`,
      );

      // Simulate search delay
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Simple keyword matching for demo
      const query = args.query.toLowerCase();
      const results = KNOWLEDGE_BASE_DATA.filter((doc) =>
        doc.content.toLowerCase().includes(query.split(" ")[0]),
      )
        .slice(0, searchLimit)
        .map((doc) => ({
          content: doc.content,
          score: doc.score,
          doc_id: doc.doc_id,
        }));

      // If no matches, return top results
      if (results.length === 0) {
        const topResults = KNOWLEDGE_BASE_DATA.slice(0, searchLimit).map(
          (doc) => ({
            content: doc.content,
            score: doc.score,
            doc_id: doc.doc_id,
          }),
        );
        console.log(
          `[search_knowledge_base] No exact matches, returning top ${topResults.length} results`,
        );
        return { results: topResults };
      }

      console.log(`[search_knowledge_base] Found ${results.length} results`);
      return { results };
    },
  },
  {
    name: "get_current_time",
    description: "Get the current server time",
    location: "server",
    // VISIBLE: This tool will show in the chat UI (hidden: false is default)
    inputSchema: {
      type: "object",
      properties: {},
    },
    handler: async () => {
      const now = new Date();
      console.log(`\n[get_current_time] ${now.toISOString()}`);
      return {
        time: now.toISOString(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      };
    },
  },
];

// ============================================
// CREATE PROVIDERS
// ============================================

// Anthropic Provider (preferred for server-side tools)
const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// OpenAI Provider (fallback)
const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Choose provider based on env
const provider = process.env.ANTHROPIC_API_KEY ? anthropic : openai;
const model = process.env.ANTHROPIC_API_KEY
  ? "claude-haiku-4-5"
  : "gpt-4o-mini";

console.log(
  `Using provider: ${process.env.ANTHROPIC_API_KEY ? "Anthropic" : "OpenAI"}`,
);
console.log(`Using model: ${model}`);

// ============================================
// CREATE RUNTIME WITH SERVER-SIDE TOOLS
// ============================================

const runtime = createRuntime({
  provider,
  model,
  systemPrompt: `You are a helpful AI assistant for YourGPT. You have access to a knowledge base tool to search for information about YourGPT products, SDK, pricing, and features.

IMPORTANT: When the user asks about YourGPT, the SDK, pricing, or any product-related question, ALWAYS use the search_knowledge_base tool first to find accurate information before responding.

Be helpful, concise, and accurate. If the knowledge base doesn't have the answer, say so.`,
  debug: true,
  tools: serverTools,
  agentLoop: {
    enabled: true,
    maxIterations: 5,
    debug: true,
  },
});

// ============================================
// MINIMAL RUNTIME (No tools, simple prompt)
// ============================================

const minimalRuntime = createRuntime({
  provider,
  model,
  systemPrompt: "You are a helpful AI assistant.",
});

// ============================================
// MINIMAL COPILOT RESPONSE ENDPOINT
// ============================================

/**
 * Minimal streaming endpoint - no tools, simple prompt
 */
app.post("/api/copilot-response", async (req, res) => {
  await minimalRuntime.stream(req.body).pipeToResponse(res);
});

/**
 * Minimal non-streaming endpoint - no tools, simple prompt
 */
app.post("/api/copilot-response/chat", async (req, res) => {
  const result = await minimalRuntime.chat(req.body);
  res.json(result);
});

// ============================================
// COPILOT SDK COMPATIBLE ENDPOINTS
// ============================================

/**
 * Streaming (SSE) - Primary endpoint for Copilot SDK
 */
app.post("/api/copilot/stream", async (req, res) => {
  console.log("\n========================================");
  console.log("[/api/copilot/stream] SSE streaming request");
  console.log("Messages:", JSON.stringify(req.body.messages, null, 2));
  console.log("========================================\n");

  await runtime
    .stream(req.body, {
      onFinish: ({ messages, usage }) => {
        console.log("\n=== Stream Complete ===");
        console.log("Messages:", messages.length);
        console.log("Usage:", usage);
      },
    })
    .pipeToResponse(res);
});

/**
 * Non-streaming - For Copilot SDK with streaming={false}
 */
app.post("/api/copilot/chat", async (req, res) => {
  console.log("\n========================================");
  console.log("[/api/copilot/chat] Non-streaming request");
  console.log("Messages:", JSON.stringify(req.body.messages, null, 2));
  console.log("========================================\n");

  const { usage, ...clientResult } = await runtime.chat(req.body);

  if (usage) {
    console.log("\n=== Chat Complete ===");
    console.log("Usage:", usage);
  }

  res.json(clientResult);
});

/**
 * Express handler - One-liner alternative
 */
app.post("/api/copilot/handler", runtime.expressHandler());

// ============================================
// DIRECT TEST ENDPOINT (bypasses CopilotProvider format)
// ============================================

/**
 * Direct test endpoint that mimics the CopilotController pattern
 * Similar to what's used in the real YourGPT Copilot backend
 */
app.post("/api/test/copilot-response", async (req, res) => {
  console.log("\n========================================");
  console.log("[/api/test/copilot-response] Direct API test");
  console.log("Body:", JSON.stringify(req.body, null, 2));
  console.log("========================================\n");

  try {
    const { messages, system, temperature, max_tokens } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        type: "RXERROR",
        message: "Invalid params: messages array is required",
      });
    }

    // Use runtime.chat() for non-streaming response (like the original code)
    const result = await runtime.chat({
      messages,
      systemPrompt: system,
      config: {
        temperature,
        maxTokens: max_tokens || 4096,
      },
    });

    console.log("\n=== Response Complete ===");
    console.log("Text length:", result.text?.length || 0);
    console.log("Tool calls:", result.toolCalls?.length || 0);
    console.log("Messages:", result.messages?.length || 0);

    // Return in the format expected by the original controller
    return res.status(200).json({
      text: result.text,
      messages: result.messages,
      toolCalls: result.toolCalls,
    });
  } catch (error) {
    console.error("[/api/test/copilot-response] Error:", error);
    return res.status(500).json({
      type: "RXERROR",
      message: "Failed to process copilot request",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// ============================================
// RAW STREAMING ENDPOINTS
// ============================================

app.post("/api/raw/stream/text", async (req, res) => {
  console.log("[/api/raw/stream/text] Plain text streaming");
  await runtime.stream(req.body).pipeTextToResponse(res);
});

app.post("/api/raw/stream/events", async (req, res) => {
  console.log("[/api/raw/stream/events] Streaming with event handlers");

  const result = runtime
    .stream(req.body)
    .on("text", (text: string) => {
      process.stdout.write(text);
    })
    .on("toolCall", (call: { name: string; args: unknown }) => {
      console.log("\n[Tool Call]", call.name, call.args);
    })
    .on("done", (final: { text: string }) => {
      console.log("\n[Done] Total length:", final.text.length);
    })
    .on("error", (err: Error) => {
      console.error("\n[Error]", err.message);
    });

  await result.pipeToResponse(res, { includeUsage: true });
});

// ============================================
// RAW NON-STREAMING ENDPOINTS
// ============================================

app.post("/api/raw/generate/text", async (req, res) => {
  console.log("[/api/raw/generate/text] Text only response");
  const text = await runtime.stream(req.body).text();
  res.json({ text });
});

app.post("/api/raw/generate/full", async (req, res) => {
  console.log("[/api/raw/generate/full] Full response data");
  const { text, messages, toolCalls, usage } = await runtime
    .stream(req.body)
    .collect({ includeUsage: true });
  res.json({ text, messages, toolCalls, usage });
});

// ============================================
// HEALTH CHECK
// ============================================

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    provider: process.env.ANTHROPIC_API_KEY ? "anthropic" : "openai",
    model,
    serverTools: serverTools.map((t) => t.name),
    endpoints: {
      copilot: [
        "POST /api/copilot/stream - SSE streaming",
        "POST /api/copilot/chat - Non-streaming JSON",
        "POST /api/copilot/handler - Express handler",
      ],
      test: [
        "POST /api/test/copilot-response - Direct API test (mimics CopilotController)",
      ],
      raw: [
        "POST /api/raw/stream/text - Plain text stream",
        "POST /api/raw/stream/events - Stream with event logging",
        "POST /api/raw/generate/text - Returns { text }",
        "POST /api/raw/generate/full - Returns { text, messages, toolCalls, usage }",
      ],
    },
  });
});

// ============================================
// SERVER START
// ============================================

const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║         Express Demo - Server-Side Tools                      ║
╠══════════════════════════════════════════════════════════════╣
║  Server:   http://localhost:${port}                              ║
║  Provider: ${(process.env.ANTHROPIC_API_KEY ? "Anthropic" : "OpenAI").padEnd(47)}║
║  Model:    ${model.padEnd(47)}║
╚══════════════════════════════════════════════════════════════╝

Server-side Tools:
  - search_knowledge_base: Search dummy KB data
  - get_current_time: Get server time

=== TEST CURLS ===

# Test knowledge base search (server-side tool)
curl -X POST http://localhost:${port}/api/copilot/chat \\
  -H "Content-Type: application/json" \\
  -d '{"messages":[{"role":"user","content":"What is YourGPT SDK?"}]}'

# Test streaming with tools
curl -X POST http://localhost:${port}/api/copilot/stream \\
  -H "Content-Type: application/json" \\
  -d '{"messages":[{"role":"user","content":"Tell me about SDK pricing"}]}'

# Test direct API (mimics CopilotController)
curl -X POST http://localhost:${port}/api/test/copilot-response \\
  -H "Content-Type: application/json" \\
  -d '{"messages":[{"role":"user","content":"How do I install the SDK?"}]}'

# Test time tool
curl -X POST http://localhost:${port}/api/copilot/chat \\
  -H "Content-Type: application/json" \\
  -d '{"messages":[{"role":"user","content":"What time is it?"}]}'
  `);
});
