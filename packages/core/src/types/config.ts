/**
 * Supported LLM providers
 */
export type LLMProvider =
  | "openai"
  | "anthropic"
  | "google"
  | "groq"
  | "ollama"
  | "custom";

/**
 * LLM configuration
 */
export interface LLMConfig {
  /** LLM provider */
  provider: LLMProvider;
  /** Model name (e.g., 'gpt-4o', 'claude-3-5-sonnet-latest') */
  model?: string;
  /** API key for the provider */
  apiKey?: string;
  /** Base URL for custom/self-hosted models */
  baseUrl?: string;
  /** Temperature (0-2) */
  temperature?: number;
  /** Maximum tokens in response */
  maxTokens?: number;
  /** Top P sampling */
  topP?: number;
  /** Frequency penalty */
  frequencyPenalty?: number;
  /** Presence penalty */
  presencePenalty?: number;
  /** Enable streaming responses (default: true) */
  streaming?: boolean;
}

/**
 * Cloud configuration (for managed hosting)
 */
export interface CloudConfig {
  /** API key */
  apiKey: string;
  /** Bot ID */
  botId: string;
  /** Custom API endpoint (optional) */
  endpoint?: string;
}

/**
 * Extension configuration
 */
export interface Extension {
  /** Extension name */
  name: string;
  /** Extension configuration */
  config: Record<string, unknown>;
  /** Initialize the extension */
  init?: () => Promise<void>;
}

/**
 * Main SDK configuration
 */
export interface CopilotConfig {
  /** LLM configuration (for self-hosted) */
  config?: LLMConfig;
  /** Cloud configuration (for managed hosting) */
  cloud?: CloudConfig;
  /** Runtime URL for self-hosted backend */
  runtimeUrl?: string;
  /** System prompt */
  systemPrompt?: string;
  /** Extensions (like knowledge base) */
  extensions?: Extension[];
  /** Enable debug logging */
  debug?: boolean;
}

/**
 * Default LLM configurations per provider
 */
export const DEFAULT_MODELS: Record<LLMProvider, string> = {
  openai: "gpt-4o",
  anthropic: "claude-3-5-sonnet-latest",
  google: "gemini-pro",
  groq: "llama-3.1-70b-versatile",
  ollama: "llama3",
  custom: "default",
};

/**
 * Get default model for a provider
 */
export function getDefaultModel(provider: LLMProvider): string {
  return DEFAULT_MODELS[provider] || "default";
}
