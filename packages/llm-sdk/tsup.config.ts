import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    // Main entry
    index: "src/index.ts",

    // Provider subpaths
    "providers/openai/index": "src/providers/openai/index.ts",
    "providers/anthropic/index": "src/providers/anthropic/index.ts",
    "providers/google/index": "src/providers/google/index.ts",
    "providers/ollama/index": "src/providers/ollama/index.ts",
    "providers/xai/index": "src/providers/xai/index.ts",
    "providers/azure/index": "src/providers/azure/index.ts",
    "providers/openrouter/index": "src/providers/openrouter/index.ts",
    "providers/fireworks/index": "src/providers/fireworks/index.ts",

    // Legacy adapters
    "adapters/index": "src/adapters/index.ts",

    // YourGPT storage adapter
    "yourgpt/index": "src/yourgpt/index.ts",

    // Fallback chain & routing
    "fallback/index": "src/fallback/index.ts",
  },
  format: ["cjs", "esm"],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  treeshake: true,
  external: ["openai", "@anthropic-ai/sdk", "@google/generative-ai"],
});
