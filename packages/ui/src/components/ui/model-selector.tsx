"use client";

import * as React from "react";
import { cn } from "../../lib/utils";
import { CapabilityList } from "./capability-badge";

// ============================================
// Types
// ============================================

export interface ModelOption {
  /** Model ID */
  id: string;
  /** Display name */
  name?: string;
  /** Provider name */
  provider?: string;
  /** Model capabilities (optional, for showing badges) */
  capabilities?: {
    supportsVision?: boolean;
    supportsTools?: boolean;
    supportsThinking?: boolean;
    supportsStreaming?: boolean;
    supportsPDF?: boolean;
    supportsAudio?: boolean;
    supportsVideo?: boolean;
    supportsJsonMode?: boolean;
  };
}

export interface ProviderGroup {
  /** Provider name */
  name: string;
  /** Provider display label */
  label?: string;
  /** Models in this provider */
  models: ModelOption[];
}

export interface ModelSelectorProps {
  /** Currently selected model ID */
  value?: string;
  /** Called when selection changes */
  onChange?: (modelId: string, provider?: string) => void;
  /** Models grouped by provider */
  providers?: ProviderGroup[];
  /** Flat list of models (alternative to providers) */
  models?: ModelOption[];
  /** Current capabilities (for showing in header) */
  currentCapabilities?: ModelOption["capabilities"];
  /** Placeholder text */
  placeholder?: string;
  /** Disabled state */
  disabled?: boolean;
  /** Size variant */
  size?: "sm" | "md" | "lg";
  /** Show capability badges */
  showCapabilities?: boolean;
  /** Additional class name */
  className?: string;
}

// ============================================
// Component
// ============================================

/**
 * Model selector dropdown with provider grouping
 *
 * @example
 * ```tsx
 * const { provider, model, supportedModels } = useCapabilities();
 *
 * <ModelSelector
 *   value={model}
 *   onChange={(modelId) => console.log('Selected:', modelId)}
 *   providers={[
 *     {
 *       name: 'openai',
 *       label: 'OpenAI',
 *       models: [
 *         { id: 'gpt-4o', name: 'GPT-4o' },
 *         { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
 *       ],
 *     },
 *   ]}
 * />
 * ```
 */
export function ModelSelector({
  value,
  onChange,
  providers,
  models,
  currentCapabilities,
  placeholder = "Select model...",
  disabled = false,
  size = "md",
  showCapabilities = true,
  className,
}: ModelSelectorProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Close on outside click
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Find selected model info
  const selectedModel = React.useMemo(() => {
    if (!value) return null;

    // Check providers first
    if (providers) {
      for (const provider of providers) {
        const model = provider.models.find((m) => m.id === value);
        if (model) return { ...model, provider: provider.name };
      }
    }

    // Check flat models list
    if (models) {
      return models.find((m) => m.id === value) || null;
    }

    return null;
  }, [value, providers, models]);

  const sizeClasses = {
    sm: "h-8 text-xs px-2",
    md: "h-9 text-sm px-3",
    lg: "h-10 text-base px-4",
  };

  const handleSelect = (modelId: string, provider?: string) => {
    onChange?.(modelId, provider);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={cn(
          "flex items-center justify-between gap-2 w-full rounded-md border bg-background",
          "hover:bg-accent hover:text-accent-foreground",
          "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
          "disabled:cursor-not-allowed disabled:opacity-50",
          sizeClasses[size],
        )}
      >
        <div className="flex items-center gap-2 min-w-0">
          {selectedModel ? (
            <>
              <span className="truncate font-medium">
                {selectedModel.name || selectedModel.id}
              </span>
              {selectedModel.provider && (
                <span className="text-muted-foreground text-[10px] uppercase">
                  {selectedModel.provider}
                </span>
              )}
            </>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
        </div>

        {/* Chevron */}
        <svg
          className={cn(
            "w-4 h-4 flex-shrink-0 text-muted-foreground transition-transform",
            isOpen && "rotate-180",
          )}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {/* Show capabilities below button if provided */}
      {showCapabilities && currentCapabilities && (
        <div className="mt-1">
          <CapabilityList
            capabilities={currentCapabilities}
            size="sm"
            onlySupported
          />
        </div>
      )}

      {/* Dropdown */}
      {isOpen && (
        <div
          className={cn(
            "absolute z-50 top-full left-0 right-0 mt-1",
            "max-h-[300px] overflow-auto",
            "rounded-md border bg-popover text-popover-foreground shadow-md",
            "animate-in fade-in-0 zoom-in-95",
          )}
        >
          {/* Providers with groups */}
          {providers?.map((provider) => (
            <div key={provider.name}>
              {/* Provider header */}
              <div className="px-2 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider bg-muted/50">
                {provider.label || provider.name}
              </div>

              {/* Models */}
              {provider.models.map((model) => (
                <button
                  key={model.id}
                  type="button"
                  onClick={() => handleSelect(model.id, provider.name)}
                  className={cn(
                    "flex flex-col gap-0.5 w-full px-3 py-2 text-left",
                    "hover:bg-accent hover:text-accent-foreground",
                    "focus:bg-accent focus:text-accent-foreground focus:outline-none",
                    value === model.id && "bg-accent",
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">
                      {model.name || model.id}
                    </span>
                    {value === model.id && (
                      <svg
                        className="w-4 h-4 text-primary"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    )}
                  </div>
                  {showCapabilities && model.capabilities && (
                    <CapabilityList
                      capabilities={model.capabilities}
                      size="sm"
                      onlySupported
                    />
                  )}
                </button>
              ))}
            </div>
          ))}

          {/* Flat models list */}
          {models?.map((model) => (
            <button
              key={model.id}
              type="button"
              onClick={() => handleSelect(model.id, model.provider)}
              className={cn(
                "flex flex-col gap-0.5 w-full px-3 py-2 text-left",
                "hover:bg-accent hover:text-accent-foreground",
                "focus:bg-accent focus:text-accent-foreground focus:outline-none",
                value === model.id && "bg-accent",
              )}
            >
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">
                  {model.name || model.id}
                </span>
                {model.provider && (
                  <span className="text-muted-foreground text-[10px] uppercase">
                    {model.provider}
                  </span>
                )}
                {value === model.id && (
                  <svg
                    className="w-4 h-4 text-primary ml-auto"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                )}
              </div>
              {showCapabilities && model.capabilities && (
                <CapabilityList
                  capabilities={model.capabilities}
                  size="sm"
                  onlySupported
                />
              )}
            </button>
          ))}

          {/* Empty state */}
          {!providers?.length && !models?.length && (
            <div className="px-3 py-4 text-center text-sm text-muted-foreground">
              No models available
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================
// Simple Model Selector (just a native select)
// ============================================

export interface SimpleModelSelectorProps {
  /** Currently selected model ID */
  value?: string;
  /** Called when selection changes */
  onChange?: (modelId: string) => void;
  /** List of model IDs */
  models: string[];
  /** Disabled state */
  disabled?: boolean;
  /** Additional class name */
  className?: string;
}

/**
 * Simple native select for model selection
 *
 * @example
 * ```tsx
 * const { model, supportedModels } = useCapabilities();
 *
 * <SimpleModelSelector
 *   value={model}
 *   onChange={(id) => console.log('Selected:', id)}
 *   models={supportedModels}
 * />
 * ```
 */
export function SimpleModelSelector({
  value,
  onChange,
  models,
  disabled = false,
  className,
}: SimpleModelSelectorProps) {
  return (
    <select
      value={value || ""}
      onChange={(e) => onChange?.(e.target.value)}
      disabled={disabled}
      className={cn(
        "h-9 px-3 rounded-md border bg-background text-sm",
        "focus:outline-none focus:ring-2 focus:ring-ring",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
    >
      <option value="" disabled>
        Select model...
      </option>
      {models.map((modelId) => (
        <option key={modelId} value={modelId}>
          {modelId}
        </option>
      ))}
    </select>
  );
}
