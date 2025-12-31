"use client";

import { CopilotProvider, useTools } from "@yourgpt/copilot-sdk-react";
import { builtinTools } from "@yourgpt/copilot-sdk-core";
import { CopilotChat, CapabilityList } from "@yourgpt/copilot-sdk-ui";

interface ProviderCardProps {
  name: string;
  model: string;
  endpoint: string;
  color: "green" | "orange" | "blue" | "purple";
  capabilities: {
    supportsVision?: boolean;
    supportsTools?: boolean;
    supportsThinking?: boolean;
    supportsStreaming?: boolean;
    supportsPDF?: boolean;
    supportsAudio?: boolean;
    supportsVideo?: boolean;
  };
}

const colorClasses = {
  green: "border-green-500/50 bg-green-500/5",
  orange: "border-orange-500/50 bg-orange-500/5",
  blue: "border-blue-500/50 bg-blue-500/5",
  purple: "border-purple-500/50 bg-purple-500/5",
};

const headerColors = {
  green: "text-green-400",
  orange: "text-orange-400",
  blue: "text-blue-400",
  purple: "text-purple-400",
};

export function ProviderCard({
  name,
  model,
  endpoint,
  color,
  capabilities,
}: ProviderCardProps) {
  return (
    <div
      className={`flex flex-col rounded-xl border-2 ${colorClasses[color]} overflow-hidden h-full`}
    >
      {/* Header */}
      <div className="flex flex-col gap-2 p-4 border-b border-border/50">
        <div className="flex items-center justify-between">
          <h2 className={`text-lg font-bold ${headerColors[color]}`}>{name}</h2>
          <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">
            {model}
          </span>
        </div>
        <CapabilityList capabilities={capabilities} size="sm" onlySupported />
      </div>

      {/* Chat Area */}
      <div className="flex-1 min-h-0">
        <CopilotProvider runtimeUrl={endpoint} debug streaming={false}>
          <ToolsSetup />
          <CopilotChat
            title=""
            placeholder={`Message ${name}...`}
            showPoweredBy={false}
            className="h-full"
          />
        </CopilotProvider>
      </div>
    </div>
  );
}

/**
 * Component to register built-in tools
 */
function ToolsSetup() {
  useTools({
    capture_screenshot: builtinTools.capture_screenshot,
    get_console_logs: builtinTools.get_console_logs,
  });
  return null;
}
