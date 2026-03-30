import { createRuntime } from "@yourgpt/llm-sdk";
import { createAnthropic } from "@yourgpt/llm-sdk/anthropic";

const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const runtime = createRuntime({
  provider: anthropic,
  model: "claude-haiku-4-5",
  systemPrompt:
    "You are a helpful assistant. Keep all replies to 1-2 sentences so branching is easy to demonstrate.",
});

export async function POST(request: Request) {
  return runtime.handleRequest(request);
}

export async function GET() {
  return Response.json({ status: "ok", provider: "anthropic", demo: "branching" });
}
