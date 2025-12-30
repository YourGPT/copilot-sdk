"use client";

import { ProviderLogo, type Provider } from "./provider-logo";
import { cn } from "@/lib/utils";

interface ProviderHeaderProps {
  provider: Provider;
  name: string;
  description: string;
  gradient?: string;
}

const defaultGradients: Record<Provider, string> = {
  openai: "from-emerald-500/5 to-green-500/10",
  anthropic: "from-orange-500/5 to-amber-500/10",
  google: "from-blue-500/5 to-indigo-500/10",
  gemini: "from-blue-500/5 to-indigo-500/10",
  groq: "from-red-500/5 to-orange-500/10",
  mistral: "from-orange-500/5 to-yellow-500/10",
  azure: "from-blue-500/5 to-cyan-500/10",
  ollama: "from-zinc-500/5 to-slate-500/10",
};

export function ProviderHeader({
  provider,
  name,
  description,
  gradient,
}: ProviderHeaderProps) {
  const gradientClass = gradient || defaultGradients[provider];

  return (
    <div
      className={cn(
        "not-prose mb-8 p-6 rounded-xl border bg-gradient-to-br",
        gradientClass,
      )}
    >
      <div className="flex items-center gap-4">
        <div className="p-3 rounded-xl bg-fd-background/80 border border-fd-border/50">
          <ProviderLogo provider={provider} className="h-10 w-10" />
        </div>
        <div>
          <h2 className="text-2xl font-bold m-0 text-fd-foreground">{name}</h2>
          <p className="text-fd-muted-foreground m-0">{description}</p>
        </div>
      </div>
    </div>
  );
}
