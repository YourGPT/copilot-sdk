"use client";

import Link from "next/link";
import { ProviderLogo, type Provider } from "./provider-logo";
import { cn } from "@/lib/utils";
import {
  ImageIcon,
  Sparkles,
  Braces,
  Wrench,
  ListTree,
  Zap,
  Globe,
  Server,
} from "lucide-react";

type Feature =
  | "image-input"
  | "image-generation"
  | "object-generation"
  | "tool-usage"
  | "tool-streaming"
  | "fast-inference"
  | "long-context"
  | "local";

const featureConfig: Record<
  Feature,
  { label: string; icon: React.ComponentType<{ className?: string }> }
> = {
  "image-input": { label: "Image Input", icon: ImageIcon },
  "image-generation": { label: "Image Generation", icon: Sparkles },
  "object-generation": { label: "Object Generation", icon: Braces },
  "tool-usage": { label: "Tool Usage", icon: Wrench },
  "tool-streaming": { label: "Tool Streaming", icon: ListTree },
  "fast-inference": { label: "Fast Inference", icon: Zap },
  "long-context": { label: "Long Context", icon: Globe },
  local: { label: "Local", icon: Server },
};

interface ProviderCardData {
  id: Provider | "custom";
  name: string;
  href: string;
  features: Feature[];
}

const providers: ProviderCardData[] = [
  {
    id: "openai",
    name: "OpenAI",
    href: "/docs/providers/openai",
    features: [
      "image-input",
      "image-generation",
      "object-generation",
      "tool-usage",
      "tool-streaming",
    ],
  },
  {
    id: "anthropic",
    name: "Anthropic",
    href: "/docs/providers/anthropic",
    features: [
      "image-input",
      "object-generation",
      "tool-usage",
      "tool-streaming",
      "long-context",
    ],
  },
  {
    id: "google",
    name: "Google Generative AI",
    href: "/docs/providers/google",
    features: [
      "image-input",
      "object-generation",
      "tool-usage",
      "tool-streaming",
      "long-context",
    ],
  },
  {
    id: "groq",
    name: "Groq",
    href: "/docs/providers/groq",
    features: [
      "image-input",
      "object-generation",
      "tool-usage",
      "tool-streaming",
      "fast-inference",
    ],
  },
  {
    id: "mistral",
    name: "Mistral AI",
    href: "/docs/providers/mistral",
    features: [
      "image-input",
      "object-generation",
      "tool-usage",
      "tool-streaming",
    ],
  },
  {
    id: "azure",
    name: "Azure OpenAI",
    href: "/docs/providers/azure",
    features: [
      "image-input",
      "image-generation",
      "object-generation",
      "tool-usage",
      "tool-streaming",
    ],
  },
  {
    id: "ollama",
    name: "Ollama",
    href: "/docs/providers/ollama",
    features: ["image-input", "object-generation", "tool-usage", "local"],
  },
];

function FeatureBadge({ feature }: { feature: Feature }) {
  const config = featureConfig[feature];
  const Icon = config.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs",
        "bg-fd-muted/50 text-fd-muted-foreground",
        "border border-fd-border/50",
      )}
    >
      <Icon className="h-3 w-3" />
      {config.label}
    </span>
  );
}

export function ProviderCards() {
  return (
    <div className="not-prose grid grid-cols-1 md:grid-cols-2 gap-4">
      {providers.map((provider) => (
        <Link
          key={provider.id}
          href={provider.href}
          className={cn(
            "group flex flex-col rounded-xl border overflow-hidden",
            "bg-fd-card hover:bg-fd-accent/30",
            "border-fd-border hover:border-fd-primary/40",
            "transition-all duration-200 hover:shadow-lg",
          )}
        >
          {/* Header with name */}
          <div className="px-5 pt-5 pb-2">
            <h3 className="text-lg font-semibold text-fd-foreground m-0">
              {provider.name}
            </h3>
          </div>

          {/* Logo area */}
          <div className="flex items-center justify-center py-8 px-5">
            <ProviderLogo
              provider={provider.id as Provider}
              className="h-20 w-20 transition-transform duration-200 group-hover:scale-110"
            />
          </div>

          {/* Features */}
          <div className="px-5 pb-5">
            <div className="flex flex-wrap gap-2">
              {provider.features.map((feature) => (
                <FeatureBadge key={feature} feature={feature} />
              ))}
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
