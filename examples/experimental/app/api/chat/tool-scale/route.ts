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

const { providerName, provider, model } = resolveProvider();

const runtime = createRuntime({
  provider,
  model,
  debug: process.env.NODE_ENV === "development",
  systemPrompt: `You are the Tool Scale Lab assistant.

You are testing a project with 100 tools: 30 server-side and 70 client-side.
Use tools sparingly and intentionally.

When tools are missing, rely on the search_tools meta-tool to discover deferred tools rather than guessing.
Keep answers short and explain which class of tools you used when it helps the user understand tool selection behavior.`,
  tools: toolScaleServerTools,
  agentLoop: {
    enabled: true,
    maxIterations: 6,
    debug: process.env.NODE_ENV === "development",
    toolSelection: {
      enabled: true,
      defaultProfile: "support",
      includeUnprofiled: false,
      search: {
        enabled: true,
        maxResults: 6,
        minScore: 0.15,
        exposeWhenToolCountExceeds: 12,
        metaToolName: "search_tools",
        strictDeferredLoading: true,
      },
      dynamicSelection: {
        enabled: true,
        maxTools: 6,
      },
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
      nativeProviderHints: {
        anthropic: {
          toolChoice: "auto",
          disableParallelToolUse: true,
        },
        openai: {
          toolChoice: "auto",
          parallelToolCalls: false,
        },
      },
    },
  },
});

export async function POST(request: Request) {
  try {
    return await runtime.handleRequest(request);
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
  return Response.json({
    status: "ok",
    provider: providerName,
    model,
    toolCount: {
      server: toolScaleServerTools.length,
    },
  });
}
