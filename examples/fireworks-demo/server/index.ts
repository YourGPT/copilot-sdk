import "dotenv/config";
import express from "express";
import cors from "cors";
import { streamText } from "@yourgpt/llm-sdk";
import { fireworks } from "@yourgpt/llm-sdk/fireworks";

// ── Available models — https://fireworks.ai/models ────────────────────────────
// Not all models are available on every account; unavailable ones return 404.

export const FIREWORKS_MODELS = [
  // DeepSeek
  { id: "accounts/fireworks/models/deepseek-v3p2", label: "DeepSeek V3.2" },
  { id: "accounts/fireworks/models/deepseek-v3p1", label: "DeepSeek V3.1" },
  { id: "accounts/fireworks/models/deepseek-v3", label: "DeepSeek V3" },
  { id: "accounts/fireworks/models/deepseek-r1", label: "DeepSeek R1" },
  {
    id: "accounts/fireworks/models/deepseek-r1-0528",
    label: "DeepSeek R1 (0528)",
  },
  // Llama
  {
    id: "accounts/fireworks/models/llama-v3p3-70b-instruct",
    label: "Llama 3.3 70B",
  },
  {
    id: "accounts/fireworks/models/llama-v3p1-405b-instruct",
    label: "Llama 3.1 405B",
  },
  {
    id: "accounts/fireworks/models/llama-v3p1-70b-instruct",
    label: "Llama 3.1 70B",
  },
  {
    id: "accounts/fireworks/models/llama-v3p1-8b-instruct",
    label: "Llama 3.1 8B",
  },
  {
    id: "accounts/fireworks/models/llama-v3p2-90b-vision-instruct",
    label: "Llama 3.2 90B Vision",
  },
  {
    id: "accounts/fireworks/models/llama-v3p2-11b-vision-instruct",
    label: "Llama 3.2 11B Vision",
  },
  // Kimi
  {
    id: "accounts/fireworks/models/kimi-k2-instruct",
    label: "Kimi K2 Instruct",
  },
  { id: "accounts/fireworks/models/kimi-k2p5", label: "Kimi K2.5" },
  // Qwen
  { id: "accounts/fireworks/models/qwen3-235b-a22b", label: "Qwen3 235B" },
  { id: "accounts/fireworks/models/qwen3-30b-a3b", label: "Qwen3 30B" },
  {
    id: "accounts/fireworks/models/qwen2p5-72b-instruct",
    label: "Qwen 2.5 72B",
  },
  {
    id: "accounts/fireworks/models/qwen2p5-coder-32b-instruct",
    label: "Qwen 2.5 Coder 32B",
  },
  // Mixtral
  {
    id: "accounts/fireworks/models/mixtral-8x22b-instruct",
    label: "Mixtral 8x22B",
  },
  {
    id: "accounts/fireworks/models/mixtral-8x7b-instruct",
    label: "Mixtral 8x7B",
  },
  // GLM
  { id: "accounts/fireworks/models/glm-5", label: "GLM-5" },
  { id: "accounts/fireworks/models/glm-4p7", label: "GLM-4.7" },
  // Gemma
  { id: "accounts/fireworks/models/gemma2-9b-it", label: "Gemma 2 9B" },
  // Phi
  {
    id: "accounts/fireworks/models/phi-3-vision-128k-instruct",
    label: "Phi-3 Vision 128K",
  },
  // Other
  { id: "accounts/fireworks/models/gpt-oss-120b", label: "GPT OSS 120B" },
  { id: "accounts/cogito/models/cogito-671b-v2-p1", label: "Cogito 671B" },
];

export const DEFAULT_MODEL = FIREWORKS_MODELS[0].id; // deepseek-v3p2

// ── Server ────────────────────────────────────────────────────────────────────

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/models", (_req, res) => {
  res.json({ models: FIREWORKS_MODELS, default: DEFAULT_MODEL });
});

app.get("/api/chat", (_req, res) => {
  res.json({
    status: "ok",
    provider: "fireworks",
    configured: !!process.env.FIREWORKS_API_KEY,
  });
});

app.post("/api/chat", async (req, res) => {
  const apiKey = process.env.FIREWORKS_API_KEY;
  if (!apiKey) {
    res.status(401).json({ error: "Set FIREWORKS_API_KEY in .env" });
    return;
  }

  // Model comes from query param (set by CopilotProvider runtimeUrl)
  const modelId = (req.query.model as string | undefined) ?? DEFAULT_MODEL;
  const { messages } = req.body as { messages: any[] };

  try {
    const result = await streamText({
      model: fireworks(modelId, { apiKey }),
      system:
        "You are a helpful assistant powered by Fireworks.ai. Be concise and accurate.",
      messages,
    });

    const webRes = result.toDataStreamResponse();
    res.status(webRes.status);
    webRes.headers.forEach((val, key) => res.setHeader(key, val));
    const body = await webRes.text();
    res.send(body);
  } catch (err: any) {
    console.error("[fireworks-demo] error:", err?.message ?? err);
    if (!res.headersSent) {
      res.status(500).json({ error: err?.message ?? "Unknown error" });
    }
  }
});

const PORT = process.env.PORT ? Number(process.env.PORT) : 3032;
app.listen(PORT, () =>
  console.log(
    `\nFireworks demo → http://localhost:${PORT + 1} (client) | http://localhost:${PORT} (server)`,
  ),
);
