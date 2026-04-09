import { useState, useEffect, useMemo } from "react";
import { CopilotProvider } from "@yourgpt/copilot-sdk/react";
import { CopilotChat } from "@yourgpt/copilot-sdk/ui";
import "@yourgpt/copilot-sdk/ui/styles.css";

interface ModelOption {
  id: string;
  label: string;
}

export default function App() {
  const [models, setModels] = useState<ModelOption[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>("");

  useEffect(() => {
    fetch("/api/models")
      .then((r) => r.json())
      .then(
        ({
          models,
          default: def,
        }: {
          models: ModelOption[];
          default: string;
        }) => {
          setModels(models);
          setSelectedModel(def);
        },
      )
      .catch(console.error);
  }, []);

  // Pass model id as a query param — server reads it from the URL
  const runtimeUrl = useMemo(() => {
    if (!selectedModel) return "/api/chat";
    return `/api/chat?model=${encodeURIComponent(selectedModel)}`;
  }, [selectedModel]);

  const selectedLabel =
    models.find((m) => m.id === selectedModel)?.label ?? selectedModel;

  return (
    <div className="h-screen flex flex-col bg-[#0a0a0f] text-white font-sans">
      {/* Header */}
      <header className="flex items-center justify-between px-5 py-3 border-b border-white/[0.07] bg-[#0a0a0f]/80 backdrop-blur flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-md bg-blue-500/20 flex items-center justify-center">
            <svg
              viewBox="0 0 24 24"
              className="w-4 h-4 text-blue-400"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M12 6v6l4 2" />
            </svg>
          </div>
          <span className="text-sm font-semibold text-white/90">
            Together AI Demo
          </span>
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/25">
            @yourgpt/llm-sdk/togetherai
          </span>
        </div>

        {/* Model selector + browse link */}
        <div className="flex items-center gap-2">
          {models.length > 0 && (
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="text-xs bg-white/[0.06] border border-white/[0.1] rounded-md px-3 py-1.5 text-white/80 focus:outline-none focus:border-blue-500/50 cursor-pointer"
            >
              {models.map((m) => (
                <option key={m.id} value={m.id} className="bg-[#1a1a2e]">
                  {m.label}
                </option>
              ))}
            </select>
          )}
          <a
            href="https://api.together.xyz/models"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] text-blue-400/70 hover:text-blue-400 transition-colors whitespace-nowrap"
          >
            Browse models
          </a>
        </div>
      </header>

      {/* Chat — re-mount CopilotProvider when model changes so runtimeUrl updates */}
      <div className="flex-1 min-h-0">
        {selectedModel && (
          <CopilotProvider key={runtimeUrl} runtimeUrl={runtimeUrl}>
            <CopilotChat
              className="h-full"
              placeholder={`Ask ${selectedLabel} anything...`}
              loaderVariant="dots"
            />
          </CopilotProvider>
        )}
      </div>
    </div>
  );
}
