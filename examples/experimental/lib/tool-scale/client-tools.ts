"use client";

import type { ToolSet } from "@yourgpt/copilot-sdk/react";

import { clientToolSeeds } from "@/lib/tool-scale/catalog";

const sharedInputSchema = {
  type: "object" as const,
  properties: {
    task: {
      type: "string" as const,
      description: "What the tool should help with in this simulation.",
    },
    target: {
      type: "string" as const,
      description: "Optional page element, record, or area of interest.",
    },
  },
};

export const toolScaleClientTools: ToolSet = Object.fromEntries(
  clientToolSeeds.map((seed) => [
    seed.name,
    {
      description: seed.description,
      location: "client",
      category: seed.category,
      group: seed.group,
      profiles: seed.profiles,
      deferLoading: seed.deferLoading,
      searchKeywords: seed.searchKeywords,
      inputSchema: sharedInputSchema,
      handler: async (params) => {
        const args = (params ?? {}) as { task?: string; target?: string };

        return {
          success: true,
          tool: seed.name,
          title: seed.title,
          location: seed.location,
          category: seed.category,
          group: seed.group,
          matchedProfiles: seed.profiles,
          deferred: seed.deferLoading,
          requestedTask: args.task ?? "general assistance",
          target: args.target ?? "active page",
          browserContext: {
            path:
              typeof window === "undefined" ? "/" : window.location.pathname,
            locale:
              typeof navigator === "undefined" ? "unknown" : navigator.language,
          },
          summary: `${seed.title} returned a simulated browser-side result for the scale-test example.`,
        };
      },
    },
  ]),
) as ToolSet;
