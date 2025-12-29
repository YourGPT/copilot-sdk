import { createOpenAI, createRuntime } from "@yourgpt/copilot-sdk-runtime";

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const runtime = createRuntime({
  provider: openai,
  model: "gpt-4.1-mini",
  systemPrompt:
    "You are a helpful assistant powered by OpenAI GPT-4o. Be concise and helpful.",
});

export async function POST(request: Request) {
  return runtime.handleRequest(request);
}

export async function GET() {
  return Response.json({ status: "ok", provider: "openai" });
}
