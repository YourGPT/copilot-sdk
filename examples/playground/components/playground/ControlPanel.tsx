"use client";

import { memo, useState, useMemo } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Settings2,
  Terminal,
  Palette,
  Zap,
  Layers,
  RotateCcw,
  Plus,
  Minus,
  ShoppingCart,
  Trash2,
  CircleDot,
  Gauge,
  User,
  Sparkles,
  MessageSquare,
  Layout,
  Cpu,
  Camera,
  ScrollText,
  X,
  ExternalLink,
  Check,
  ChevronsUpDown,
} from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type {
  CopilotTheme,
  DashboardState,
  GenerativeUIConfig,
  GenerativeUIKey,
  ToolsEnabledConfig,
  ToolKey,
  PersonData,
  LayoutTemplate,
  ProviderId,
  SDKConfig,
  LoaderVariant,
} from "@/lib/types";
import {
  themes,
  samplePersons,
  layoutTemplates,
  providers,
  OPENROUTER_MODELS,
  LOADER_VARIANTS,
} from "@/lib/constants";
import { useOpenRouterModels } from "@/hooks/useOpenRouterModels";
import { WeatherModule } from "./modules/WeatherModule";
import { StockModule } from "./modules/StockModule";
import { AlertModule } from "./modules/AlertModule";
import { ToolInfoHoverCard } from "./ToolInfoHoverCard";
import { ConfigInfoHoverCard } from "./ConfigInfoHoverCard";
import { toolMetadata } from "@/lib/tool-metadata";
import { configMetadata } from "@/lib/config-metadata";

const generativeUIKeys: GenerativeUIKey[] = [
  "weather",
  "stock",
  "notification",
];

const exampleQuestions = [
  "What's my current plan?",
  "How many credits do I have?",
  "What's my name and role?",
];

// Reusable section label
function SectionLabel({
  icon: Icon,
  label,
}: {
  icon: typeof Zap;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon className="h-3.5 w-3.5 text-zinc-400" />
      <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-zinc-500">
        {label}
      </span>
    </div>
  );
}

// Industrial toggle switch
function ToggleSwitch({
  active,
  onChange,
  size = "default",
}: {
  active: boolean;
  onChange: () => void;
  size?: "sm" | "default";
}) {
  const sizeClasses = size === "sm" ? "h-5 w-9" : "h-6 w-11";
  const dotClasses = size === "sm" ? "h-3 w-3 top-1" : "h-4 w-4 top-1";
  const translateClass = size === "sm" ? "left-5" : "left-6";

  return (
    <button
      onClick={onChange}
      className={`relative ${sizeClasses} rounded-full transition-all duration-200 ${active ? "bg-emerald-500/20 ring-1 ring-emerald-500/50" : "bg-zinc-200 dark:bg-zinc-800 ring-1 ring-zinc-300 dark:ring-zinc-700"}`}
    >
      <span
        className={`absolute ${dotClasses} rounded-full transition-all duration-200 ${active ? `${translateClass} bg-emerald-500 shadow-lg shadow-emerald-500/50` : "left-1 bg-zinc-400 dark:bg-zinc-500"}`}
      />
    </button>
  );
}

// OpenRouter Model Selector Component with shadcn Combobox
function OpenRouterModelSelector({
  selectedModel,
  onModelChange,
}: {
  selectedModel: string;
  onModelChange: (model: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [customModel, setCustomModel] = useState("");

  // Fetch live models from OpenRouter API
  const { models: liveModels, isLoading } = useOpenRouterModels();

  // Use live models if available, otherwise fallback to static list
  const availableModels = useMemo(() => {
    if (liveModels.length > 0) {
      return liveModels.map((m) => ({
        id: m.id,
        name: m.name,
        provider: m.id.split("/")[0] || "Other",
      }));
    }
    return OPENROUTER_MODELS;
  }, [liveModels]);

  const isPresetModel = availableModels.some((m) => m.id === selectedModel);
  const useCustom =
    customModel !== "" || (!isPresetModel && selectedModel !== "");

  const groupedModels = useMemo(() => {
    // Define popular providers order
    const popularProviders = [
      "openrouter",
      "openai",
      "anthropic",
      "google",
      "x-ai",
      "meta-llama",
      "deepseek",
      "mistralai",
      "qwen",
    ];

    const groups: Record<string, typeof availableModels> = {};
    for (const model of availableModels) {
      if (!groups[model.provider]) groups[model.provider] = [];
      groups[model.provider].push(model);
    }

    // Sort providers: popular first, then alphabetically
    const sortedGroups: Record<string, typeof availableModels> = {};

    // Add popular providers first
    for (const provider of popularProviders) {
      if (groups[provider]) {
        sortedGroups[provider] = groups[provider];
      }
    }

    // Add remaining providers alphabetically
    const remainingProviders = Object.keys(groups)
      .filter((p) => !popularProviders.includes(p))
      .sort();

    for (const provider of remainingProviders) {
      sortedGroups[provider] = groups[provider];
    }

    return sortedGroups;
  }, [availableModels]);

  // Custom Input
  if (useCustom) {
    return (
      <div className="flex gap-1.5">
        <input
          type="text"
          value={customModel || selectedModel}
          onChange={(e) => {
            setCustomModel(e.target.value);
            if (e.target.value.trim()) onModelChange(e.target.value.trim());
          }}
          placeholder="model-id"
          className="flex-1 h-9 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 text-xs font-mono text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 placeholder:text-zinc-400"
        />
        <button
          onClick={() => {
            setCustomModel("");
            onModelChange(availableModels[0]?.id || "openrouter/auto");
          }}
          className="px-2 h-9 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-500 transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  // Combobox
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          role="combobox"
          aria-expanded={open}
          className="w-full flex items-center justify-between h-9 px-3 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-lg hover:border-zinc-300 dark:hover:border-zinc-600 transition-all text-left"
        >
          <span className="text-xs font-mono text-zinc-700 dark:text-zinc-300 truncate">
            {selectedModel}
          </span>
          {isLoading ? (
            <CircleDot className="h-3.5 w-3.5 shrink-0 opacity-50 animate-spin" />
          ) : (
            <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[--radix-popover-trigger-width] p-0"
        align="start"
      >
        <Command>
          <CommandInput
            placeholder="Search models..."
            className="h-8 text-xs"
          />
          <CommandList className="max-h-[200px]">
            <CommandEmpty>
              {isLoading ? "Loading models..." : "No model found."}
            </CommandEmpty>
            {Object.entries(groupedModels).map(([provider, models]) => (
              <CommandGroup key={provider} heading={provider}>
                {models.map((model) => (
                  <CommandItem
                    key={model.id}
                    value={`${model.name} ${model.id} ${model.provider}`}
                    onSelect={() => {
                      onModelChange(model.id);
                      setOpen(false);
                    }}
                    className="text-xs py-1.5 justify-between font-mono"
                  >
                    {model.id}
                    <Check
                      className={`h-3 w-3 ${selectedModel === model.id ? "opacity-100" : "opacity-0"}`}
                    />
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
            <CommandGroup>
              <CommandItem
                onSelect={() => {
                  setCustomModel(" ");
                  setOpen(false);
                }}
                className="text-xs py-1.5 text-indigo-500"
              >
                <Plus className="mr-2 h-3 w-3" />
                Custom model ID...
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

interface ControlPanelProps {
  copilotTheme: CopilotTheme;
  onThemeChange: (theme: CopilotTheme) => void;
  layoutTemplate: LayoutTemplate;
  onLayoutChange: (layout: LayoutTemplate) => void;
  selectedProvider: ProviderId;
  onProviderChange: (provider: ProviderId) => void;
  selectedOpenRouterModel: string;
  onOpenRouterModelChange: (model: string) => void;
  systemPrompt: string;
  onSystemPromptChange: (prompt: string) => void;
  generativeUI: GenerativeUIConfig;
  onToggleGenerativeUI: (key: GenerativeUIKey) => void;
  toolsEnabled: ToolsEnabledConfig;
  onToggleTool: (key: ToolKey) => void;
  dashboardState: DashboardState;
  onIncrementCounter: () => void;
  onDecrementCounter: () => void;
  onAddToCart: () => void;
  onClearCart: () => void;
  onReset: () => void;
  selectedPerson: PersonData;
  onSelectPerson: (person: PersonData) => void;
  sdkConfig: SDKConfig;
  onUpdateSDKConfig: <K extends keyof SDKConfig>(
    key: K,
    value: SDKConfig[K],
  ) => void;
}

function ControlPanelComponent({
  copilotTheme,
  onThemeChange,
  layoutTemplate,
  onLayoutChange,
  selectedProvider,
  onProviderChange,
  selectedOpenRouterModel,
  onOpenRouterModelChange,
  systemPrompt,
  onSystemPromptChange,
  generativeUI,
  onToggleGenerativeUI,
  toolsEnabled,
  onToggleTool,
  dashboardState,
  onIncrementCounter,
  onDecrementCounter,
  onAddToCart,
  onClearCart,
  onReset,
  selectedPerson,
  onSelectPerson,
  sdkConfig,
  onUpdateSDKConfig,
}: ControlPanelProps) {
  const activeToolCount = Object.values(toolsEnabled).filter(Boolean).length;
  const selectedTheme = themes.find((t) => t.id === copilotTheme);
  const selectedLayout = layoutTemplates.find((l) => l.id === layoutTemplate);
  const currentProvider = providers.find((p) => p.id === selectedProvider);

  return (
    <div className="space-y-6 relative">
      {/* Header */}
      {/* <header className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-zinc-900 dark:bg-zinc-800 ring-1 ring-zinc-700">
              <Settings2 className="h-5 w-5 text-zinc-300" />
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-zinc-100 dark:ring-zinc-950" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
              Control Panel
            </h1>
            <p className="text-[11px] text-zinc-500 font-mono">
              SDK Configuration
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800/50 ring-1 ring-zinc-200 dark:ring-zinc-700">
          <CircleDot className="h-3 w-3 text-emerald-500" />
          <span className="text-[10px] font-mono text-zinc-600 dark:text-zinc-400">
            {activeToolCount} Tools
          </span>
        </div>
      </header> */}

      {/* Configuration - Always Visible */}
      <section className="p-5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50">
        <div className="flex items-center gap-3 mb-5">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-500/10 ring-1 ring-indigo-500/20">
            <Terminal className="h-4 w-4 text-indigo-500" />
          </div>
          <div>
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
              Configuration
            </p>
            <p className="text-[10px] text-zinc-500 font-mono">
              theme · prompt · sdk options
            </p>
          </div>
        </div>

        <div className="space-y-5">
          {/* Row 1: Theme + Layout Select */}
          <div className="flex flex-wrap items-end gap-4">
            <div className="w-36">
              <div className="flex items-center gap-1 mb-3">
                <Palette className="h-3.5 w-3.5 text-zinc-400" />
                <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-zinc-500">
                  Theme
                </span>
                <ConfigInfoHoverCard
                  description={configMetadata.theme.description}
                  tip={configMetadata.theme.tip}
                  codeSnippet={configMetadata.theme.codeSnippet}
                  codeLabel={configMetadata.theme.codeLabel}
                />
              </div>
              <Select
                value={copilotTheme}
                onValueChange={(v) => onThemeChange(v as CopilotTheme)}
              >
                <SelectTrigger className="h-9 bg-zinc-50 dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-700">
                  <SelectValue>
                    <span className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 rounded-full ring-1 ring-black/10"
                        style={{ backgroundColor: selectedTheme?.accent }}
                      />
                      <span className="text-xs">{selectedTheme?.label}</span>
                    </span>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {themes.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      <span className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 rounded-full ring-1 ring-black/10"
                          style={{ backgroundColor: t.accent }}
                        />
                        <span>{t.label}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="w-40">
              <div className="flex items-center gap-1 mb-3">
                <Layout className="h-3.5 w-3.5 text-zinc-400" />
                <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-zinc-500">
                  Layout
                </span>
                <ConfigInfoHoverCard
                  description={configMetadata.layout.description}
                  tip={configMetadata.layout.tip}
                  codeSnippet={configMetadata.layout.codeSnippet}
                  codeLabel={configMetadata.layout.codeLabel}
                />
              </div>
              <Select
                value={layoutTemplate}
                onValueChange={(v) => onLayoutChange(v as LayoutTemplate)}
              >
                <SelectTrigger className="h-9 bg-zinc-50 dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-700">
                  <SelectValue>
                    <span className="text-xs">{selectedLayout?.name}</span>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {layoutTemplates.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      <div className="flex flex-col">
                        <span>{l.name}</span>
                        <span className="text-[10px] text-zinc-400">
                          {l.description}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="w-44">
              <div className="flex items-center gap-1 mb-3">
                <Cpu className="h-3.5 w-3.5 text-zinc-400" />
                <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-zinc-500">
                  Provider
                </span>
                <ConfigInfoHoverCard
                  description={configMetadata.model.description}
                  tip={configMetadata.model.tip}
                  codeSnippet={configMetadata.model.codeSnippet}
                  codeLabel={configMetadata.model.codeLabel}
                />
              </div>
              <Select
                value={selectedProvider}
                onValueChange={(v) => onProviderChange(v as ProviderId)}
              >
                <SelectTrigger className="h-9 bg-zinc-50 dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-700">
                  <SelectValue>
                    <span className="flex items-center gap-2">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: currentProvider?.color }}
                      />
                      <span className="text-xs truncate">
                        {currentProvider?.name} ·{" "}
                        {selectedProvider === "openrouter"
                          ? "500+"
                          : currentProvider?.model}
                      </span>
                    </span>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {providers.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      <span className="flex items-center gap-2">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: p.color }}
                        />
                        <span>{p.name}</span>
                        <span className="text-zinc-400 text-[10px]">
                          · {p.id === "openrouter" ? "500+ models" : p.model}
                        </span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* OpenRouter Model - Only shows when OpenRouter is selected */}
            {selectedProvider === "openrouter" && (
              <div className="w-56">
                <div className="flex items-center gap-1 mb-3">
                  <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
                  <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-zinc-500">
                    Model
                  </span>
                </div>
                <OpenRouterModelSelector
                  selectedModel={selectedOpenRouterModel}
                  onModelChange={onOpenRouterModelChange}
                />
              </div>
            )}
          </div>

          {/* Row 2: System Prompt - Full width */}
          <div>
            <div className="flex items-center gap-1 mb-3">
              <MessageSquare className="h-3.5 w-3.5 text-zinc-400" />
              <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-zinc-500">
                System Prompt
              </span>
              <ConfigInfoHoverCard
                description={configMetadata.systemPrompt.description}
                tip={configMetadata.systemPrompt.tip}
                codeSnippet={configMetadata.systemPrompt.codeSnippet}
                codeLabel={configMetadata.systemPrompt.codeLabel}
              />
            </div>
            <textarea
              value={systemPrompt}
              onChange={(e) => onSystemPromptChange(e.target.value)}
              className="w-full h-20 bg-zinc-50 dark:bg-zinc-800/50 ring-1 ring-zinc-200 dark:ring-zinc-700 rounded-lg px-3 py-2.5 text-xs font-mono text-zinc-700 dark:text-zinc-300 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500/50 placeholder:text-zinc-400 leading-relaxed"
              placeholder="// Define AI behavior..."
            />
          </div>

          {/* Row 3: More Settings - Bare collapsible */}
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="more" className="border-none">
              <AccordionTrigger className="py-0 hover:no-underline">
                <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300">
                  More Settings
                </span>
              </AccordionTrigger>
              <AccordionContent className="pt-4 pb-0">
                <div className="flex flex-wrap items-end gap-4">
                  {/* Loader Variant */}
                  <div className="w-40">
                    <div className="flex items-center gap-1 mb-3">
                      <CircleDot className="h-3.5 w-3.5 text-zinc-400" />
                      <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-zinc-500">
                        Loader
                      </span>
                    </div>
                    <Select
                      value={sdkConfig.loaderVariant}
                      onValueChange={(v) =>
                        onUpdateSDKConfig("loaderVariant", v as LoaderVariant)
                      }
                    >
                      <SelectTrigger className="h-9 bg-zinc-50 dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-700">
                        <SelectValue>
                          <span className="text-xs">
                            {
                              LOADER_VARIANTS.find(
                                (l) => l.id === sdkConfig.loaderVariant,
                              )?.label
                            }
                          </span>
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {LOADER_VARIANTS.map((variant) => (
                          <SelectItem key={variant.id} value={variant.id}>
                            <div className="flex flex-col">
                              <span>{variant.label}</span>
                              <span className="text-[10px] text-zinc-400">
                                {variant.description}
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </section>

      {/* Collapsible Sections */}
      <Accordion
        type="multiple"
        defaultValue={["tools", "generative", "context"]}
        className="space-y-3"
      >
        {/* Tools & State */}
        <AccordionItem
          value="tools"
          className="border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900/50"
        >
          <AccordionTrigger className="px-5 py-4 hover:no-underline hover:bg-zinc-50 dark:hover:bg-zinc-800/30">
            <div className="flex items-center gap-4">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-500/10 ring-1 ring-emerald-500/20">
                <Zap className="h-4 w-4 text-emerald-500" />
              </div>
              <div className="text-left">
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  Tools & State
                </p>
                <p className="text-[10px] text-zinc-500 font-mono">
                  {activeToolCount}/5 tools active
                </p>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-5 pt-1 pb-5">
            <div className="space-y-4">
              {/* Reset button */}
              <div className="flex justify-end">
                <button
                  onClick={onReset}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-zinc-100 dark:bg-zinc-800 ring-1 ring-zinc-200 dark:ring-zinc-700 text-[9px] font-mono text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-all"
                >
                  <RotateCcw className="h-3 w-3" />
                  Reset All
                </button>
              </div>

              {/* Unified Tool + State Cards */}
              <div className="grid grid-cols-5 gap-3">
                {/* Counter Tool + State */}
                <div
                  className={`rounded-xl ring-1 overflow-hidden ${toolsEnabled.updateCounter ? "ring-emerald-500/40 bg-emerald-500/5 dark:bg-emerald-500/10" : "ring-zinc-200 dark:ring-zinc-700/50 bg-zinc-50 dark:bg-zinc-800/30"}`}
                >
                  <div className="flex items-center justify-between p-3">
                    <button
                      onClick={() => onToggleTool("updateCounter")}
                      className="flex items-center gap-2 hover:bg-black/5 dark:hover:bg-white/5 transition-colors rounded-md px-1 -ml-1"
                    >
                      <Gauge
                        className={`h-4 w-4 ${toolsEnabled.updateCounter ? "text-emerald-500" : "text-zinc-400"}`}
                      />
                      <span className="text-xs font-medium text-zinc-900 dark:text-zinc-100">
                        Counter
                      </span>
                    </button>
                    <div className="flex items-center gap-2">
                      <ToolInfoHoverCard
                        metadata={toolMetadata.updateCounter}
                      />
                      <button
                        onClick={() => onToggleTool("updateCounter")}
                        className={`relative text-[9px] font-mono font-semibold uppercase tracking-wider px-2 py-1 rounded-md transition-all ${
                          toolsEnabled.updateCounter
                            ? "bg-emerald-500/20 text-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.4)]"
                            : "bg-zinc-200 dark:bg-zinc-700 text-zinc-500"
                        }`}
                      >
                        {toolsEnabled.updateCounter ? "ON" : "OFF"}
                      </button>
                    </div>
                  </div>
                  <div className="px-3 pb-3 pt-1">
                    <p className="text-2xl font-light text-zinc-900 dark:text-white tabular-nums mb-2">
                      {dashboardState.counter}
                    </p>
                    <div className="flex gap-1">
                      <button
                        onClick={onDecrementCounter}
                        className="flex-1 flex items-center justify-center py-1.5 rounded-lg bg-white dark:bg-zinc-800 ring-1 ring-zinc-200 dark:ring-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
                      >
                        <Minus className="h-3.5 w-3.5 text-zinc-500" />
                      </button>
                      <button
                        onClick={onIncrementCounter}
                        className="flex-1 flex items-center justify-center py-1.5 rounded-lg bg-white dark:bg-zinc-800 ring-1 ring-zinc-200 dark:ring-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
                      >
                        <Plus className="h-3.5 w-3.5 text-zinc-500" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Preference Tool + State */}
                <div
                  className={`rounded-xl ring-1 overflow-hidden ${toolsEnabled.updatePreference ? "ring-emerald-500/40 bg-emerald-500/5 dark:bg-emerald-500/10" : "ring-zinc-200 dark:ring-zinc-700/50 bg-zinc-50 dark:bg-zinc-800/30"}`}
                >
                  <div className="flex items-center justify-between p-3">
                    <button
                      onClick={() => onToggleTool("updatePreference")}
                      className="flex items-center gap-2 hover:bg-black/5 dark:hover:bg-white/5 transition-colors rounded-md px-1 -ml-1"
                    >
                      <Settings2
                        className={`h-4 w-4 ${toolsEnabled.updatePreference ? "text-emerald-500" : "text-zinc-400"}`}
                      />
                      <span className="text-xs font-medium text-zinc-900 dark:text-zinc-100">
                        Preference
                      </span>
                    </button>
                    <div className="flex items-center gap-2">
                      <ToolInfoHoverCard
                        metadata={toolMetadata.updatePreference}
                      />
                      <button
                        onClick={() => onToggleTool("updatePreference")}
                        className={`relative text-[9px] font-mono font-semibold uppercase tracking-wider px-2 py-1 rounded-md transition-all ${
                          toolsEnabled.updatePreference
                            ? "bg-emerald-500/20 text-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.4)]"
                            : "bg-zinc-200 dark:bg-zinc-700 text-zinc-500"
                        }`}
                      >
                        {toolsEnabled.updatePreference ? "ON" : "OFF"}
                      </button>
                    </div>
                  </div>
                  <div className="px-3 pb-3 pt-1">
                    <p className="text-xl font-mono font-medium text-indigo-600 dark:text-indigo-400">
                      {dashboardState.userPreference}
                    </p>
                    <p className="text-[9px] text-zinc-400 font-mono mt-1">
                      set via AI tool
                    </p>
                  </div>
                </div>

                {/* Cart Tool + State */}
                <div
                  className={`rounded-xl ring-1 overflow-hidden ${toolsEnabled.updateCart ? "ring-emerald-500/40 bg-emerald-500/5 dark:bg-emerald-500/10" : "ring-zinc-200 dark:ring-zinc-700/50 bg-zinc-50 dark:bg-zinc-800/30"}`}
                >
                  <div className="flex items-center justify-between p-3">
                    <button
                      onClick={() => onToggleTool("updateCart")}
                      className="flex items-center gap-2 hover:bg-black/5 dark:hover:bg-white/5 transition-colors rounded-md px-1 -ml-1"
                    >
                      <ShoppingCart
                        className={`h-4 w-4 ${toolsEnabled.updateCart ? "text-emerald-500" : "text-zinc-400"}`}
                      />
                      <span className="text-xs font-medium text-zinc-900 dark:text-zinc-100">
                        Cart
                      </span>
                    </button>
                    <div className="flex items-center gap-2">
                      <ToolInfoHoverCard metadata={toolMetadata.updateCart} />
                      <button
                        onClick={() => onToggleTool("updateCart")}
                        className={`relative text-[9px] font-mono font-semibold uppercase tracking-wider px-2 py-1 rounded-md transition-all ${
                          toolsEnabled.updateCart
                            ? "bg-emerald-500/20 text-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.4)]"
                            : "bg-zinc-200 dark:bg-zinc-700 text-zinc-500"
                        }`}
                      >
                        {toolsEnabled.updateCart ? "ON" : "OFF"}
                      </button>
                    </div>
                  </div>
                  <div className="px-3 pb-3 pt-1">
                    <p className="text-2xl font-light text-zinc-900 dark:text-white tabular-nums mb-2">
                      {dashboardState.cartItems}
                    </p>
                    <div className="flex gap-1">
                      <button
                        onClick={onAddToCart}
                        className="flex-1 flex items-center justify-center py-1.5 rounded-lg bg-white dark:bg-zinc-800 ring-1 ring-zinc-200 dark:ring-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
                      >
                        <Plus className="h-3.5 w-3.5 text-zinc-500" />
                      </button>
                      <button
                        onClick={onClearCart}
                        className="flex items-center justify-center px-3 py-1.5 rounded-lg bg-white dark:bg-zinc-800 ring-1 ring-zinc-200 dark:ring-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5 text-zinc-400" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Screenshot Tool (Built-in) */}
                <div
                  className={`rounded-xl ring-1 overflow-hidden ${toolsEnabled.captureScreenshot ? "ring-emerald-500/40 bg-emerald-500/5 dark:bg-emerald-500/10" : "ring-zinc-200 dark:ring-zinc-700/50 bg-zinc-50 dark:bg-zinc-800/30"}`}
                >
                  <div className="flex items-center justify-between p-3">
                    <button
                      onClick={() => onToggleTool("captureScreenshot")}
                      className="flex items-center gap-2 hover:bg-black/5 dark:hover:bg-white/5 transition-colors rounded-md px-1 -ml-1"
                    >
                      <Camera
                        className={`h-4 w-4 ${toolsEnabled.captureScreenshot ? "text-emerald-500" : "text-zinc-400"}`}
                      />
                      <span className="text-xs font-medium text-zinc-900 dark:text-zinc-100">
                        Screenshot
                      </span>
                    </button>
                    <div className="flex items-center gap-2">
                      <ToolInfoHoverCard
                        metadata={toolMetadata.captureScreenshot}
                      />
                      <button
                        onClick={() => onToggleTool("captureScreenshot")}
                        className={`relative text-[9px] font-mono font-semibold uppercase tracking-wider px-2 py-1 rounded-md transition-all ${
                          toolsEnabled.captureScreenshot
                            ? "bg-emerald-500/20 text-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.4)]"
                            : "bg-zinc-200 dark:bg-zinc-700 text-zinc-500"
                        }`}
                      >
                        {toolsEnabled.captureScreenshot ? "ON" : "OFF"}
                      </button>
                    </div>
                  </div>
                  <div className="px-3 pb-3 pt-1">
                    <p className="text-[10px] text-zinc-500 font-mono">
                      Captures current page
                    </p>
                    <p className="text-[9px] text-zinc-400 font-mono mt-1">
                      built-in tool
                    </p>
                  </div>
                </div>

                {/* Console Logs Tool (Built-in) */}
                <div
                  className={`rounded-xl ring-1 overflow-hidden ${toolsEnabled.getConsoleLogs ? "ring-emerald-500/40 bg-emerald-500/5 dark:bg-emerald-500/10" : "ring-zinc-200 dark:ring-zinc-700/50 bg-zinc-50 dark:bg-zinc-800/30"}`}
                >
                  <div className="flex items-center justify-between p-3">
                    <button
                      onClick={() => onToggleTool("getConsoleLogs")}
                      className="flex items-center gap-2 hover:bg-black/5 dark:hover:bg-white/5 transition-colors rounded-md px-1 -ml-1"
                    >
                      <ScrollText
                        className={`h-4 w-4 ${toolsEnabled.getConsoleLogs ? "text-emerald-500" : "text-zinc-400"}`}
                      />
                      <span className="text-xs font-medium text-zinc-900 dark:text-zinc-100">
                        Console
                      </span>
                    </button>
                    <div className="flex items-center gap-2">
                      <ToolInfoHoverCard
                        metadata={toolMetadata.getConsoleLogs}
                      />
                      <button
                        onClick={() => onToggleTool("getConsoleLogs")}
                        className={`relative text-[9px] font-mono font-semibold uppercase tracking-wider px-2 py-1 rounded-md transition-all ${
                          toolsEnabled.getConsoleLogs
                            ? "bg-emerald-500/20 text-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.4)]"
                            : "bg-zinc-200 dark:bg-zinc-700 text-zinc-500"
                        }`}
                      >
                        {toolsEnabled.getConsoleLogs ? "ON" : "OFF"}
                      </button>
                    </div>
                  </div>
                  <div className="px-3 pb-3 pt-1">
                    <p className="text-[10px] text-zinc-500 font-mono">
                      Gets browser logs
                    </p>
                    <p className="text-[9px] text-zinc-400 font-mono mt-1">
                      built-in tool
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Generative UI */}
        <AccordionItem
          value="generative"
          className="border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900/50"
        >
          <AccordionTrigger className="px-5 py-4 hover:no-underline hover:bg-zinc-50 dark:hover:bg-zinc-800/30">
            <div className="flex items-center gap-4">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-violet-500/10 ring-1 ring-violet-500/20">
                <Layers className="h-4 w-4 text-violet-500" />
              </div>
              <div className="text-left">
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  Generative UI
                </p>
                <p className="text-[10px] text-zinc-500 font-mono">
                  dynamic components
                </p>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-5 pt-1 pb-5">
            <div className="space-y-4">
              <div className="flex items-center gap-5">
                {generativeUIKeys.map((key) => (
                  <div key={key} className="flex items-center gap-2.5">
                    <label className="flex items-center gap-2.5 cursor-pointer group">
                      <ToggleSwitch
                        size="sm"
                        active={generativeUI[key]}
                        onChange={() => onToggleGenerativeUI(key)}
                      />
                      <span className="text-xs font-mono text-zinc-500 group-hover:text-zinc-700 dark:group-hover:text-zinc-300 capitalize transition-colors">
                        {key}
                      </span>
                    </label>
                    <ConfigInfoHoverCard
                      description={configMetadata.generativeUI[key].description}
                      tip={configMetadata.generativeUI[key].tip}
                      codeSnippet={configMetadata.generativeUI[key].codeSnippet}
                      codeLabel={configMetadata.generativeUI[key].codeLabel}
                    />
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-3">
                <WeatherModule show={generativeUI.weather} />
                <StockModule show={generativeUI.stock} />
                <AlertModule show={generativeUI.notification} />
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Context Demo */}
        <AccordionItem
          value="context"
          className="border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900/50"
        >
          <AccordionTrigger className="px-5 py-4 hover:no-underline hover:bg-zinc-50 dark:hover:bg-zinc-800/30">
            <div className="flex items-center gap-4">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-cyan-500/10 ring-1 ring-cyan-500/20">
                <Sparkles className="h-4 w-4 text-cyan-500" />
              </div>
              <div className="text-left">
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  Context Demo
                </p>
                <p className="text-[10px] text-zinc-500 font-mono">
                  useAIContext hook
                </p>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-5 pt-1 pb-5">
            <div className="grid grid-cols-2 gap-5">
              <div>
                <div className="flex items-center gap-1 mb-3">
                  <User className="h-3.5 w-3.5 text-zinc-400" />
                  <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-zinc-500">
                    User Profile
                  </span>
                  <ConfigInfoHoverCard
                    description={configMetadata.context.description}
                    tip={configMetadata.context.tip}
                    codeSnippet={configMetadata.context.codeSnippet}
                    codeLabel={configMetadata.context.codeLabel}
                  />
                </div>
                <div className="space-y-2">
                  {samplePersons.map((person) => (
                    <button
                      key={person.id}
                      onClick={() => onSelectPerson(person)}
                      className={`w-full text-left p-3 rounded-xl transition-all ${
                        selectedPerson.id === person.id
                          ? "bg-cyan-500/10 ring-2 ring-cyan-500/50"
                          : "bg-zinc-50 dark:bg-zinc-800/30 ring-1 ring-zinc-200 dark:ring-zinc-700/50 hover:ring-zinc-300"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-xs font-medium text-zinc-900 dark:text-zinc-100">
                          {person.name}
                        </span>
                        <span
                          className={`text-[8px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded-full ${
                            person.plan === "enterprise"
                              ? "bg-violet-500/20 text-violet-600 dark:text-violet-400"
                              : person.plan === "pro"
                                ? "bg-blue-500/20 text-blue-600 dark:text-blue-400"
                                : "bg-zinc-200 dark:bg-zinc-700 text-zinc-500"
                          }`}
                        >
                          {person.plan}
                        </span>
                      </div>
                      <p className="text-[10px] text-zinc-500 font-mono">
                        {person.role} · {person.credits.toLocaleString()}{" "}
                        credits
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <SectionLabel icon={Terminal} label="AI Context" />
                  <div className="rounded-xl bg-zinc-950 p-3 ring-1 ring-zinc-800">
                    <pre className="text-[10px] font-mono text-cyan-400 leading-relaxed overflow-x-auto">
                      {`{
  "name": "${selectedPerson.name}",
  "plan": "${selectedPerson.plan}",
  "credits": ${selectedPerson.credits}
}`}
                    </pre>
                  </div>
                </div>

                <div>
                  <SectionLabel icon={Sparkles} label="Try Asking" />
                  <div className="space-y-1.5">
                    {exampleQuestions.map((q, i) => (
                      <div
                        key={i}
                        className="px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 ring-1 ring-zinc-200 dark:ring-zinc-700/50 text-[10px] font-mono text-zinc-600 dark:text-zinc-400"
                      >
                        &quot;{q}&quot;
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}

export const ControlPanel = memo(ControlPanelComponent);
