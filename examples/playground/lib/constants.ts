import type {
  ThemeConfig,
  ProviderConfig,
  PersonData,
  DashboardState,
  ApiKeys,
  GenerativeUIConfig,
  ToolsEnabledConfig,
  SDKConfig,
  LayoutConfig,
  OpenRouterModelOption,
  AlphaConfig,
} from "./types";

// Theme configurations - hoisted outside component to prevent re-renders
export const themes: ThemeConfig[] = [
  { id: "default", label: "Default", accent: "#6b7280" },
  { id: "claude", label: "Claude", accent: "#f97316" },
  { id: "linear", label: "Linear", accent: "#8b5cf6" },
  { id: "vercel", label: "Vercel", accent: "#171717" },
  { id: "twitter", label: "Twitter", accent: "#0ea5e9" },
  { id: "catppuccin", label: "Catppuccin", accent: "#f472b6" },
  { id: "supabase", label: "Supabase", accent: "#10b981" },
  { id: "modern-minimal", label: "Minimal", accent: "#64748b" },
  { id: "posthog", label: "PostHog", accent: "#eab308" },
];

// Layout template configurations
export const layoutTemplates: LayoutConfig[] = [
  { id: "default", name: "Default", description: "Basic chat interface" },
  {
    id: "saas",
    name: "SaaS Banking",
    description: "Branded home + suggestions",
  },
  {
    id: "support",
    name: "Support Assistant",
    description: "Help articles + actions",
  },
];

// Provider configurations
export const providers: ProviderConfig[] = [
  {
    id: "openai",
    name: "OpenAI",
    model: "gpt-5-mini",
    color: "#10a37f",
    keyPlaceholder: "sk-...",
    keyLink: "https://platform.openai.com/api-keys",
    keyLinkText: "platform.openai.com",
    envVar: "OPENAI_API_KEY",
    createProvider: "createOpenAI",
    importPath: "@yourgpt/llm-sdk/openai",
  },
  {
    id: "anthropic",
    name: "Anthropic",
    model: "claude-haiku-4-5",
    color: "#d97706",
    keyPlaceholder: "sk-ant-...",
    keyLink: "https://console.anthropic.com/settings/keys",
    keyLinkText: "console.anthropic.com",
    envVar: "ANTHROPIC_API_KEY",
    createProvider: "createAnthropic",
    importPath: "@yourgpt/llm-sdk/anthropic",
  },
  {
    id: "google",
    name: "Google",
    model: "gemini-1.5-flash",
    color: "#4285f4",
    keyPlaceholder: "AIza...",
    keyLink: "https://aistudio.google.com/apikey",
    keyLinkText: "aistudio.google.com",
    envVar: "GOOGLE_GENERATIVE_AI_API_KEY",
    createProvider: "createGoogle",
    importPath: "@yourgpt/llm-sdk/google",
  },
  {
    id: "xai",
    name: "xAI",
    model: "grok-3-fast",
    color: "#1d9bf0",
    keyPlaceholder: "xai-...",
    keyLink: "https://console.x.ai/",
    keyLinkText: "console.x.ai",
    envVar: "XAI_API_KEY",
    createProvider: "createXAI",
    importPath: "@yourgpt/llm-sdk/xai",
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    model: "anthropic/claude-3.5-sonnet",
    color: "#6366f1",
    keyPlaceholder: "sk-or-...",
    keyLink: "https://openrouter.ai/keys",
    keyLinkText: "openrouter.ai",
    envVar: "OPENROUTER_API_KEY",
    createProvider: "createOpenRouter",
    importPath: "@yourgpt/llm-sdk/openrouter",
  },
  {
    id: "yourgpt-server",
    name: "YourGPT Server",
    model: "local demo",
    color: "#f59e0b",
    keyPlaceholder: "",
    keyLink: "",
    keyLinkText: "",
    envVar: "",
    createProvider: "",
    importPath: "",
  },
];

// Sample person data for useAIContext demo
export const samplePersons: PersonData[] = [
  {
    id: "user-1",
    name: "Alex Johnson",
    email: "alex@example.com",
    role: "Developer",
    plan: "pro",
    credits: 2500,
    joinedDate: "2024-03-15",
    preferences: { theme: "dark", notifications: true, language: "en" },
  },
  {
    id: "user-2",
    name: "Sarah Chen",
    email: "sarah@company.io",
    role: "Product Manager",
    plan: "enterprise",
    credits: 10000,
    joinedDate: "2023-11-01",
    preferences: { theme: "system", notifications: true, language: "en" },
  },
  {
    id: "user-3",
    name: "Mike Wilson",
    email: "mike@startup.co",
    role: "Founder",
    plan: "free",
    credits: 100,
    joinedDate: "2025-01-10",
    preferences: { theme: "light", notifications: false, language: "es" },
  },
];

// Storage keys
export const API_KEYS_STORAGE_KEY = "copilot-playground-api-keys";
export const PLAYGROUND_CONFIG_STORAGE_KEY = "copilot-playground-config";
export const WELCOME_DISMISSED_KEY = "copilot-playground-welcome-dismissed";

// External URLs
export const GITHUB_REPO_URL =
  "https://github.com/YourGPT/copilot-sdk/tree/main/examples/playground";

// Initial state values
export const INITIAL_DASHBOARD_STATE: DashboardState = {
  counter: 0,
  userPreference: "auto",
  notifications: [],
  cartItems: 0,
};

export const INITIAL_API_KEYS: ApiKeys = {
  openai: "",
  anthropic: "",
  google: "",
  xai: "",
  openrouter: "",
  "yourgpt-server": "",
};

// OpenRouter model options for the model selector (static fallback)
// Source: https://openrouter.ai/api/v1/models (Verified: February 2026)
export const OPENROUTER_MODELS: OpenRouterModelOption[] = [
  // OpenRouter Special
  {
    id: "openrouter/auto",
    name: "Auto (Best for prompt)",
    provider: "OpenRouter",
  },
  // OpenAI
  { id: "openai/gpt-5.2-pro", name: "GPT-5.2 Pro", provider: "OpenAI" },
  { id: "openai/gpt-5.2", name: "GPT-5.2", provider: "OpenAI" },
  { id: "openai/gpt-5.2-chat", name: "GPT-5.2 Chat", provider: "OpenAI" },
  { id: "openai/gpt-5.2-codex", name: "GPT-5.2 Codex", provider: "OpenAI" },
  { id: "openai/gpt-5.1", name: "GPT-5.1", provider: "OpenAI" },
  { id: "openai/gpt-5.1-codex", name: "GPT-5.1 Codex", provider: "OpenAI" },
  // Anthropic
  {
    id: "anthropic/claude-opus-4.6",
    name: "Claude Opus 4.6",
    provider: "Anthropic",
  },
  {
    id: "anthropic/claude-sonnet-4.6",
    name: "Claude Sonnet 4.6",
    provider: "Anthropic",
  },
  {
    id: "anthropic/claude-opus-4.5",
    name: "Claude Opus 4.5",
    provider: "Anthropic",
  },
  // Google Gemini
  {
    id: "google/gemini-3.1-pro-preview",
    name: "Gemini 3.1 Pro Preview",
    provider: "Google",
  },
  {
    id: "google/gemini-3-pro-preview",
    name: "Gemini 3 Pro Preview",
    provider: "Google",
  },
  {
    id: "google/gemini-3-flash-preview",
    name: "Gemini 3 Flash Preview",
    provider: "Google",
  },
  // xAI
  { id: "x-ai/grok-4.1-fast", name: "Grok 4.1 Fast", provider: "xAI" },
  // DeepSeek
  {
    id: "deepseek/deepseek-v3.2",
    name: "DeepSeek V3.2",
    provider: "DeepSeek",
  },
  {
    id: "deepseek/deepseek-v3.2-speciale",
    name: "DeepSeek V3.2 Speciale",
    provider: "DeepSeek",
  },
  // Mistral
  {
    id: "mistralai/mistral-large-2512",
    name: "Mistral Large 3",
    provider: "Mistral",
  },
  {
    id: "mistralai/devstral-2512",
    name: "Devstral 2",
    provider: "Mistral",
  },
];

export const INITIAL_GENERATIVE_UI: GenerativeUIConfig = {
  weather: true,
  stock: true,
  notification: true,
};

export const INITIAL_TOOLS_ENABLED: ToolsEnabledConfig = {
  updateCounter: true,
  updatePreference: true,
  updateCart: true,
  captureScreenshot: true,
  getConsoleLogs: true,
};

export const INITIAL_SDK_CONFIG: SDKConfig = {
  streaming: true,
  showHeader: true,
  showFollowUps: true,
  showUserAvatar: false,
  loaderVariant: "typing",
  fontSize: "sm",
  debug: false,
};

export const INITIAL_ALPHA_CONFIG: AlphaConfig = {
  messageActions: {
    copyEnabled: true,
    editEnabled: true,
    feedbackEnabled: false,
  },
  branchingEnabled: false,
  brandVoiceSkill: false,
  codeReviewSkill: false,
  compactionStrategy: "none",
  sessionPersistence: false,
  contextStats: false,
  hiddenAnalytics: false,
  deferredSearch: false,
  customMessageView: false,
};

// Loader variant options for the UI selector
export const LOADER_VARIANTS = [
  { id: "typing", label: "Typing", description: "Typing indicator" },
  { id: "dots", label: "Dots", description: "Bouncing dots" },
  { id: "wave", label: "Wave", description: "Wave animation" },
  { id: "terminal", label: "Terminal", description: "Terminal cursor" },
  { id: "text-blink", label: "Text Blink", description: "Blinking text" },
  { id: "text-shimmer", label: "Text Shimmer", description: "Shimmer text" },
  { id: "loading-dots", label: "Loading Dots", description: "Thinking..." },
] as const;

// System prompt shared between routes and playground
export const SYSTEM_PROMPT = `You are a helpful SDK demo assistant. You have access to tools that can interact with the dashboard.

Be concise and helpful. When asked to perform actions or get information, use the appropriate tools.`;

// Default system prompt for the UI
export const DEFAULT_SYSTEM_PROMPT =
  "You are a helpful SDK demo assistant. Use available tools to interact with the dashboard. Be concise.";
