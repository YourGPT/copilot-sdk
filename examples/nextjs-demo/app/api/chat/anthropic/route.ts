import { createAnthropic, createRuntime } from "@yourgpt/llm-sdk";

const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const runtime = createRuntime({
  provider: anthropic,
  model: "claude-haiku-4-5",
  systemPrompt:
    "You are a helpful assistant powered by Anthropic Claude 3.5 Sonnet. Be concise and helpful.",
});

export async function POST(request: Request) {
  return runtime.handleRequest(request);
}

export async function GET() {
  return Response.json({ status: "ok", provider: "anthropic" });
}
