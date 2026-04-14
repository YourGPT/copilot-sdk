import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { createRuntime } from "@yourgpt/llm-sdk";
import { createAnthropic } from "@yourgpt/llm-sdk/anthropic";
import { createOpenAI } from "@yourgpt/llm-sdk/openai";
import { generativeUISystemPrompt } from "@yourgpt/copilot-sdk/experimental";
import { loadSkills } from "@yourgpt/copilot-sdk/server";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function resolveProvider() {
  if (process.env.ANTHROPIC_API_KEY) {
    return {
      provider: createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY }),
      model: "claude-haiku-4-5",
      providerName: "Anthropic",
    };
  }
  if (process.env.OPENAI_API_KEY) {
    return {
      provider: createOpenAI({ apiKey: process.env.OPENAI_API_KEY }),
      model: "gpt-4o-mini",
      providerName: "OpenAI",
    };
  }
  throw new Error("Set ANTHROPIC_API_KEY or OPENAI_API_KEY");
}

const { provider, model, providerName } = resolveProvider();

// ── Load skills from /skills directory ───────────────────────────────────────

const { skills, buildSystemPrompt, tools } = await loadSkills({
  dir: path.join(__dirname, "../skills"),
});

console.log(`Loaded ${skills.length} skill(s):`);
for (const skill of skills) {
  console.log(`  - ${skill.name} [${skill.strategy}]: ${skill.description}`);
}

// ── Build combined system prompt ─────────────────────────────────────────────

const acmeContext = `You are the AI copilot for Acme Inc., a B2B SaaS company. Help with sales analytics, revenue, customer insights, and metrics.

COMPANY DATA (use for all queries):
- Acme Inc., B2B SaaS, founded 2019
- Products: Starter ($29/mo), Pro ($79/mo), Enterprise (custom)
- ARR: ~$4.2M, +18% YoY. ~320 customers, avg deal $13K
- Markets: NA 55%, Europe 30%, APAC 15%. Sales team: 12 reps
- Customer names: Meridian Health, Northstar Logistics, Cascade Analytics, Summit Financial, Pinecrest Media, Velocity Motors, Harborview Tech, Redwood Partners`;

const systemPrompt = buildSystemPrompt(
  acmeContext + "\n\n" + generativeUISystemPrompt(),
);

const runtime = createRuntime({
  provider,
  model,
  systemPrompt,
  maxIterations: 1,
});

// ── Express server ───────────────────────────────────────────────────────────

const app = express();
app.use(cors());
app.use(express.json());

// Skills API (for frontend skill cards)
app.get("/api/skills", (_req, res) => {
  res.json(
    skills.map((s) => ({
      name: s.name,
      description: s.description,
      strategy: s.strategy,
      version: s.version,
    })),
  );
});

app.get("/api/skills/:name", (req, res) => {
  const skill = skills.find((s) => s.name === req.params.name);
  if (!skill) return res.status(404).json({ error: "Skill not found" });
  res.json({ name: skill.name, content: skill.content });
});

app.get("/api/chat", (_req, res) => {
  res.json({ status: "ok", provider: providerName, model });
});

app.post("/api/chat", async (req, res) => {
  const PORT_NUM = process.env.PORT || 3030;
  const url = `http://localhost:${PORT_NUM}/api/chat`;
  const webReq = new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(req.body),
  });
  const response = await runtime.handleRequest(webReq);
  res.status(response.status);
  response.headers.forEach((val, key) => res.setHeader(key, val));

  if (response.body) {
    const reader = response.body.getReader();
    const pump = async () => {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          res.end();
          return;
        }
        res.write(value);
      }
    };
    pump().catch(() => res.end());
  } else {
    res.send(await response.text());
  }
});

const PORT = process.env.PORT ? Number(process.env.PORT) : 3030;
app.listen(PORT, () =>
  console.log(
    `Generative UI server on http://localhost:${PORT} (${providerName} / ${model})`,
  ),
);
