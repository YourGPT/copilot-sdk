import { createGoogle, createRuntime } from "@yourgpt/llm-sdk";

const google = createGoogle({
  apiKey: process.env.GOOGLE_API_KEY,
});

const runtime = createRuntime({
  provider: google,
  model: "gemini-3-flash-preview",
  systemPrompt:
    "You are a helpful assistant powered by Google Gemini 2.0 Flash. Be concise and helpful.",
});

export async function POST(request: Request) {
  return runtime.handleRequest(request);
}

export async function GET() {
  return Response.json({ status: "ok", provider: "google" });
}
