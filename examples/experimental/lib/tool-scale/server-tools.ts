import type { ToolDefinition } from "@yourgpt/llm-sdk";

import { serverToolSeeds } from "@/lib/tool-scale/catalog";

const sharedInputSchema = {
  type: "object" as const,
  properties: {
    task: {
      type: "string",
      description: "What the tool should help with in this simulation.",
    },
    target: {
      type: "string",
      description: "Optional object, account, page, or entity to inspect.",
    },
  },
};

export const toolScaleServerTools: ToolDefinition[] = serverToolSeeds.map(
  (seed) => ({
    name: seed.name,
    description: seed.description,
    location: "server",
    category: seed.category,
    group: seed.group,
    profiles: seed.profiles,
    deferLoading: seed.deferLoading,
    searchKeywords: seed.searchKeywords,
    inputSchema: sharedInputSchema,
    handler: async (params) => {
      const args = (params ?? {}) as { task?: string; target?: string };

      return {
        tool: seed.name,
        title: seed.title,
        location: seed.location,
        category: seed.category,
        group: seed.group,
        matchedProfiles: seed.profiles,
        deferred: seed.deferLoading,
        requestedTask: args.task ?? "general assistance",
        target: args.target ?? "current context",
        summary: `${seed.title} returned a simulated ${seed.category} response for the scale-test example.`,
        guidance: [
          `Use ${seed.title.toLowerCase()} when the user needs ${seed.group} help.`,
          `This tool belongs to the ${seed.category} category and is tagged for ${seed.profiles.join(", ")} profiles.`,
        ],
      };
    },
  }),
);
