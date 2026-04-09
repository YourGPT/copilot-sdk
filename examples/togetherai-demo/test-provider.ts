/**
 * Together AI Provider — Comprehensive Test Suite
 *
 * Tests all major use cases:
 *   1. generateText (non-streaming)
 *   2. streamText (streaming)
 *   3. Tool calling (single tool)
 *   4. Multi-tool execution
 *   5. Multi-step agentic loop (tool → follow-up)
 *   6. System prompt + conversation history
 *   7. JSON mode / structured output
 *   8. Abort signal handling
 *   9. Multiple models
 *
 * Run:  npx tsx test-provider.ts
 */

import "dotenv/config";
import { generateText, streamText, tool } from "@yourgpt/llm-sdk";
import { togetherai } from "@yourgpt/llm-sdk/togetherai";
import { z } from "zod";

// ── Config ────────────────────────────────────────────────────────────────────

const API_KEY = process.env.TOGETHER_API_KEY;
if (!API_KEY) {
  console.error("❌ Set TOGETHER_API_KEY in .env");
  process.exit(1);
}

// Default model for most tests (fast, tool-capable)
const DEFAULT_MODEL = "meta-llama/Llama-3.3-70B-Instruct-Turbo";

const passed: string[] = [];
const failed: string[] = [];

async function runTest(name: string, fn: () => Promise<void>) {
  process.stdout.write(`\n━━━ ${name} `);
  process.stdout.write("━".repeat(Math.max(0, 60 - name.length)) + "\n");
  try {
    await fn();
    passed.push(name);
    console.log(`✅ PASSED`);
  } catch (err: any) {
    failed.push(name);
    console.error(`❌ FAILED:`, err?.message ?? err);
  }
}

// ── Shared Tools ──────────────────────────────────────────────────────────────

const weatherTool = tool({
  description: "Get current weather for a city",
  parameters: z.object({
    city: z.string().describe("City name"),
  }),
  execute: async ({ city }) => {
    // Simulated weather data
    const data: Record<string, { temp: number; condition: string }> = {
      tokyo: { temp: 22, condition: "cloudy" },
      miami: { temp: 32, condition: "sunny" },
      london: { temp: 14, condition: "rainy" },
      paris: { temp: 18, condition: "partly cloudy" },
    };
    const result = data[city.toLowerCase()] ?? {
      temp: 20,
      condition: "unknown",
    };
    console.log(`  [tool] getWeather("${city}") → ${JSON.stringify(result)}`);
    return result;
  },
});

const calculatorTool = tool({
  description: "Perform a math calculation",
  parameters: z.object({
    expression: z.string().describe("Math expression to evaluate, e.g. 2+2"),
  }),
  execute: async ({ expression }) => {
    // Safe eval for simple math
    const result = Function(`"use strict"; return (${expression})`)();
    console.log(`  [tool] calculator("${expression}") → ${result}`);
    return { expression, result };
  },
});

const searchTool = tool({
  description: "Search for information on a topic",
  parameters: z.object({
    query: z.string().describe("Search query"),
    maxResults: z.number().optional().describe("Max results to return"),
  }),
  execute: async ({ query, maxResults }) => {
    const results = [
      { title: `Result 1 for "${query}"`, snippet: "Lorem ipsum..." },
      { title: `Result 2 for "${query}"`, snippet: "Dolor sit amet..." },
    ].slice(0, maxResults ?? 2);
    console.log(`  [tool] search("${query}") → ${results.length} results`);
    return results;
  },
});

// ── Tests ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🔬 Together AI Provider — Comprehensive Tests");
  console.log(`   Model: ${DEFAULT_MODEL}`);
  console.log(`   API Key: ${API_KEY!.slice(0, 12)}...${API_KEY!.slice(-4)}`);

  // ──────────────────────────────────────────────────────────────────────────
  // 1. generateText — basic non-streaming
  // ──────────────────────────────────────────────────────────────────────────
  await runTest("1. generateText (non-streaming)", async () => {
    const result = await generateText({
      model: togetherai(DEFAULT_MODEL, { apiKey: API_KEY }),
      prompt: "What is 2 + 2? Reply with just the number.",
    });

    console.log(`  Text: "${result.text.trim()}"`);
    console.log(`  Finish: ${result.finishReason}`);
    console.log(
      `  Usage: ${result.usage.promptTokens}p / ${result.usage.completionTokens}c / ${result.usage.totalTokens}t`,
    );

    if (!result.text) throw new Error("Empty response");
    if (result.finishReason !== "stop")
      throw new Error(`Unexpected finish: ${result.finishReason}`);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 2. streamText — streaming response
  // ──────────────────────────────────────────────────────────────────────────
  await runTest("2. streamText (streaming)", async () => {
    const result = await streamText({
      model: togetherai(DEFAULT_MODEL, { apiKey: API_KEY }),
      prompt: "Count from 1 to 5, one number per line.",
    });

    process.stdout.write("  Stream: ");
    let chunks = 0;
    for await (const chunk of result.textStream) {
      process.stdout.write(chunk);
      chunks++;
    }
    console.log();

    const text = await result.text;
    console.log(`  Chunks received: ${chunks}`);
    console.log(`  Full text length: ${text.length}`);

    if (chunks < 2) throw new Error("Too few chunks — streaming may not work");
    if (!text) throw new Error("Empty streamed text");
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 3. generateText with single tool
  // ──────────────────────────────────────────────────────────────────────────
  await runTest("3. generateText + single tool", async () => {
    const result = await generateText({
      model: togetherai(DEFAULT_MODEL, { apiKey: API_KEY }),
      prompt: "What is the weather in Tokyo?",
      tools: { getWeather: weatherTool },
      maxSteps: 3,
    });

    console.log(`  Text: "${result.text.slice(0, 120)}..."`);
    console.log(`  Tool calls: ${result.toolCalls.length}`);
    console.log(`  Tool results: ${result.toolResults.length}`);
    console.log(`  Steps: ${result.steps.length}`);

    if (result.toolCalls.length === 0) throw new Error("No tool calls made");
    if (result.toolResults.length === 0) throw new Error("No tool results");
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 4. generateText with multiple tools
  // ──────────────────────────────────────────────────────────────────────────
  await runTest("4. generateText + multiple tools", async () => {
    const result = await generateText({
      model: togetherai(DEFAULT_MODEL, { apiKey: API_KEY }),
      prompt: "What is the weather in Miami? Also calculate 15 * 37 for me.",
      tools: {
        getWeather: weatherTool,
        calculator: calculatorTool,
      },
      maxSteps: 5,
    });

    console.log(`  Text: "${result.text.slice(0, 150)}..."`);
    console.log(`  Tool calls: ${result.toolCalls.length}`);

    const toolNames = result.toolCalls.map((tc) => tc.name);
    console.log(`  Tools used: ${toolNames.join(", ")}`);
    console.log(`  Steps: ${result.steps.length}`);

    if (result.toolCalls.length === 0) throw new Error("No tool calls made");
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 5. streamText with tools (agentic streaming)
  // ──────────────────────────────────────────────────────────────────────────
  await runTest("5. streamText + tool calling", async () => {
    const result = await streamText({
      model: togetherai(DEFAULT_MODEL, { apiKey: API_KEY }),
      prompt: "What's the weather like in London right now?",
      tools: { getWeather: weatherTool },
      maxSteps: 3,
    });

    process.stdout.write("  Stream: ");
    for await (const chunk of result.textStream) {
      process.stdout.write(chunk);
    }
    console.log();

    const text = await result.text;
    console.log(`  Final text length: ${text.length}`);

    if (!text) throw new Error("Empty streamed text after tool use");
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 6. System prompt + conversation history
  // ──────────────────────────────────────────────────────────────────────────
  await runTest("6. System prompt + multi-turn", async () => {
    const result = await generateText({
      model: togetherai(DEFAULT_MODEL, { apiKey: API_KEY }),
      system:
        "You are a pirate. Always respond in pirate speak. Keep it under 30 words.",
      messages: [
        { role: "user", content: "Hello, who are you?" },
        {
          role: "assistant",
          content: "Ahoy matey! I be a salty sea dog, sailing the seven seas!",
        },
        { role: "user", content: "Where is your treasure?" },
      ],
    });

    console.log(`  Text: "${result.text.trim()}"`);

    if (!result.text) throw new Error("Empty response");
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 7. JSON mode (structured output)
  // ──────────────────────────────────────────────────────────────────────────
  await runTest("7. JSON mode", async () => {
    const result = await generateText({
      model: togetherai(DEFAULT_MODEL, { apiKey: API_KEY }),
      prompt:
        'Return a JSON object with keys "name", "age", and "city" for a fictional character. Respond with only valid JSON, no markdown.',
    });

    console.log(`  Raw: "${result.text.trim().slice(0, 200)}"`);

    // Try to parse it
    const parsed = JSON.parse(result.text.trim());
    console.log(`  Parsed: ${JSON.stringify(parsed)}`);

    if (!parsed.name || !parsed.age || !parsed.city) {
      throw new Error("Missing expected JSON keys");
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 8. Abort signal
  // ──────────────────────────────────────────────────────────────────────────
  await runTest("8. Abort signal", async () => {
    const controller = new AbortController();

    // Abort after 500ms
    setTimeout(() => controller.abort(), 500);

    try {
      const result = await streamText({
        model: togetherai(DEFAULT_MODEL, { apiKey: API_KEY }),
        prompt: "Write a very long essay about the history of computing.",
        signal: controller.signal,
      });

      let chars = 0;
      for await (const chunk of result.textStream) {
        chars += chunk.length;
      }

      // If we get here without error, the stream completed before abort
      console.log(`  Stream completed before abort (${chars} chars)`);
    } catch (err: any) {
      if (
        err.message?.includes("abort") ||
        err.message?.includes("Abort") ||
        err.name === "AbortError"
      ) {
        console.log("  Abort caught correctly");
      } else {
        throw err;
      }
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 9. Multiple models
  // ──────────────────────────────────────────────────────────────────────────
  await runTest("9. Multiple models", async () => {
    const models = [
      "meta-llama/Llama-3.3-70B-Instruct-Turbo",
      "deepseek-ai/DeepSeek-V3",
    ];

    for (const modelId of models) {
      const result = await generateText({
        model: togetherai(modelId, { apiKey: API_KEY }),
        prompt: "Say hello in one sentence.",
      });

      console.log(
        `  ${modelId.split("/").pop()}: "${result.text.trim().slice(0, 80)}"`,
      );

      if (!result.text) throw new Error(`Empty response from ${modelId}`);
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 10. Long context / large prompt
  // ──────────────────────────────────────────────────────────────────────────
  await runTest("10. Token usage tracking", async () => {
    const result = await generateText({
      model: togetherai(DEFAULT_MODEL, { apiKey: API_KEY }),
      prompt: "Write exactly three sentences about the ocean.",
      maxTokens: 150,
    });

    console.log(`  Text: "${result.text.trim().slice(0, 120)}..."`);
    console.log(
      `  Usage: prompt=${result.usage.promptTokens} completion=${result.usage.completionTokens} total=${result.usage.totalTokens}`,
    );

    if (result.usage.promptTokens === 0) throw new Error("promptTokens is 0");
    if (result.usage.completionTokens === 0)
      throw new Error("completionTokens is 0");
  });

  // ── Summary ─────────────────────────────────────────────────────────────
  console.log("\n" + "═".repeat(64));
  console.log(`  ✅ Passed: ${passed.length}  ❌ Failed: ${failed.length}`);
  if (failed.length > 0) {
    console.log(`  Failed tests: ${failed.join(", ")}`);
  }
  console.log("═".repeat(64) + "\n");

  process.exit(failed.length > 0 ? 1 : 0);
}

main();
