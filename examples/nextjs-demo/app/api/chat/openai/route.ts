import { createOpenAI, createRuntime } from "@yourgpt/llm-sdk";

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const runtime = createRuntime({
  provider: openai,
  model: "gpt-4o-mini",
  systemPrompt:
    "You are a helpful assistant powered by OpenAI GPT-4o. Be concise and helpful.",
  debug: process.env.NODE_ENV === "development",
});

export async function POST(request: Request) {
  console.log("[OpenAI Route] Received request");
  try {
    const response = await runtime.handleRequest(request);
    console.log("[OpenAI Route] Response status:", response.status);
    return response;
  } catch (error) {
    console.error("[OpenAI Route] Error:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}

export async function GET() {
  return Response.json({ status: "ok", provider: "openai" });
}
