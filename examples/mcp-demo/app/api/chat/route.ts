import { createRuntime } from "@yourgpt/llm-sdk";
import { createOpenAI } from "@yourgpt/llm-sdk/openai";

const provider = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const runtime = createRuntime({
  provider,
  model: "gpt-4o-mini",
  systemPrompt: `You are a helpful AI assistant with access to MCP tools.
When tools are available, use them to help the user.
Be concise and helpful in your responses.`,
});

export async function POST(request: Request) {
  try {
    const response = await runtime.handleRequest(request);
    return response;
  } catch (error) {
    console.error("[Chat Route] Error:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}

export async function GET() {
  return Response.json({ status: "ok", provider: "openai" });
}
