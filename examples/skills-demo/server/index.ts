import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import { Readable } from "stream";
import { fileURLToPath } from "url";
import { createRuntime } from "@yourgpt/llm-sdk";
import { createAnthropic } from "@yourgpt/llm-sdk/anthropic";
import { createOpenAI } from "@yourgpt/llm-sdk/openai";
import { loadSkills } from "@yourgpt/copilot-sdk/server";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

// ============================================
// LOAD SKILLS FROM /skills DIRECTORY
// ============================================

const { skills, buildSystemPrompt, tools } = await loadSkills({
  dir: path.join(__dirname, "../skills"),
});

console.log(`\nLoaded ${skills.length} skill(s):`);
for (const skill of skills) {
  console.log(
    `  - ${skill.name} [${skill.strategy ?? "auto"}]: ${skill.description}`,
  );
}

// ============================================
// DYNAMIC SKILLS (registered at runtime)
// ============================================

interface DynamicSkill {
  name: string;
  description: string;
  content: string;
  strategy: string;
}

const dynamicSkills: DynamicSkill[] = [];

// ============================================
// CREATE PROVIDERS
// ============================================

const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const provider = process.env.ANTHROPIC_API_KEY ? anthropic : openai;
const model = process.env.ANTHROPIC_API_KEY
  ? "claude-haiku-4-5"
  : "gpt-4o-mini";

console.log(
  `\nUsing provider: ${process.env.ANTHROPIC_API_KEY ? "Anthropic" : "OpenAI"}`,
);
console.log(`Using model: ${model}`);

// ============================================
// CREATE RUNTIME WITH SKILL TOOL
// ============================================

const systemPrompt = buildSystemPrompt(
  `You are the AI Copilot for Dash, a SaaS analytics and operations platform.
You assist the team with revenue analysis, customer health monitoring, and incident response.

When a user asks about:
- Revenue, MRR, churn, growth, or financial metrics → load the "revenue-intelligence" skill
- Customer risk, health scores, at-risk accounts, or engagement → load the "customer-health" skill
- Incidents, outages, production issues, or on-call → load the "incident-runbook" skill

Always load the relevant skill before responding.`,
);

const runtime = createRuntime({
  provider,
  model,
  systemPrompt,
  debug: true,
});

// Register the load_skill tool with the runtime
runtime.registerTool({
  name: "load_skill",
  description: tools.load_skill.description,
  location: "server",
  inputSchema: tools.load_skill.parameters,
  handler: async (params: { name: string }) => {
    // Delay so the shimmer animation is visible in the UI
    await new Promise((r) => setTimeout(r, 2200));
    // Check dynamicSkills first before falling back to file-based skills
    const dynamic = dynamicSkills.find((s) => s.name === params.name);
    if (dynamic) {
      return {
        name: dynamic.name,
        description: dynamic.description,
        content: dynamic.content,
        strategy: dynamic.strategy,
        source: "dynamic",
      };
    }
    return tools.load_skill.execute(params);
  },
});

// ============================================
// ROUTES
// ============================================

/**
 * POST /api/chat — Main chat endpoint for CopilotProvider
 * Rebuilds system prompt per-request to include any dynamically registered skills.
 */
app.post("/api/chat", async (req, res) => {
  const url = `http://localhost:${PORT}/api/chat`;

  // Inject dynamic skills into the system prompt so the AI knows they exist
  const body = { ...req.body };
  if (dynamicSkills.length > 0) {
    const dynamicSection = dynamicSkills
      .map(
        (s) =>
          `- "${s.name}" [${s.strategy}]: ${s.description} → load with load_skill("${s.name}")`,
      )
      .join("\n");
    body.systemPrompt =
      systemPrompt +
      `\n\n## Additional Skills (dropped at runtime)\n${dynamicSection}`;
  }

  const webReq = new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const response = await runtime.handleRequest(webReq);
  res.status(response.status);
  response.headers.forEach((val, key) => res.setHeader(key, val));
  if (response.body) {
    Readable.fromWeb(
      response.body as Parameters<typeof Readable.fromWeb>[0],
    ).pipe(res);
  } else {
    res.send(await response.text());
  }
});

/**
 * GET /api/skills — Returns skill metadata for the UI sidebar (static + dynamic)
 */
app.get("/api/skills", (_req, res) => {
  const staticList = skills.map((skill) => ({
    name: skill.name,
    description: skill.description,
    strategy: skill.strategy ?? "auto",
    version: skill.version,
    source: "file",
  }));

  const dynamicList = dynamicSkills.map((skill) => ({
    name: skill.name,
    description: skill.description,
    strategy: skill.strategy,
    source: "dropped",
  }));

  res.json([...staticList, ...dynamicList]);
});

/**
 * GET /api/skills/:name — Returns full content of a skill (reuses load_skill handler)
 */
app.get("/api/skills/:name", async (req, res) => {
  const { name } = req.params;
  try {
    // Reuse the same handler registered with the runtime — covers both file and dynamic skills
    const dynamic = dynamicSkills.find((s) => s.name === name);
    const result = dynamic
      ? {
          name: dynamic.name,
          description: dynamic.description,
          content: dynamic.content,
          strategy: dynamic.strategy,
          source: "dynamic",
        }
      : await tools.load_skill.execute({ name });
    res.json(result);
  } catch {
    res.status(404).json({ error: "Skill not found" });
  }
});

/**
 * POST /api/skills/register — Register a new dynamic skill from a dropped file
 */
app.post("/api/skills/register", (req, res) => {
  const { name, description, content, strategy } = req.body as {
    name?: string;
    description?: string;
    content?: string;
    strategy?: string;
  };

  if (!name || !content) {
    res.status(400).json({ error: "name and content are required" });
    return;
  }

  const skill: DynamicSkill = {
    name,
    description: description ?? "",
    content,
    strategy: strategy ?? "auto",
  };

  // Deduplicate by name — replace existing if present
  const existingIdx = dynamicSkills.findIndex((s) => s.name === name);
  if (existingIdx !== -1) {
    dynamicSkills[existingIdx] = skill;
  } else {
    dynamicSkills.push(skill);
  }

  console.log(`  + Dynamic skill registered: ${name} [${skill.strategy}]`);
  res.json({ ok: true, name, strategy: skill.strategy });
});

/**
 * DELETE /api/skills/dynamic — Clears all dropped skills (called on client load)
 */
app.delete("/api/skills/dynamic", (_req, res) => {
  dynamicSkills.length = 0;
  res.json({ ok: true });
});

/**
 * GET /api/health — Health check
 */
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    provider: process.env.ANTHROPIC_API_KEY ? "anthropic" : "openai",
    model,
    skillCount: skills.length + dynamicSkills.length,
  });
});

// ============================================
// SERVER START
// ============================================

const PORT = parseInt(process.env.PORT ?? "3032", 10);

app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║              Skills Demo — Express Server                     ║
╠══════════════════════════════════════════════════════════════╣
║  Server:   http://localhost:${PORT}                              ║
║  Provider: ${(process.env.ANTHROPIC_API_KEY ? "Anthropic" : "OpenAI").padEnd(47)}║
║  Model:    ${model.padEnd(47)}║
║  Skills:   ${String(skills.length).padEnd(47)}║
╚══════════════════════════════════════════════════════════════╝

Endpoints:
  POST /api/chat             — CopilotProvider chat endpoint
  GET  /api/skills           — Skill metadata for the UI
  POST /api/skills/register  — Register a dynamic skill from dropped file
  GET  /api/health           — Health check
`);
});
