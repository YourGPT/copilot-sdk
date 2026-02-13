import { NextRequest, NextResponse } from "next/server";
import { fetchOpenRouterModels } from "@yourgpt/llm-sdk/openrouter";

export const runtime = "edge";

/**
 * GET /api/openrouter/models
 * Fetch available OpenRouter models
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const apiKey = searchParams.get("apiKey") || undefined;
    const search = searchParams.get("search") || "";

    // Fetch all models
    const models = await fetchOpenRouterModels(apiKey);

    // Filter by search query if provided
    const filteredModels = search
      ? models.filter(
          (model) =>
            model.id.toLowerCase().includes(search.toLowerCase()) ||
            model.name.toLowerCase().includes(search.toLowerCase()),
        )
      : models;

    return NextResponse.json({
      success: true,
      models: filteredModels,
      total: filteredModels.length,
    });
  } catch (error) {
    console.error("Error fetching OpenRouter models:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to fetch models",
      },
      { status: 500 },
    );
  }
}
