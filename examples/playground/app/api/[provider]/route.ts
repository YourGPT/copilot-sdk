import { createRuntime } from "@yourgpt/llm-sdk";
import { createOpenAI } from "@yourgpt/llm-sdk/openai";
import { createAnthropic } from "@yourgpt/llm-sdk/anthropic";
import { createGoogle } from "@yourgpt/llm-sdk/google";
import { createXAI } from "@yourgpt/llm-sdk/xai";
import { createOpenRouter } from "@yourgpt/llm-sdk/openrouter";
import { providers, SYSTEM_PROMPT } from "@/lib/constants";
import type { ProviderId } from "@/lib/types";

// Provider factory functions
const providerFactories = {
  openai: createOpenAI,
  anthropic: createAnthropic,
  google: createGoogle,
  xai: createXAI,
  openrouter: createOpenRouter,
} as const;

// Environment variable names for each provider
const envVarNames: Record<ProviderId, string> = {
  openai: "OPENAI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
  google: "GOOGLE_GENERATIVE_AI_API_KEY",
  xai: "XAI_API_KEY",
  openrouter: "OPENROUTER_API_KEY",
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  try {
    const { provider: providerId } = await params;

    // Validate provider
    const providerConfig = providers.find((p) => p.id === providerId);
    if (!providerConfig) {
      return Response.json(
        { error: `Unknown provider: ${providerId}` },
        { status: 400 },
      );
    }

    // Get API key from header (client-provided) or fallback to env
    const url = new URL(request.url);
    const clientApiKey = request.headers.get("x-api-key");
    const envVarName = envVarNames[providerId as ProviderId];
    const apiKey = clientApiKey || process.env[envVarName];

    if (!apiKey) {
      return Response.json(
        {
          error: `${providerConfig.name} API key not configured. Please add your API key in settings.`,
        },
        { status: 401 },
      );
    }

    // Create the provider instance
    const createProvider = providerFactories[providerId as ProviderId];
    const providerInstance = createProvider({ apiKey });

    // Get model - OpenRouter supports dynamic model selection via URL param
    const modelOverride = url.searchParams.get("model");
    const model =
      providerId === "openrouter" && modelOverride
        ? modelOverride
        : providerConfig.model;

    // Create runtime with shared system prompt
    const runtime = createRuntime({
      provider: providerInstance,
      model,
      systemPrompt: SYSTEM_PROMPT,
      debug: process.env.NODE_ENV === "development",
    });

    const response = await runtime.handleRequest(request);
    return response;
  } catch (error) {
    console.error(`[API Route] Error:`, error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider: providerId } = await params;

  // Validate provider
  const providerConfig = providers.find((p) => p.id === providerId);
  if (!providerConfig) {
    return Response.json(
      { error: `Unknown provider: ${providerId}` },
      { status: 400 },
    );
  }

  const envVarName = envVarNames[providerId as ProviderId];
  const hasEnvKey = !!process.env[envVarName];

  return Response.json({
    status: "ok",
    provider: providerId,
    model: providerConfig.model,
    configured: hasEnvKey,
  });
}
