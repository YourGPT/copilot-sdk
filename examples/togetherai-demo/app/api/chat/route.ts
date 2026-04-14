import { createRuntime } from "@yourgpt/llm-sdk";
import { createFallbackChain } from "@yourgpt/llm-sdk/fallback";
import { createTogetherAI } from "@yourgpt/llm-sdk/togetherai";
import { DEFAULT_MODEL, FALLBACK_MODELS } from "@/lib/models";

const SYSTEM_PROMPT = `You are a helpful AI assistant powered by Together AI.
You have access to many different open-source AI models and can help with a wide variety of tasks.
Be concise, helpful, and friendly in your responses.`;

export async function POST(request: Request) {
  try {
    const url = new URL(request.url);

    // Get model from query param
    const model = url.searchParams.get("model") || DEFAULT_MODEL;
    const useFallback = url.searchParams.get("fallback") === "true";

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

    const together = createTogetherAI({ apiKey });

    if (useFallback) {
      // Fallback chain: primary model → fallback models
      const fallbackModelIds = FALLBACK_MODELS.filter((id) => id !== model);
      const models = [model, ...fallbackModelIds].map((id) =>
        together.languageModel(id),
      );

      const chain = createFallbackChain({
        models,
        strategy: "priority",
        retries: 1,
        retryDelay: 500,
        retryBackoff: "exponential",
        onRetry: ({ model, retryAttempt, maxRetries, delayMs, error }) => {
          console.warn(
            `[retry] ${model} attempt ${retryAttempt}/${maxRetries} — waiting ${delayMs}ms | ${(error as Error).message}`,
          );
        },
        onFallback: ({ attemptedModel, nextModel, error, attempt }) => {
          console.warn(
            `[fallback] attempt ${attempt}: ${attemptedModel} → ${nextModel} | ${(error as Error).message}`,
          );
        },
      });

      const runtime = createRuntime({
        adapter: chain,
        systemPrompt: SYSTEM_PROMPT,
        debug: process.env.NODE_ENV === "development",
      });

      return await runtime.handleRequest(request);
    }

    // Single model (no fallback)
    const runtime = createRuntime({
      provider: together,
      model,
      systemPrompt: SYSTEM_PROMPT,
      debug: process.env.NODE_ENV === "development",
    });

    return await runtime.handleRequest(request);
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
  const useFallback = url.searchParams.get("fallback") === "true";

  return Response.json({
    status: "ok",
    provider: "togetherai",
    model,
    fallback: useFallback,
    fallbackModels: useFallback ? FALLBACK_MODELS : [],
    configured: !!process.env.TOGETHER_API_KEY,
  });
}
