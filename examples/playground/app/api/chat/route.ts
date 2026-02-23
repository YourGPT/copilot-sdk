import { createRuntime } from "@yourgpt/llm-sdk";
import { createAnthropic } from "@yourgpt/llm-sdk/anthropic";

const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || "",
});

const runtime = createRuntime({
  provider: anthropic,
  model: "claude-sonnet-4-20250514", // Use a model that supports web search
  systemPrompt: `You are a helpful assistant with web search capabilities.
When users ask about current events, news, real-time data, or recent information, search the web to provide accurate and up-to-date answers.
Always cite your sources when using web search results.`,
  // Enable native web search - single API call, citations included!
  webSearch: true,
  debug: true,
});

export async function POST(request: Request) {
  return runtime.handleRequest(request);
}

export async function GET() {
  return Response.json({
    status: "ok",
    provider: "anthropic",
    model: "claude-sonnet-4-20250514",
    webSearch: {
      enabled: true,
      type: "native",
      note: "Using Claude's native web search (single API call)",
    },
  });
}
