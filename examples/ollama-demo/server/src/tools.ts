/**
 * Server-side tool definitions for the Ollama demo.
 * These tools are registered on the runtime and available to the AI.
 */

export const serverTools = [
  {
    name: "get_weather",
    description: "Get weather for a location",
    location: "server" as const,
    inputSchema: {
      type: "object" as const,
      properties: {
        location: { type: "string", description: "City name" },
      },
      required: ["location"],
    },
    handler: async (params: { location: string }) => {
      // Simulate weather API
      return {
        success: true,
        data: {
          location: params.location,
          temperature: Math.floor(Math.random() * 30) + 10,
          condition: ["sunny", "cloudy", "rainy"][
            Math.floor(Math.random() * 3)
          ],
        },
      };
    },
  },
  {
    name: "calculate",
    description: "Calculate a math expression",
    location: "server" as const,
    inputSchema: {
      type: "object" as const,
      properties: {
        expression: { type: "string", description: "Math expression" },
      },
      required: ["expression"],
    },
    handler: async (params: { expression: string }) => {
      try {
        const result = Function(
          `"use strict"; return (${params.expression})`,
        )();
        return { success: true, data: { result } };
      } catch {
        return { success: false, error: "Invalid expression" };
      }
    },
  },
];
