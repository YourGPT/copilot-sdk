"use client";

import { useEffect } from "react";
import type { ActionDefinition } from "@yourgpt/copilot-sdk-core";
import { useCopilotContext } from "../context/CopilotContext";

/**
 * Hook to register multiple AI actions/tools
 *
 * @example
 * ```tsx
 * useAIActions([
 *   {
 *     name: 'getWeather',
 *     description: 'Get weather for a location',
 *     parameters: {
 *       location: { type: 'string', required: true, description: 'City name' },
 *     },
 *     handler: async ({ location }) => {
 *       const weather = await fetchWeather(location);
 *       return weather;
 *     },
 *   },
 * ]);
 * ```
 */
export function useAIActions(actions: ActionDefinition[]): void {
  const { registerAction, unregisterAction } = useCopilotContext();

  useEffect(() => {
    // Register all actions
    for (const action of actions) {
      registerAction(action);
    }

    // Cleanup: unregister all actions
    return () => {
      for (const action of actions) {
        unregisterAction(action.name);
      }
    };
  }, [actions, registerAction, unregisterAction]);
}

/**
 * Hook to register a single AI action/tool
 *
 * @example
 * ```tsx
 * useAIAction({
 *   name: 'searchProducts',
 *   description: 'Search for products',
 *   parameters: {
 *     query: { type: 'string', required: true },
 *   },
 *   handler: async ({ query }) => {
 *     return await searchProducts(query);
 *   },
 * });
 * ```
 */
export function useAIAction(action: ActionDefinition): void {
  useAIActions([action]);
}
