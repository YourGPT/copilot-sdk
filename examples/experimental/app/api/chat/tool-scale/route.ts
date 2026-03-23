import { createRuntime } from "@yourgpt/llm-sdk";
import { createAnthropic } from "@yourgpt/llm-sdk/anthropic";
import { createOpenAI } from "@yourgpt/llm-sdk/openai";

import { toolScaleServerTools } from "@/lib/tool-scale/server-tools";

function resolveProvider() {
  if (process.env.ANTHROPIC_API_KEY) {
    return {
      providerName: "Anthropic",
      provider: createAnthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
      }),
      model: "claude-haiku-4-5",
    };
  }

  // if (process.env.OPENAI_API_KEY) {
  //   return {
  //     providerName: "OpenAI",
  //     provider: createOpenAI({
  //       apiKey: process.env.OPENAI_API_KEY,
  //     }),
  //     model: "gpt-5-mini-2025-08-07",
  //     // model: "gpt-5.4",
  //   };
  // }

  throw new Error(
    "Set ANTHROPIC_API_KEY or OPENAI_API_KEY to run the tool scale lab example.",
  );
}

// Suppress unused import warning — kept for commented-out OPENAI_API_KEY block above
void createOpenAI;

function getRuntime() {
  const { provider, model } = resolveProvider();
  return createRuntime({
    provider,
    model,
    debug: process.env.NODE_ENV === "development",
    systemPrompt: `You are the Tool Scale Lab assistant.

You are testing a project with 100 tools: 30 server-side and 70 client-side.
Use tools sparingly and intentionally.

When tools are missing, rely on the search_tools meta-tool to discover deferred tools rather than guessing.
Keep answers short and explain which class of tools you used when it helps the user understand tool selection behavior.`,
    tools: toolScaleServerTools,
    maxIterations: 6,
    toolSearch: {
      maxResults: 6,
      exposeWhenExceeds: 12,
      maxEagerTools: 6,
      defaultProfile: "support",
      includeUnprofiled: false,
      profiles: {
        support: {
          include: [
            "profile:support",
            "category:knowledge",
            "category:billing",
            "category:browser",
            "category:utility",
          ],
          exclude: ["group:admin"],
        },
        workspace: {
          include: [
            "profile:workspace",
            "category:workspace",
            "category:browser",
            "category:analytics",
            "category:utility",
          ],
        },
        commerce: {
          include: [
            "profile:commerce",
            "category:commerce",
            "category:billing",
            "group:actions",
          ],
        },
        admin: {
          include: [
            "profile:admin",
            "category:operations",
            "category:analytics",
            "category:utility",
          ],
        },
      },
      toolChoice: "auto",
      parallelCalls: false,
    },
  });
}

export async function POST(request: Request) {
  try {
    return await getRuntime().handleRequest(request);
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

export async function GET() {
  const { providerName, model } = resolveProvider();
  return Response.json({
    status: "ok",
    provider: providerName,
    model,
    toolCount: {
      server: toolScaleServerTools.length,
    },
  });
}
