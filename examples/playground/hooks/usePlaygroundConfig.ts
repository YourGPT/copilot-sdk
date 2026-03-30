"use client";

import { useState, useCallback, useEffect } from "react";
import type {
  CopilotTheme,
  GenerativeUIConfig,
  ToolsEnabledConfig,
  GenerativeUIKey,
  ToolKey,
  SDKConfig,
  LayoutTemplate,
  ProviderId,
  AlphaConfig,
} from "@/lib/types";
import {
  DEFAULT_SYSTEM_PROMPT,
  INITIAL_GENERATIVE_UI,
  INITIAL_TOOLS_ENABLED,
  INITIAL_SDK_CONFIG,
  INITIAL_ALPHA_CONFIG,
  PLAYGROUND_CONFIG_STORAGE_KEY,
} from "@/lib/constants";

/**
 * Stored playground configuration shape
 */
interface PlaygroundConfigStorage {
  copilotTheme: CopilotTheme;
  layoutTemplate: LayoutTemplate;
  systemPrompt: string;
  generativeUI: GenerativeUIConfig;
  toolsEnabled: ToolsEnabledConfig;
  sdkConfig: SDKConfig;
  selectedProvider: ProviderId;
  selectedOpenRouterModel: string;
  alphaConfig: AlphaConfig;
}

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: PlaygroundConfigStorage = {
  copilotTheme: "vercel",
  layoutTemplate: "support",
  systemPrompt: DEFAULT_SYSTEM_PROMPT,
  generativeUI: INITIAL_GENERATIVE_UI,
  toolsEnabled: INITIAL_TOOLS_ENABLED,
  sdkConfig: INITIAL_SDK_CONFIG,
  selectedProvider: "openai",
  selectedOpenRouterModel: "",
  alphaConfig: INITIAL_ALPHA_CONFIG,
};

/**
 * Load configuration from localStorage
 */
function loadStoredConfig(): PlaygroundConfigStorage {
  if (typeof window === "undefined") {
    return DEFAULT_CONFIG;
  }

  const stored = localStorage.getItem(PLAYGROUND_CONFIG_STORAGE_KEY);
  if (stored) {
    try {
      const parsed = JSON.parse(stored) as Partial<PlaygroundConfigStorage>;
      // Merge with defaults to handle missing keys from older stored configs
      return { ...DEFAULT_CONFIG, ...parsed };
    } catch {
      return DEFAULT_CONFIG;
    }
  }
  return DEFAULT_CONFIG;
}

/**
 * Manages playground configuration state with localStorage persistence.
 * Uses stable callbacks to prevent unnecessary re-renders.
 *
 * @see Vercel React best practices: `rerender-functional-setstate`, `js-cache-storage`
 */
export function usePlaygroundConfig() {
  // Lazy initialization from localStorage
  const [copilotTheme, setCopilotTheme] = useState<CopilotTheme>(
    () => loadStoredConfig().copilotTheme,
  );

  const [layoutTemplate, setLayoutTemplate] = useState<LayoutTemplate>(
    () => loadStoredConfig().layoutTemplate,
  );

  const [systemPrompt, setSystemPrompt] = useState(
    () => loadStoredConfig().systemPrompt,
  );

  const [generativeUI, setGenerativeUI] = useState<GenerativeUIConfig>(
    () => loadStoredConfig().generativeUI,
  );

  const [toolsEnabled, setToolsEnabled] = useState<ToolsEnabledConfig>(
    () => loadStoredConfig().toolsEnabled,
  );

  const [sdkConfig, setSDKConfig] = useState<SDKConfig>(
    () => loadStoredConfig().sdkConfig,
  );

  const [selectedProvider, setSelectedProvider] = useState<ProviderId>(
    () => loadStoredConfig().selectedProvider,
  );

  const [selectedOpenRouterModel, setSelectedOpenRouterModel] =
    useState<string>(() => loadStoredConfig().selectedOpenRouterModel);

  const [alphaConfig, setAlphaConfig] = useState<AlphaConfig>(
    () => loadStoredConfig().alphaConfig,
  );

  // Persist to localStorage whenever any config changes
  useEffect(() => {
    if (typeof window === "undefined") return;

    const config: PlaygroundConfigStorage = {
      copilotTheme,
      layoutTemplate,
      systemPrompt,
      generativeUI,
      toolsEnabled,
      sdkConfig,
      selectedProvider,
      selectedOpenRouterModel,
      alphaConfig,
    };
    localStorage.setItem(PLAYGROUND_CONFIG_STORAGE_KEY, JSON.stringify(config));
  }, [
    copilotTheme,
    layoutTemplate,
    systemPrompt,
    generativeUI,
    toolsEnabled,
    sdkConfig,
    selectedProvider,
    selectedOpenRouterModel,
    alphaConfig,
  ]);

  // Theme setters
  const updateTheme = useCallback((theme: CopilotTheme) => {
    setCopilotTheme(theme);
  }, []);

  // Layout template setter
  const updateLayoutTemplate = useCallback((layout: LayoutTemplate) => {
    setLayoutTemplate(layout);
  }, []);

  // System prompt setter
  const updateSystemPrompt = useCallback((prompt: string) => {
    setSystemPrompt(prompt);
  }, []);

  // Generative UI toggle
  const toggleGenerativeUI = useCallback((key: GenerativeUIKey) => {
    setGenerativeUI((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  // Tools enabled toggle
  const toggleTool = useCallback((key: ToolKey) => {
    setToolsEnabled((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  // SDK config update
  const updateSDKConfig = useCallback(
    <K extends keyof SDKConfig>(key: K, value: SDKConfig[K]) => {
      setSDKConfig((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  // Provider setter
  const updateProvider = useCallback((provider: ProviderId) => {
    setSelectedProvider(provider);
  }, []);

  // OpenRouter model setter
  const updateOpenRouterModel = useCallback((model: string) => {
    setSelectedOpenRouterModel(model);
  }, []);

  // Alpha config updater
  const updateAlphaConfig = useCallback(
    <K extends keyof AlphaConfig>(key: K, value: AlphaConfig[K]) => {
      setAlphaConfig((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  return {
    // State
    copilotTheme,
    layoutTemplate,
    systemPrompt,
    generativeUI,
    toolsEnabled,
    sdkConfig,
    selectedProvider,
    selectedOpenRouterModel,
    alphaConfig,
    // Actions
    updateTheme,
    updateLayoutTemplate,
    updateSystemPrompt,
    toggleGenerativeUI,
    toggleTool,
    updateSDKConfig,
    updateProvider,
    updateOpenRouterModel,
    updateAlphaConfig,
    // Direct setters (for advanced use cases)
    setCopilotTheme,
    setLayoutTemplate,
    setSystemPrompt,
    setGenerativeUI,
    setToolsEnabled,
    setSDKConfig,
    setSelectedProvider,
    setSelectedOpenRouterModel,
  };
}
