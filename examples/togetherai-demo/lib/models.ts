/**
 * Together AI Model Definitions
 *
 * Models verified from Together AI API (April 2026)
 * @see https://api.together.xyz/models
 */

export interface ModelOption {
  id: string;
  name: string;
  provider: string;
  contextWindow: number;
}

export interface ModelGroup {
  provider: string;
  models: ModelOption[];
}

export const MODEL_GROUPS: ModelGroup[] = [
  {
    provider: "DeepSeek",
    models: [
      {
        id: "deepseek-ai/DeepSeek-V3.1",
        name: "DeepSeek V3.1",
        provider: "DeepSeek",
        contextWindow: 128000,
      },
      {
        id: "deepseek-ai/DeepSeek-V3",
        name: "DeepSeek V3",
        provider: "DeepSeek",
        contextWindow: 128000,
      },
      {
        id: "deepseek-ai/DeepSeek-R1",
        name: "DeepSeek R1",
        provider: "DeepSeek",
        contextWindow: 128000,
      },
    ],
  },
  {
    provider: "Meta (Llama)",
    models: [
      {
        id: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
        name: "Llama 3.3 70B Turbo",
        provider: "Meta",
        contextWindow: 131072,
      },
    ],
  },
  {
    provider: "Qwen",
    models: [
      {
        id: "Qwen/Qwen3.5-397B-A17B",
        name: "Qwen 3.5 397B",
        provider: "Qwen",
        contextWindow: 262144,
      },
      {
        id: "Qwen/Qwen3.5-9B",
        name: "Qwen 3.5 9B",
        provider: "Qwen",
        contextWindow: 131072,
      },
    ],
  },
  {
    provider: "Other",
    models: [
      {
        id: "openai/gpt-oss-120b",
        name: "GPT OSS 120B",
        provider: "OpenAI",
        contextWindow: 131072,
      },
      {
        id: "moonshotai/Kimi-K2.5",
        name: "Kimi K2.5",
        provider: "Moonshot",
        contextWindow: 262144,
      },
      {
        id: "zai-org/GLM-5.1",
        name: "GLM-5.1",
        provider: "ZAI",
        contextWindow: 202000,
      },
      {
        id: "google/gemma-4-31B-it",
        name: "Gemma 4 31B",
        provider: "Google",
        contextWindow: 131072,
      },
      {
        id: "MiniMaxAI/MiniMax-M2.5",
        name: "MiniMax M2.5",
        provider: "MiniMax",
        contextWindow: 131072,
      },
    ],
  },
];

// Flatten all models
export const ALL_MODELS: ModelOption[] = MODEL_GROUPS.flatMap((g) => g.models);

// Default model
export const DEFAULT_MODEL = "meta-llama/Llama-3.3-70B-Instruct-Turbo";
