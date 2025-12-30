import defaultMdxComponents from "fumadocs-ui/mdx";
import type { MDXComponents } from "mdx/types";
import { ProviderLogosGrid } from "@/components/provider-logos-grid";
import { ProviderLogo } from "@/components/provider-logo";
import { ProviderCards } from "@/components/provider-cards";
import { ProviderHeader } from "@/components/provider-header";

export function getMDXComponents(components?: MDXComponents): MDXComponents {
  return {
    ...defaultMdxComponents,
    ProviderLogosGrid,
    ProviderLogo,
    ProviderCards,
    ProviderHeader,
    ...components,
  };
}
