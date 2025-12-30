"use client";

import { ProviderLogo, type Provider } from "./provider-logo";
import { cn } from "@/lib/utils";

const providers: { id: Provider; name: string }[] = [
  { id: "openai", name: "OpenAI" },
  { id: "anthropic", name: "Anthropic" },
  { id: "google", name: "Google" },
  { id: "mistral", name: "Mistral" },
  { id: "groq", name: "Groq" },
  { id: "azure", name: "Azure" },
  { id: "ollama", name: "Ollama" },
];

interface ProviderLogosGridProps {
  className?: string;
}

export function ProviderLogosGrid({ className }: ProviderLogosGridProps) {
  return (
    <div
      className={cn(
        "not-prose mb-8 rounded-xl overflow-hidden border bg-gradient-to-br from-fd-primary/5 via-fd-primary/10 to-fd-primary/5",
        className,
      )}
    >
      <div className="py-12 px-6">
        <div className="flex flex-wrap items-center justify-center gap-8 md:gap-12">
          {providers.map((provider) => (
            <div
              key={provider.id}
              className="flex flex-col items-center gap-2 group"
            >
              <div className="p-4 rounded-xl bg-fd-background/50 border border-fd-border/50 transition-all duration-200 group-hover:border-fd-primary/30 group-hover:shadow-lg group-hover:scale-105">
                <ProviderLogo
                  provider={provider.id}
                  className="h-10 w-10 md:h-12 md:w-12"
                />
              </div>
              <span className="text-xs text-fd-muted-foreground font-medium">
                {provider.name}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
