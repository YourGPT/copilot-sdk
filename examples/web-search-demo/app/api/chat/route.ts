import { createRuntime } from "@yourgpt/llm-sdk";
import { createAnthropic } from "@yourgpt/llm-sdk/anthropic";

const SYSTEM_PROMPT = `You are a helpful AI assistant with web search capabilities.

When users ask about:
- Current events, news, or recent happenings
- Real-time data like prices, weather, or sports scores
- Information that might have changed after your training
- Facts that need verification with current sources

Use web search to find accurate, up-to-date information.

Guidelines:
1. Always cite your sources when presenting information from search results
2. Summarize findings clearly and concisely
3. If search results are insufficient, acknowledge the limitation
4. For opinion-based questions, present multiple viewpoints if available`;

export async function POST(request: Request) {
  try {
    // Validate Anthropic API key
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

    // Create Anthropic provider
    const anthropic = createAnthropic({ apiKey: anthropicKey });

    // Create runtime with NATIVE web search (single API call!)
    const runtime = createRuntime({
      provider: anthropic,
      model: "claude-haiku-4-5",
      systemPrompt: SYSTEM_PROMPT,
      // Native web search - no extra tools needed!
      webSearch: true,
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
    webSearch: {
      type: "native",
      configured: !!process.env.ANTHROPIC_API_KEY,
      note: "Using Claude's native web search (single API call, citations included)",
    },
  });
}
