import { createRuntime } from "@yourgpt/llm-sdk";
import { createTogetherAI } from "@yourgpt/llm-sdk/togetherai";
import { DEFAULT_MODEL } from "@/lib/models";

const SYSTEM_PROMPT = `You are a helpful AI assistant powered by Together AI.
You have access to many different open-source AI models and can help with a wide variety of tasks.
Be concise, helpful, and friendly in your responses.`;

export async function POST(request: Request) {
  try {
    const url = new URL(request.url);

    // Get model from query param
    const model = url.searchParams.get("model") || DEFAULT_MODEL;

    // Get API key from environment
    const apiKey = process.env.TOGETHER_API_KEY;

    if (!apiKey) {
      return Response.json(
        {
          error:
            "Together AI API key not configured. Set TOGETHER_API_KEY in .env.local",
        },
        { status: 401 },
      );
    }

    // Create Together AI provider
    const together = createTogetherAI({ apiKey });

    // Create runtime with the selected model
    const runtime = createRuntime({
      provider: together,
      model,
      systemPrompt: SYSTEM_PROMPT,
      debug: process.env.NODE_ENV === "development",
    });

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

export async function GET(request: Request) {
  const url = new URL(request.url);
  const model = url.searchParams.get("model") || DEFAULT_MODEL;

  const hasEnvKey = !!process.env.TOGETHER_API_KEY;

  return Response.json({
    status: "ok",
    provider: "togetherai",
    model,
    configured: hasEnvKey,
  });
}
