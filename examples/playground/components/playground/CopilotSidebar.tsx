"use client";

import { useMemo, useCallback } from "react";
import { toast } from "sonner";
import { CopilotProvider } from "@yourgpt/copilot-sdk/react";
import { CopilotPanel } from "./CopilotPanel";
import type {
  CopilotTheme,
  DashboardState,
  PersonData,
  LayoutTemplate,
  ToolsEnabledConfig,
  GenerativeUIConfig,
  ProviderId,
  ApiKeys,
  LoaderVariant,
  AlphaConfig,
} from "@/lib/types";
import type { DashboardActions } from "@/hooks/useDashboardState";

interface CopilotSidebarProps {
  systemPrompt: string;
  copilotTheme: CopilotTheme;
  layoutTemplate: LayoutTemplate;
  dashboardState: DashboardState;
  actions: DashboardActions;
  selectedPerson: PersonData;
  toolsEnabled: ToolsEnabledConfig;
  generativeUI: GenerativeUIConfig;
  selectedProvider: ProviderId;
  selectedOpenRouterModel: string;
  apiKeys: ApiKeys;
  loaderVariant: LoaderVariant;
  alphaConfig: AlphaConfig;
}

export function CopilotSidebar({
  systemPrompt,
  copilotTheme,
  layoutTemplate,
  dashboardState,
  actions,
  selectedPerson,
  toolsEnabled,
  generativeUI,
  selectedProvider,
  selectedOpenRouterModel,
  apiKeys,
  loaderVariant,
  alphaConfig,
}: CopilotSidebarProps) {
  // Build runtime URL with provider and model selection
  const runtimeUrl = useMemo(() => {
    const baseUrl = `/playground/api/${selectedProvider}`;
    const params = new URLSearchParams();

    // Add model param for OpenRouter
    if (selectedProvider === "openrouter" && selectedOpenRouterModel) {
      params.set("model", selectedOpenRouterModel);
    }

    const queryString = params.toString();
    return queryString ? `${baseUrl}?${queryString}` : baseUrl;
  }, [selectedProvider, selectedOpenRouterModel, apiKeys]);

  // Pass API key via headers instead of query params (security best practice)
  const runtimeHeaders = useMemo(() => {
    const headers: Record<string, string> = {};
    const apiKey = apiKeys[selectedProvider];
    if (apiKey) {
      headers["x-api-key"] = apiKey;
    }
    return headers;
  }, [selectedProvider, apiKeys]);

  // Error handler - shows toast and logs to console
  const handleError = useCallback((error: Error) => {
    // Show toast notification
    toast.error("Copilot Error", {
      description: error.message,
      duration: 5000,
      id: "copilot-error",
      position: "top-center",
    });

    // Also log to console for debugging
    console.error(
      `%c[Copilot Error]%c ${error.message}`,
      "background: #ef4444; color: white; padding: 2px 6px; border-radius: 3px; font-weight: bold;",
      "color: #ef4444;",
    );
  }, []);

  return (
    <div className="w-[420px] p-2">
      <div className="flex-1 min-h-0 h-full rounded-2xl overflow-hidden shadow-[0_0_10px_0_rgba(0,0,0,0.05)] border">
        <CopilotProvider
          debug={true}
          key={`${selectedProvider}-${selectedOpenRouterModel}-${alphaConfig.concurrentThreads ? "ct" : "st"}-${alphaConfig.yourgptAuthEnabled ? "ygpt" : "local"}`} // Force re-mount when provider, model, thread mode, or auth mode changes
          runtimeUrl={runtimeUrl}
          headers={runtimeHeaders}
          systemPrompt={systemPrompt}
          maxIterations={5}
          onError={handleError}
          {...(alphaConfig.yourgptAuthEnabled &&
          alphaConfig.yourgptApiKey &&
          alphaConfig.yourgptWidgetUid
            ? {
                yourgptConfig: {
                  apiKey: alphaConfig.yourgptApiKey,
                  widgetUid: alphaConfig.yourgptWidgetUid,
                },
              }
            : {})}
          concurrentThreads={alphaConfig.concurrentThreads}
          messageHistory={
            alphaConfig.compactionStrategy !== "none"
              ? { strategy: alphaConfig.compactionStrategy }
              : undefined
          }
        >
          <CopilotPanel
            theme={copilotTheme}
            layoutTemplate={layoutTemplate}
            dashboardState={dashboardState}
            actions={actions}
            currentPerson={selectedPerson}
            toolsEnabled={toolsEnabled}
            generativeUI={generativeUI}
            loaderVariant={loaderVariant}
            alphaConfig={alphaConfig}
          />
        </CopilotProvider>
      </div>
    </div>
  );
}
