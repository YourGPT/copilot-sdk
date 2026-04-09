import "dotenv/config";
import { generateText } from "@yourgpt/llm-sdk";
import { togetherai } from "@yourgpt/llm-sdk/togetherai";

const API_KEY = process.env.TOGETHER_API_KEY!;
const PROMPT = "Say hello in one sentence.";

const models = [
  // GPT-style
  "openai/gpt-oss-120b",
  // Claude-style (if available)
  "anthropic/claude-3.5-sonnet",
  "anthropic/claude-3-haiku",
  // DeepSeek
  "deepseek-ai/DeepSeek-V3",
  "deepseek-ai/DeepSeek-V3.1",
  "deepseek-ai/DeepSeek-R1",
  // Qwen
  "Qwen/Qwen3.5-397B-A17B",
  "Qwen/Qwen3.5-9B",
  "Qwen/Qwen2.5-72B-Instruct-Turbo",
  // Llama
  "meta-llama/Llama-3.3-70B-Instruct-Turbo",
  "meta-llama/Meta-Llama-3.1-405B-Instruct-Turbo",
  // Kimi
  "moonshotai/Kimi-K2.5",
  // GLM
  "zai-org/GLM-5.1",
  // Gemma
  "google/gemma-4-31B-it",
  // MiniMax
  "MiniMaxAI/MiniMax-M2.5",
  // Mistral
  "mistralai/Mistral-Small-24B-Instruct-2501",
  "mistralai/Mixtral-8x22B-Instruct-v0.1",
];

async function main() {
  console.log("Testing Together AI models...\n");

  const results: { model: string; status: string; text?: string }[] = [];

  for (const modelId of models) {
    const short = modelId.length > 50 ? modelId.slice(0, 47) + "..." : modelId;
    process.stdout.write(`  ${short.padEnd(52)} `);
    try {
      const result = await generateText({
        model: togetherai(modelId, { apiKey: API_KEY }),
        prompt: PROMPT,
        maxTokens: 50,
      });
      const text = result.text.trim().slice(0, 70);
      console.log(`✅  "${text}"`);
      results.push({ model: modelId, status: "ok", text });
    } catch (err: any) {
      const msg = err?.message?.slice(0, 80) ?? "Unknown error";
      console.log(`❌  ${msg}`);
      results.push({ model: modelId, status: "fail" });
    }
  }

  const ok = results.filter((r) => r.status === "ok");
  const fail = results.filter((r) => r.status === "fail");
  console.log(`\n✅ Available: ${ok.length}  ❌ Unavailable: ${fail.length}`);
  if (fail.length > 0) {
    console.log(`Unavailable: ${fail.map((f) => f.model).join(", ")}`);
  }
}

main();
