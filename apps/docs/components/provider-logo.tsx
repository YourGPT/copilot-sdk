"use client";

import type { SVGProps } from "react";
import { cn } from "@/lib/utils";

// Import all provider logos
import { Openai } from "@/components/ui/svgs/openai";
import { OpenaiDark } from "@/components/ui/svgs/openaiDark";
import { AnthropicBlack } from "@/components/ui/svgs/anthropicBlack";
import { AnthropicWhite } from "@/components/ui/svgs/anthropicWhite";
import { Gemini } from "@/components/ui/svgs/gemini";
import { MistralAiLogo } from "@/components/ui/svgs/mistralAiLogo";
import { Groq } from "@/components/ui/svgs/groq";
import { Azure } from "@/components/ui/svgs/azure";
import { OllamaLight } from "@/components/ui/svgs/ollamaLight";
import { OllamaDark } from "@/components/ui/svgs/ollamaDark";

export type Provider =
  | "openai"
  | "anthropic"
  | "google"
  | "gemini"
  | "groq"
  | "mistral"
  | "azure"
  | "ollama";

interface ProviderLogoProps extends SVGProps<SVGSVGElement> {
  provider: Provider;
  className?: string;
}

/**
 * Provider logo component that automatically handles light/dark theme
 * Uses CSS to show/hide appropriate logo variant based on theme
 */
export function ProviderLogo({
  provider,
  className,
  ...props
}: ProviderLogoProps) {
  const baseClass = cn("h-8 w-8", className);

  switch (provider) {
    case "openai":
      return (
        <>
          <Openai
            className={cn(baseClass, "dark:hidden fill-current")}
            {...props}
          />
          <OpenaiDark
            className={cn(baseClass, "hidden dark:block fill-current")}
            {...props}
          />
        </>
      );

    case "anthropic":
      return (
        <>
          <AnthropicBlack
            className={cn(baseClass, "dark:hidden fill-current")}
            {...props}
          />
          <AnthropicWhite
            className={cn(baseClass, "hidden dark:block fill-current")}
            {...props}
          />
        </>
      );

    case "google":
    case "gemini":
      return <Gemini className={baseClass} {...props} />;

    case "mistral":
      return <MistralAiLogo className={baseClass} {...props} />;

    case "groq":
      return <Groq className={cn(baseClass, "rounded")} {...props} />;

    case "azure":
      return <Azure className={baseClass} {...props} />;

    case "ollama":
      return (
        <>
          <OllamaLight className={cn(baseClass, "dark:hidden")} {...props} />
          <OllamaDark
            className={cn(baseClass, "hidden dark:block")}
            {...props}
          />
        </>
      );

    default:
      return null;
  }
}

// Export individual logos for direct use if needed
export {
  Openai,
  OpenaiDark,
  AnthropicBlack,
  AnthropicWhite,
  Gemini,
  MistralAiLogo,
  Groq,
  Azure,
  OllamaLight,
  OllamaDark,
};
