/**
 * Ollama Express Server
 *
 * Express server using Ollama as the LLM provider.
 * Includes a CopilotProvider-compatible endpoint for the React client.
 *
 * Prerequisites:
 * - Ollama installed and running (ollama serve)
 * - Model pulled: ollama pull llama3.1
 */

import "dotenv/config";
import express from "express";
import cors from "cors";
import { createRuntime } from "@yourgpt/llm-sdk";
import { createOllama } from "@yourgpt/llm-sdk/ollama";
import { serverTools } from "./tools.js";

const app = express();
app.use(cors());
app.use(express.json());

// ============================================
// SETUP OLLAMA PROVIDER
// ============================================

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
const MODEL = process.env.OLLAMA_MODEL || "llama3.1";

const ollama = createOllama({
  baseUrl: OLLAMA_BASE_URL,
  options: {
    num_ctx: 8192,
    temperature: 0.7,
  },
});

// Create runtime with Ollama + server-side tools
const runtime = createRuntime({
  provider: ollama,
  model: MODEL,
  systemPrompt:
    "You are a helpful AI assistant running locally via Ollama. You have access to weather and calculator tools.",
  tools: serverTools,
});

// ============================================
// COPILOT SDK ENDPOINT
// Used by CopilotProvider in the React client
// ============================================

app.post("/api/copilot", runtime.expressHandler());

// ============================================
// ADDITIONAL ENDPOINTS
// ============================================

/**
 * Streaming chat endpoint (SSE)
 */
app.post("/api/chat/stream", async (req, res) => {
  console.log("[/api/chat/stream] Streaming with Ollama");

  await runtime
    .stream(req.body, {
      onFinish: ({ messages }) => {
        console.log(`[Done] ${messages.length} messages`);
      },
    })
    .pipeToResponse(res);
});

/**
 * Non-streaming chat endpoint
 */
app.post("/api/chat", async (req, res) => {
  console.log("[/api/chat] Non-streaming with Ollama");

  const result = await runtime.chat(req.body);
  res.json(result);
});

/**
 * Health check
 */
app.get("/api/health", async (_req, res) => {
  let ollamaStatus = "unknown";
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`);
    if (response.ok) {
      const data = await response.json();
      ollamaStatus = `connected (${data.models?.length || 0} models)`;
    }
  } catch {
    ollamaStatus = "disconnected";
  }

  res.json({
    status: "ok",
    ollama: {
      baseUrl: OLLAMA_BASE_URL,
      model: MODEL,
      status: ollamaStatus,
    },
    endpoints: [
      "POST /api/copilot - CopilotProvider SSE endpoint",
      "POST /api/chat/stream - SSE streaming",
      "POST /api/chat - Non-streaming JSON",
    ],
  });
});

/**
 * List available Ollama models
 */
app.get("/api/models", async (_req, res) => {
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`);
    if (!response.ok) {
      throw new Error("Failed to fetch models");
    }
    const data = await response.json();
    res.json({
      models: data.models?.map((m: { name: string; size: number }) => ({
        name: m.name,
        size: m.size,
      })),
    });
  } catch (error) {
    res.status(500).json({
      error: "Cannot connect to Ollama",
      message: "Make sure Ollama is running: ollama serve",
    });
  }
});

// ============================================
// SERVER START
// ============================================

const port = process.env.PORT || 3002;
app.listen(port, () => {
  console.log(`
╔════════════════════════════════════════════════════╗
║         Ollama Local AI Server                     ║
╠════════════════════════════════════════════════════╣
║  Server:  http://localhost:${port}                    ║
║  Ollama:  ${OLLAMA_BASE_URL.padEnd(35)}║
║  Model:   ${MODEL.padEnd(35)}║
╚════════════════════════════════════════════════════╝

Endpoints:
  POST /api/copilot        - CopilotProvider SSE endpoint
  POST /api/chat/stream    - SSE streaming
  POST /api/chat           - Non-streaming JSON
  GET  /api/health         - Health check
  GET  /api/models         - List available models
  `);
});
