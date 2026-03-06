import { createRuntime } from "@yourgpt/llm-sdk";
import { createAnthropic } from "@yourgpt/llm-sdk/anthropic";

const SYSTEM_PROMPT = `You are a helpful AI assistant with access to a knowledge base.

When users ask questions:
1. Use the search_knowledge tool to find relevant information from the knowledge base
2. Synthesize the information into a helpful response
3. If the knowledge base doesn't have relevant information, acknowledge this and provide general guidance

Guidelines:
- Always try to search the knowledge base first for factual questions
- Cite information from the knowledge base when relevant
- Be concise and helpful in your responses`;

export async function POST(request: Request) {
  try {
    const anthropicKey = process.env.ANTHROPIC_API_KEY;

    if (!anthropicKey) {
      return Response.json(
        {
          error:
            "Anthropic API key not configured. Set ANTHROPIC_API_KEY in .env.local",
        },
        { status: 401 },
      );
    }

    const anthropic = createAnthropic({ apiKey: anthropicKey });

    const runtime = createRuntime({
      provider: anthropic,
      model: "claude-haiku-4-5",
      systemPrompt: SYSTEM_PROMPT,
      debug: process.env.NODE_ENV === "development",
    });

    return runtime.handleRequest(request);
  } catch (error) {
    console.error("[Chat Route] Error:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}

export async function GET() {
  return Response.json({
    status: "ok",
    provider: "anthropic",
    model: "claude-haiku-4-5",
    knowledgeBase: {
      configured: !!process.env.YOURGPT_KB_API_KEY,
      note: "Knowledge base search is handled on the client side via CopilotProvider",
    },
  });
}
