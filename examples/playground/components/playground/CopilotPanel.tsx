"use client";

import type {
  CopilotTheme,
  DashboardState,
  PersonData,
  LayoutTemplate,
  ToolsEnabledConfig,
  GenerativeUIConfig,
  LoaderVariant,
  AlphaConfig,
} from "@/lib/types";
import type { DashboardActions } from "@/hooks/useDashboardState";
import { useDashboardContext } from "@/hooks/useDashboardContext";
import { SkillProvider, defineSkill } from "@yourgpt/copilot-sdk/react";
import { DashboardTools } from "./DashboardTools";
import { ContextStatsBar } from "./ContextStatsBar";
import { DefaultLayout } from "./layouts/DefaultLayout";
import { SaasLayout } from "./layouts/SaasLayout";
import { SupportLayout } from "./layouts/SupportLayout";

interface CopilotPanelProps {
  theme: CopilotTheme;
  layoutTemplate: LayoutTemplate;
  dashboardState: DashboardState;
  actions: DashboardActions;
  currentPerson: PersonData;
  toolsEnabled: ToolsEnabledConfig;
  generativeUI: GenerativeUIConfig;
  loaderVariant: LoaderVariant;
  alphaConfig: AlphaConfig;
}

const brandVoiceSkill = defineSkill({
  name: "brand-voice",
  description: "Sets response tone — always active",
  strategy: "eager",
  source: {
    type: "inline",
    content:
      "Always respond in a friendly, concise tone. Be helpful and professional. Use simple language.",
  },
});

const codeReviewSkill = defineSkill({
  name: "code-review",
  description: "Performs structured code reviews with actionable feedback",
  strategy: "auto",
  source: {
    type: "inline",
    content:
      "When reviewing code: 1) Check for bugs and logic errors first. 2) Flag security issues. 3) Suggest performance improvements. 4) Note style issues last. Always provide a brief summary.",
  },
});

export function CopilotPanel({
  theme,
  layoutTemplate,
  dashboardState,
  actions,
  currentPerson,
  toolsEnabled,
  generativeUI,
  loaderVariant,
  alphaConfig,
}: CopilotPanelProps) {
  // Provide dashboard and user context to the AI
  useDashboardContext({ dashboardState, currentPerson });

  // Render the appropriate layout based on template
  const renderLayout = () => {
    switch (layoutTemplate) {
      case "saas":
        return (
          <SaasLayout
            theme={theme}
            loaderVariant={loaderVariant}
            alphaConfig={alphaConfig}
          />
        );
      case "support":
        return (
          <SupportLayout
            theme={theme}
            loaderVariant={loaderVariant}
            alphaConfig={alphaConfig}
          />
        );
      case "default":
      default:
        return (
          <DefaultLayout
            theme={theme}
            loaderVariant={loaderVariant}
            alphaConfig={alphaConfig}
          />
        );
    }
  };

  const activeSkills = [
    ...(alphaConfig.brandVoiceSkill ? [brandVoiceSkill] : []),
    ...(alphaConfig.codeReviewSkill ? [codeReviewSkill] : []),
  ];

  return (
    <div className="h-full flex flex-col">
      {/* Tools are conditionally rendered - unmounting unregisters from AI */}
      <DashboardTools
        dashboardState={dashboardState}
        actions={actions}
        toolsEnabled={toolsEnabled}
        generativeUI={generativeUI}
        alphaConfig={alphaConfig}
      />
      {alphaConfig.contextStats && <ContextStatsBar />}
      <div className="flex-1 min-h-0">
        {activeSkills.length > 0 ? (
          <SkillProvider skills={activeSkills}>{renderLayout()}</SkillProvider>
        ) : (
          renderLayout()
        )}
      </div>
    </div>
  );
}
