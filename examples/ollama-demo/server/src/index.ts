/**
 * Ollama Demo - Local LLM Provider
 *
 * This example demonstrates:
 * 1. Basic chat completion with streaming
 * 2. Tool/function calling
 * 3. Vision support (with LLaVA)
 * 4. Ollama-specific options
 *
 * Prerequisites:
 * - Ollama installed and running (ollama serve)
 * - Models pulled: ollama pull llama3.1, ollama pull llava
 */

import "dotenv/config";
import { createOllama } from "@yourgpt/llm-sdk/ollama";
import type { OllamaModelOptions } from "@yourgpt/llm-sdk/ollama";

// ============================================
// SETUP
// ============================================

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "llama3.1";
const OLLAMA_VISION_MODEL = process.env.OLLAMA_VISION_MODEL || "llava";

// Create Ollama provider
const ollama = createOllama({
  baseUrl: OLLAMA_BASE_URL,
});

console.log(`Ollama Demo - Connecting to ${OLLAMA_BASE_URL}`);
console.log(`Using model: ${OLLAMA_MODEL} (vision: ${OLLAMA_VISION_MODEL})\n`);

// ============================================
// 1. BASIC CHAT COMPLETION
// ============================================

async function demoBasicChat() {
  console.log("=".repeat(50));
  console.log("1. BASIC CHAT COMPLETION");
  console.log("=".repeat(50));

  const model = ollama(OLLAMA_MODEL);

  console.log("\nUser: What is the capital of France? Answer briefly.\n");
  console.log("Assistant: ");

  for await (const event of model.stream({
    messages: [
      {
        id: "1",
        role: "user",
        content: "What is the capital of France? Answer briefly.",
      },
    ],
    systemPrompt: "You are a helpful assistant. Keep responses concise.",
  })) {
    if (event.type === "message:delta") {
      process.stdout.write(event.content);
    }
    if (event.type === "error") {
      console.error("\nError:", event.message);
    }
  }

  console.log("\n");
}

// ============================================
// 2. TOOL/FUNCTION CALLING
// ============================================

async function demoToolCalling() {
  console.log("=".repeat(50));
  console.log("2. TOOL/FUNCTION CALLING");
  console.log("=".repeat(50));

  const model = ollama(OLLAMA_MODEL);

  console.log("\nUser: What's the weather like in Paris and Tokyo?\n");

  // Track tool calls
  const toolCalls: Array<{ id: string; name: string; args: string }> = [];

  for await (const event of model.stream({
    messages: [
      {
        id: "1",
        role: "user",
        content: "What's the weather like in Paris and Tokyo?",
      },
    ],
    systemPrompt:
      "You are a helpful assistant. Use the get_weather tool to check weather.",
    actions: [
      {
        name: "get_weather",
        description: "Get the current weather for a location",
        parameters: {
          location: {
            type: "string",
            description: "The city name",
            required: true,
          },
          unit: {
            type: "string",
            description: "Temperature unit (celsius or fahrenheit)",
            enum: ["celsius", "fahrenheit"],
          },
        },
        handler: async (params) => {
          // Simulate weather API
          const weather: Record<string, { temp: number; condition: string }> = {
            paris: { temp: 18, condition: "partly cloudy" },
            tokyo: { temp: 24, condition: "sunny" },
          };
          const location = params.location as string;
          const city = location.toLowerCase();
          return weather[city] || { temp: 20, condition: "unknown" };
        },
      },
    ],
  })) {
    switch (event.type) {
      case "message:delta":
        process.stdout.write(event.content);
        break;
      case "action:start":
        console.log(`\n[Tool Call] ${event.name} (id: ${event.id})`);
        toolCalls.push({ id: event.id, name: event.name, args: "" });
        break;
      case "action:args":
        const call = toolCalls.find((c) => c.id === event.id);
        if (call) {
          call.args = event.args;
          console.log(`[Tool Args] ${event.args}`);
        }
        break;
      case "error":
        console.error("\nError:", event.message);
        break;
    }
  }

  if (toolCalls.length > 0) {
    console.log("\n\nTool calls received:");
    toolCalls.forEach((tc) => {
      console.log(`  - ${tc.name}: ${tc.args}`);
    });
  }

  console.log("\n");
}

// ============================================
// 3. VISION SUPPORT
// ============================================

async function demoVision() {
  console.log("=".repeat(50));
  console.log("3. VISION SUPPORT (requires llava model)");
  console.log("=".repeat(50));

  // Use LLaVA for vision
  const model = ollama(OLLAMA_VISION_MODEL);

  // Simple test image - 1x1 red pixel PNG (base64)
  const testImageBase64 =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==";

  console.log("\nUser: [Sending a test image] What color is this image?\n");
  console.log("Assistant: ");

  for await (const event of model.stream({
    messages: [
      {
        id: "1",
        role: "user",
        content: "What color is this image? Describe what you see.",
        metadata: {
          attachments: [
            {
              type: "image",
              data: testImageBase64,
              mimeType: "image/png",
            },
          ],
        },
      },
    ],
  })) {
    if (event.type === "message:delta") {
      process.stdout.write(event.content);
    }
    if (event.type === "error") {
      console.error("\nError:", event.message);
      console.log(
        `\nNote: Vision requires a vision model. Pull it with: ollama pull ${OLLAMA_VISION_MODEL}`,
      );
    }
  }

  console.log("\n");
}

// ============================================
// 4. OLLAMA-SPECIFIC OPTIONS
// ============================================

async function demoOllamaOptions() {
  console.log("=".repeat(50));
  console.log("4. OLLAMA-SPECIFIC OPTIONS");
  console.log("=".repeat(50));

  // Create provider with custom options
  const ollamaWithOptions = createOllama({
    baseUrl: OLLAMA_BASE_URL,
    options: {
      num_ctx: 4096, // Context window size
      temperature: 0.7,
      top_p: 0.9,
      repeat_penalty: 1.1,
      seed: 42, // For reproducibility
    },
  });

  const model = ollamaWithOptions(OLLAMA_MODEL);

  console.log("\nUsing custom Ollama options:");
  console.log("  - num_ctx: 4096");
  console.log("  - temperature: 0.7");
  console.log("  - top_p: 0.9");
  console.log("  - repeat_penalty: 1.1");
  console.log("  - seed: 42 (for reproducibility)");

  console.log("\nUser: Generate a creative one-sentence story.\n");
  console.log("Assistant: ");

  for await (const event of model.stream({
    messages: [
      {
        id: "1",
        role: "user",
        content: "Generate a creative one-sentence story about a robot.",
      },
    ],
  })) {
    if (event.type === "message:delta") {
      process.stdout.write(event.content);
    }
    if (event.type === "error") {
      console.error("\nError:", event.message);
    }
  }

  console.log("\n");
}

// ============================================
// 5. CHECK CAPABILITIES
// ============================================

async function demoCapabilities() {
  console.log("=".repeat(50));
  console.log("5. MODEL CAPABILITIES");
  console.log("=".repeat(50));

  const models = ["llama3.1", "llava", "codellama", "mistral"];

  console.log("\nModel capabilities:\n");

  for (const modelId of models) {
    const caps = ollama.getCapabilities(modelId);
    console.log(`${modelId}:`);
    console.log(`  - Vision: ${caps.supportsVision ? "Yes" : "No"}`);
    console.log(`  - Tools: ${caps.supportsTools ? "Yes" : "No"}`);
    console.log(`  - Max Tokens: ${caps.maxTokens}`);
    console.log();
  }
}

// ============================================
// MAIN
// ============================================

async function main() {
  const arg = process.argv[2];

  try {
    switch (arg) {
      case "chat":
        await demoBasicChat();
        break;
      case "tools":
        await demoToolCalling();
        break;
      case "vision":
        await demoVision();
        break;
      case "options":
        await demoOllamaOptions();
        break;
      case "caps":
        await demoCapabilities();
        break;
      default:
        // Run all demos
        await demoCapabilities();
        await demoBasicChat();
        await demoToolCalling();
        await demoOllamaOptions();
        console.log("=".repeat(50));
        console.log("Vision demo skipped (run with: pnpm vision)");
        console.log("=".repeat(50));
    }
  } catch (error) {
    if (error instanceof Error) {
      if (
        error.message.includes("ECONNREFUSED") ||
        error.message.includes("fetch failed")
      ) {
        console.error("\nError: Cannot connect to Ollama.");
        console.error("Make sure Ollama is running: ollama serve");
      } else {
        console.error("\nError:", error.message);
      }
    }
  }
}

main();
