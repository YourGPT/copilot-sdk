"use client";

import { useEffect, useRef } from "react";
import type { ActionDefinition } from "../../core";
import { useCopilot } from "../provider/CopilotProvider";

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
  const { registerAction, unregisterAction } = useCopilot();

  // Callers almost always pass a fresh array literal — `useAIAction` below
  // does exactly that. Depending on the array identity would re-run this
  // effect every render, and registerAction bumps provider state, so the
  // render→effect→setState→render cycle never settles. Key on the action
  // names instead, which is what actually determines the registration.
  const actionsKey = actions.map((a) => a.name).join(",");

  // Keep the latest definitions reachable without widening the effect deps,
  // so handlers never go stale even though the effect does not re-run.
  const actionsRef = useRef(actions);
  actionsRef.current = actions;

  useEffect(() => {
    // Register all actions, indirecting through the ref at call time so the
    // registered handler always sees the current render's closure.
    const registered = actionsRef.current.map((action) => action.name);
    for (const action of actionsRef.current) {
      registerAction({
        ...action,
        handler: (...args: Parameters<ActionDefinition["handler"]>) => {
          const current = actionsRef.current.find(
            (a) => a.name === action.name,
          );
          return (current ?? action).handler(...args);
        },
      });
    }

    // Cleanup: unregister all actions
    return () => {
      for (const name of registered) {
        unregisterAction(name);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actionsKey, registerAction, unregisterAction]);
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
