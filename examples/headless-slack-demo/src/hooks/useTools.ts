import { useTool } from "@yourgpt/copilot-sdk/react";

export function useCalculatorTool() {
  useTool({
    name: "calculate",
    description: "Perform a mathematical calculation",
    inputSchema: {
      type: "object",
      properties: {
        expression: {
          type: "string",
          description: 'Math expression to evaluate, e.g. "2 + 2 * 10"',
        },
      },
      required: ["expression"],
    },
    handler: async ({ expression }: { expression: string }) => {
      try {
        // Safe eval using Function (client-side only)
        const result = Function(`"use strict"; return (${expression})`)();
        return { success: true, data: { expression, result } };
      } catch {
        return { success: false, error: `Invalid expression: ${expression}` };
      }
    },
  });
}

export function useTimeTool() {
  useTool({
    name: "get_time",
    description: "Get the current time and date, optionally for a timezone",
    inputSchema: {
      type: "object",
      properties: {
        timezone: {
          type: "string",
          description: 'Timezone (e.g. "America/New_York"). Defaults to local.',
        },
      },
    },
    handler: async ({ timezone }: { timezone?: string }) => {
      const now = new Date();
      const formatted = now.toLocaleString("en-US", {
        timeZone: timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
      return {
        success: true,
        data: {
          formatted,
          iso: now.toISOString(),
          timezone:
            timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
      };
    },
  });
}
