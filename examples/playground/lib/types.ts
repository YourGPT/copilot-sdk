// TypeScript interfaces for the Playground

export type CopilotTheme =
  | "default"
  | "claude"
  | "linear"
  | "vercel"
  | "twitter"
  | "catppuccin"
  | "supabase"
  | "modern-minimal"
  | "posthog";

export interface ThemeConfig {
  id: CopilotTheme;
  label: string;
  accent: string;
}

export interface ToolState {
  loading: boolean;
  lastResult?: { success: boolean; message: string };
}

export interface DashboardState {
  counter: number;
  userPreference: string;
  notifications: string[];
  cartItems: number;
}

export interface ApiKeys {
  openai: string;
  anthropic: string;
  google: string;
  xai: string;
  openrouter: string;
}

export type ProviderId =
  | "openai"
  | "anthropic"
  | "google"
  | "xai"
  | "openrouter";

export interface ProviderConfig {
  id: ProviderId;
  name: string;
  model: string;
  color: string;
  keyPlaceholder: string;
  keyLink: string;
  keyLinkText: string;
  envVar: string;
  createProvider: string;
  importPath: string;
}

export interface OpenRouterModelOption {
  id: string;
  name: string;
  provider: string;
}

export interface PersonData {
  id: string;
  name: string;
  email: string;
  role: string;
  plan: "free" | "pro" | "enterprise";
  credits: number;
  joinedDate: string;
  preferences: {
    theme: string;
    notifications: boolean;
    language: string;
  };
}

export interface GenerativeUIConfig {
  weather: boolean;
  stock: boolean;
  notification: boolean;
}

export interface ToolsEnabledConfig {
  updateCounter: boolean;
  updatePreference: boolean;
  updateCart: boolean;
  captureScreenshot: boolean;
  getConsoleLogs: boolean;
}

export type GenerativeUIKey = keyof GenerativeUIConfig;
export type ToolKey = keyof ToolsEnabledConfig;

// SDK Configuration
export type LoaderVariant =
  | "dots"
  | "typing"
  | "wave"
  | "terminal"
  | "text-blink"
  | "text-shimmer"
  | "loading-dots";
export type FontSize = "sm" | "base" | "lg";

// Layout templates
export type LayoutTemplate = "default" | "saas" | "support";

export interface LayoutConfig {
  id: LayoutTemplate;
  name: string;
  description: string;
}

export interface SDKConfig {
  streaming: boolean;
  showHeader: boolean;
  showFollowUps: boolean;
  showUserAvatar: boolean;
  loaderVariant: LoaderVariant;
  fontSize: FontSize;
  debug: boolean;
}

export interface ToolMetadata {
  name: ToolKey;
  displayName: string;
  description: string;
  suggestedQuery: string;
  codeSnippet: string;
}

export interface MessageActionsConfig {
  copyEnabled: boolean;
  editEnabled: boolean;
  feedbackEnabled: boolean;
}

export type CompactionStrategy = "none" | "sliding-window" | "selective-prune";

export interface AlphaConfig {
  // Message actions
  messageActions: MessageActionsConfig;
  // Branching
  branchingEnabled: boolean;
  // Skills
  brandVoiceSkill: boolean;
  codeReviewSkill: boolean;
  // Context management
  compactionStrategy: CompactionStrategy;
  sessionPersistence: boolean;
  contextStats: boolean;
  // Threads
  concurrentThreads: boolean;
  // YourGPT session auth (replaces onCreateSession callback on the provider)
  yourgptAuthEnabled: boolean;
  yourgptApiKey: string;
  yourgptWidgetUid: string;
  // Tools
  hiddenAnalytics: boolean;
  deferredSearch: boolean;
  // Custom message view
  customMessageView: boolean;
}
