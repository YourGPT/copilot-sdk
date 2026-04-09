import "dotenv/config";
import express from "express";
import cors from "cors";
import { streamText } from "@yourgpt/llm-sdk";
import { togetherai } from "@yourgpt/llm-sdk/togetherai";

// ── Available models — https://api.together.xyz/models ───────────────────────
// Not all models are available on every account; unavailable ones return 404.

export const TOGETHER_MODELS = [
  // DeepSeek
  { id: "deepseek-ai/DeepSeek-V3.1", label: "DeepSeek V3.1" },
  { id: "deepseek-ai/DeepSeek-V3", label: "DeepSeek V3" },
  { id: "deepseek-ai/DeepSeek-R1", label: "DeepSeek R1" },
  // Llama
  {
    id: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
    label: "Llama 3.3 70B Turbo",
  },
  {
    id: "meta-llama/Meta-Llama-3.1-405B-Instruct-Turbo",
    label: "Llama 3.1 405B Turbo",
  },
  {
    id: "meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo",
    label: "Llama 3.1 70B Turbo",
  },
  {
    id: "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo",
    label: "Llama 3.1 8B Turbo",
  },
  // Qwen
  { id: "Qwen/Qwen3.5-397B-A17B", label: "Qwen 3.5 397B" },
  { id: "Qwen/Qwen3.5-9B", label: "Qwen 3.5 9B" },
  // Kimi
  { id: "moonshotai/Kimi-K2.5", label: "Kimi K2.5" },
  // GLM
  { id: "zai-org/GLM-5.1", label: "GLM-5.1" },
  // Gemma
  { id: "google/gemma-4-31B-it", label: "Gemma 4 31B" },
  // Other
  { id: "openai/gpt-oss-120b", label: "GPT OSS 120B" },
  { id: "MiniMaxAI/MiniMax-M2.5", label: "MiniMax M2.5" },
];

export const DEFAULT_MODEL = TOGETHER_MODELS[0].id; // deepseek-v3.1

// ── Server ────────────────────────────────────────────────────────────────────

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/models", (_req, res) => {
  res.json({ models: TOGETHER_MODELS, default: DEFAULT_MODEL });
});

app.get("/api/chat", (_req, res) => {
  res.json({
    status: "ok",
    provider: "togetherai",
    configured: !!process.env.TOGETHER_API_KEY,
  });
});

app.post("/api/chat", async (req, res) => {
  const apiKey = process.env.TOGETHER_API_KEY;
  if (!apiKey) {
    res.status(401).json({ error: "Set TOGETHER_API_KEY in .env" });
    return;
  }

  // Model comes from query param (set by CopilotProvider runtimeUrl)
  const modelId = (req.query.model as string | undefined) ?? DEFAULT_MODEL;
  const { messages } = req.body as { messages: any[] };

  try {
    const result = await streamText({
      model: togetherai(modelId, { apiKey }),
      system:
        "You are a helpful assistant powered by Together AI. Be concise and accurate.",
      messages,
    });

    const webRes = result.toDataStreamResponse();
    res.status(webRes.status);
    webRes.headers.forEach((val, key) => res.setHeader(key, val));
    const body = await webRes.text();
    res.send(body);
  } catch (err: any) {
    console.error("[togetherai-demo] error:", err?.message ?? err);
    if (!res.headersSent) {
      res.status(500).json({ error: err?.message ?? "Unknown error" });
    }
  }
});

const PORT = process.env.PORT ? Number(process.env.PORT) : 3034;
app.listen(PORT, () =>
  console.log(
    `\nTogether AI demo → http://localhost:${PORT + 1} (client) | http://localhost:${PORT} (server)`,
  ),
);
