"use client";

import { useState, useEffect, useCallback } from "react";
import type { ProviderId, PersonData } from "@/lib/types";
import { samplePersons } from "@/lib/constants";

// Hooks
import { useApiKeys } from "@/hooks/useApiKeys";
import { useDashboardState } from "@/hooks/useDashboardState";
import { usePlaygroundConfig } from "@/hooks/usePlaygroundConfig";

// Components
import { Header } from "@/components/playground/Header";
import { ControlPanel } from "@/components/playground/ControlPanel";
import { CopilotSidebar } from "@/components/playground/CopilotSidebar";
import { ApiKeyModal } from "@/components/modals/ApiKeyModal";
import { WelcomeModal } from "@/components/modals/WelcomeModal";

// Theme CSS imports
import "@yourgpt/copilot-sdk/ui/styles.css";
import "@yourgpt/copilot-sdk/ui/themes/claude.css";
import "@yourgpt/copilot-sdk/ui/themes/linear.css";
import "@yourgpt/copilot-sdk/ui/themes/vercel.css";
import "@yourgpt/copilot-sdk/ui/themes/twitter.css";
import "@yourgpt/copilot-sdk/ui/themes/catppuccin.css";
import "@yourgpt/copilot-sdk/ui/themes/supabase.css";
import "@yourgpt/copilot-sdk/ui/themes/modern-minimal.css";
import "@yourgpt/copilot-sdk/ui/themes/posthog.css";

export default function PlaygroundPage() {
  // Hooks
  const { keys: apiKeys, updateKeys: setApiKeys } = useApiKeys();
  const { state: dashboardState, actions } = useDashboardState();
  const {
    copilotTheme,
    layoutTemplate,
    systemPrompt,
    generativeUI,
    toolsEnabled,
    sdkConfig,
    selectedProvider,
    selectedOpenRouterModel,
    alphaConfig,
    updateTheme,
    updateLayoutTemplate,
    updateSystemPrompt,
    toggleGenerativeUI,
    toggleTool,
    updateSDKConfig,
    updateProvider,
    updateOpenRouterModel,
    updateAlphaConfig,
  } = usePlaygroundConfig();

  // Local state
  const [mounted, setMounted] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState<PersonData>(
    samplePersons[0],
  );
  const [apiKeyModalOpen, setApiKeyModalOpen] = useState(false);

  // Initialize on mount
  useEffect(() => {
    setMounted(true);
  }, []);

  // Check if any API key is set
  const hasAnyApiKey = Object.values(apiKeys).some((key) => !!key);

  // Welcome modal - show if no API keys are set and not temporarily dismissed
  const [welcomeDismissed, setWelcomeDismissed] = useState(false);
  const showWelcomeModal =
    !hasAnyApiKey && !welcomeDismissed && !apiKeyModalOpen;

  // Handlers
  const handleSaveApiKeys = useCallback(
    (keys: typeof apiKeys) => {
      setApiKeys(keys);
    },
    [setApiKeys],
  );

  const handleOpenApiKeyModal = useCallback(() => {
    setApiKeyModalOpen(true);
  }, []);

  const handleProviderChange = useCallback(
    (provider: ProviderId) => {
      updateProvider(provider);
    },
    [updateProvider],
  );

  const handleOpenRouterModelChange = useCallback(
    (model: string) => {
      updateOpenRouterModel(model);
    },
    [updateOpenRouterModel],
  );

  const handleSelectPerson = useCallback((person: PersonData) => {
    setSelectedPerson(person);
  }, []);

  const handleIncrementCounter = useCallback(() => {
    actions.incrementCounter();
  }, [actions]);

  const handleDecrementCounter = useCallback(() => {
    actions.decrementCounter();
  }, [actions]);

  const handleAddToCart = useCallback(() => {
    actions.updateCart("add", 1);
  }, [actions]);

  const handleClearCart = useCallback(() => {
    actions.updateCart("clear");
  }, [actions]);

  // Derived state
  const hasApiKey =
    selectedProvider === "yourgpt-server" || !!apiKeys[selectedProvider];

  // Don't render until mounted (avoid hydration issues)
  if (!mounted) return null;

  return (
    <div className="h-screen flex flex-col bg-zinc-100 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      {/* Header */}
      <Header hasApiKey={hasApiKey} onOpenApiKeyModal={handleOpenApiKeyModal} />

      {/* Main Content */}
      <div className="flex-1 flex min-h-0">
        {/* Main Panel */}
        <div className="flex-1 overflow-auto relative">
          {/* Top fade gradient */}
          <div className="sticky top-0 left-0 right-0 h-8 bg-gradient-to-b from-zinc-100 dark:from-zinc-950 to-transparent pointer-events-none z-10" />
          <div className="p-6 pt-3 -mt-8">
            <ControlPanel
              copilotTheme={copilotTheme}
              onThemeChange={updateTheme}
              layoutTemplate={layoutTemplate}
              onLayoutChange={updateLayoutTemplate}
              selectedProvider={selectedProvider}
              onProviderChange={handleProviderChange}
              selectedOpenRouterModel={selectedOpenRouterModel}
              onOpenRouterModelChange={handleOpenRouterModelChange}
              systemPrompt={systemPrompt}
              onSystemPromptChange={updateSystemPrompt}
              generativeUI={generativeUI}
              onToggleGenerativeUI={toggleGenerativeUI}
              toolsEnabled={toolsEnabled}
              onToggleTool={toggleTool}
              dashboardState={dashboardState}
              onIncrementCounter={handleIncrementCounter}
              onDecrementCounter={handleDecrementCounter}
              onAddToCart={handleAddToCart}
              onClearCart={handleClearCart}
              onReset={actions.reset}
              selectedPerson={selectedPerson}
              onSelectPerson={handleSelectPerson}
              sdkConfig={sdkConfig}
              onUpdateSDKConfig={updateSDKConfig}
              alphaConfig={alphaConfig}
              onUpdateAlpha={updateAlphaConfig}
            />
          </div>
        </div>

        {/* Copilot Sidebar */}
        <CopilotSidebar
          systemPrompt={systemPrompt}
          copilotTheme={copilotTheme}
          layoutTemplate={layoutTemplate}
          dashboardState={dashboardState}
          actions={actions}
          selectedPerson={selectedPerson}
          toolsEnabled={toolsEnabled}
          generativeUI={generativeUI}
          selectedProvider={selectedProvider}
          selectedOpenRouterModel={selectedOpenRouterModel}
          apiKeys={apiKeys}
          loaderVariant={sdkConfig.loaderVariant}
          alphaConfig={alphaConfig}
        />
      </div>

      {/* Modals */}
      <ApiKeyModal
        open={apiKeyModalOpen}
        onOpenChange={setApiKeyModalOpen}
        apiKeys={apiKeys}
        onSave={handleSaveApiKeys}
      />

      <WelcomeModal
        open={showWelcomeModal}
        onOpenChange={(open) => !open && setWelcomeDismissed(true)}
        onTryWithApiKeys={handleOpenApiKeyModal}
      />
    </div>
  );
}
