/**
 * Test route with SERVER-SIDE tools and low maxIterations
 * Used to test server-side max iterations handling
 */
import { createRuntime, type ToolDefinition } from "@yourgpt/llm-sdk";
import { createOpenAI } from "@yourgpt/llm-sdk/openai";

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Server-side tool for testing
const serverTools: ToolDefinition[] = [
  {
    name: "get_random_number",
    description:
      "Get a random number. Call this multiple times to get different numbers.",
    location: "server",
    inputSchema: {
      type: "object",
      properties: {
        min: { type: "number", description: "Minimum value" },
        max: { type: "number", description: "Maximum value" },
      },
      required: ["min", "max"],
    },
    handler: async (params) => {
      const args = params as { min: number; max: number };
      const num =
        Math.floor(Math.random() * (args.max - args.min + 1)) + args.min;
      console.log(
        `[Server Tool] get_random_number(${args.min}, ${args.max}) = ${num}`,
      );
      return { success: true, number: num };
    },
  },
];

const runtime = createRuntime({
  provider: openai,
  model: "gpt-5.2",
  systemPrompt:
    "You are a helpful assistant. Use the get_random_number tool when asked for random numbers.",
  debug: true,
  tools: serverTools,
  maxIterations: 2, // Low limit for testing
});

export async function POST(request: Request) {
  console.log("[Test Server Tools] Received request");
  try {
    const response = await runtime.handleRequest(request);
    console.log("[Test Server Tools] Response status:", response.status);
    return response;
  } catch (error) {
    console.error("[Test Server Tools] Error:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}

export async function GET() {
  return Response.json({
    status: "ok",
    description: "Test route with server-side tools, maxIterations=2",
  });
}
