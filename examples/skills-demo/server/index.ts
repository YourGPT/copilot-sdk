import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
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

Always load the relevant skill before responding to ensure you follow the correct protocol.
Be concise, data-focused, and action-oriented.`,
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
    return tools.load_skill.execute(params);
  },
});

// ============================================
// ROUTES
// ============================================

/**
 * POST /api/chat — Main chat endpoint for CopilotProvider
 */
app.post("/api/chat", async (req, res) => {
  const url = `http://localhost:${PORT}/api/chat`;
  const webReq = new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(req.body),
  });
  const response = await runtime.handleRequest(webReq);
  res.status(response.status);
  response.headers.forEach((val, key) => res.setHeader(key, val));
  const body = await response.text();
  res.send(body);
});

/**
 * GET /api/skills — Returns skill metadata for the UI sidebar
 */
app.get("/api/skills", (_req, res) => {
  const skillList = skills.map((skill) => ({
    name: skill.name,
    description: skill.description,
    strategy: skill.strategy ?? "auto",
    version: skill.version,
  }));
  res.json(skillList);
});

/**
 * GET /api/health — Health check
 */
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    provider: process.env.ANTHROPIC_API_KEY ? "anthropic" : "openai",
    model,
    skillCount: skills.length,
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
  POST /api/chat    — CopilotProvider chat endpoint
  GET  /api/skills  — Skill metadata for the UI
  GET  /api/health  — Health check
`);
});
