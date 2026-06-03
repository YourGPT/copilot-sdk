import "dotenv/config";
import express from "express";
import cors from "cors";
import { streamText } from "@yourgpt/llm-sdk";
import { fireworks } from "@yourgpt/llm-sdk/fireworks";

// ── Available models ──────────────────────────────────────────────────────────
// Fetched live from the account so the list never goes stale. Hardcoded model
// IDs rot quickly: Fireworks renames/retires them, and not every model is
// deployed on every account — unavailable ones return 404 at chat time.
//
// We query GET /models, keep only chat-capable *text* models (image-gen models
// like flux-* report no context_length), and prettify the IDs into labels.

interface ModelOption {
  id: string;
  label: string;
}

/** Curated fallback used only if the live /models fetch fails. */
const FALLBACK_MODELS: ModelOption[] = [
  { id: "accounts/fireworks/models/gpt-oss-120b", label: "GPT OSS 120B" },
];

// Nice labels for well-known model IDs; everything else is prettified from the id.
const LABEL_OVERRIDES: Record<string, string> = {
  "deepseek-v4-pro": "DeepSeek V4 Pro",
  "gpt-oss-120b": "GPT OSS 120B",
  "kimi-k2p6": "Kimi K2.6",
  "kimi-k2p5": "Kimi K2.5",
  "glm-5p1": "GLM-5.1",
};

function prettifyLabel(id: string): string {
  const name = id.split("/").pop() ?? id;
  if (LABEL_OVERRIDES[name]) return LABEL_OVERRIDES[name];
  return name
    .replace(/-/g, " ")
    .replace(/\bv(\d)p(\d)\b/gi, "v$1.$2") // v3p2 → v3.2
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

let modelCache: { models: ModelOption[]; default: string } | null = null;

async function fetchAvailableModels(
  apiKey: string,
): Promise<{ models: ModelOption[]; default: string }> {
  if (modelCache) return modelCache;

  try {
    const res = await fetch("https://api.fireworks.ai/inference/v1/models", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) throw new Error(`models endpoint returned ${res.status}`);

    const json = (await res.json()) as {
      data: Array<{
        id: string;
        supports_chat?: boolean;
        context_length?: number | null;
      }>;
    };

    const models = json.data
      // Keep chat-capable *text* models; image-gen models have no context_length.
      .filter((m) => m.supports_chat && m.context_length)
      .map((m) => ({ id: m.id, label: prettifyLabel(m.id) }))
      .sort((a, b) => a.label.localeCompare(b.label));

    if (models.length === 0)
      throw new Error("no chat-capable models on account");

    modelCache = { models, default: models[0].id };
    console.log(
      `[fireworks-demo] ${models.length} chat models available; default: ${modelCache.default}`,
    );
    return modelCache;
  } catch (err: any) {
    console.warn(
      `[fireworks-demo] could not fetch live model list (${err?.message ?? err}); using fallback`,
    );
    return { models: FALLBACK_MODELS, default: FALLBACK_MODELS[0].id };
  }
}

// ── Server ────────────────────────────────────────────────────────────────────

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/models", async (_req, res) => {
  const apiKey = process.env.FIREWORKS_API_KEY;
  if (!apiKey) {
    res.status(401).json({ error: "Set FIREWORKS_API_KEY in .env" });
    return;
  }
  res.json(await fetchAvailableModels(apiKey));
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

  // Model comes from query param (set by CopilotProvider runtimeUrl).
  // Fall back to the account's first available chat model if none was given.
  const { default: defaultModel } = await fetchAvailableModels(apiKey);
  const modelId = (req.query.model as string | undefined) ?? defaultModel;
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
