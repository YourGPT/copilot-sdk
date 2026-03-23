import "dotenv/config";
import express from "express";
import cors from "cors";
import { createRuntime } from "@yourgpt/llm-sdk";
import { createOpenAI } from "@yourgpt/llm-sdk/openai";

const app = express();
app.use(cors());
app.use(express.json());

const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });

const runtime = createRuntime({
  provider: openai,
  model: "gpt-4o-mini",
  systemPrompt:
    "You are a helpful AI assistant in a team chat. Be concise, friendly, and helpful. Occasionally use markdown formatting.",
});

app.get("/api/copilot", (_req, res) => {
  res.json({ status: "ok", provider: "openai" });
});

app.post("/api/copilot", async (req, res) => {
  // createRuntime.handleRequest expects a web Request — adapt from Express
  const url = `http://localhost:${PORT}/api/copilot`;
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

const PORT = 3010;
app.listen(PORT, () =>
  console.log(`Copilot server running on http://localhost:${PORT}`),
);
