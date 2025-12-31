"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useCopilotContext } from "../context/CopilotContext";
import type { StreamEvent } from "@yourgpt/copilot-sdk-core";
import { streamSSE } from "@yourgpt/copilot-sdk-core";

/**
 * useAgent options
 */
export interface UseAgentOptions<TState = Record<string, unknown>> {
  /** Agent name */
  name: string;
  /** Initial state */
  initialState?: TState;
  /** Called when agent state changes */
  onStateChange?: (state: TState) => void;
}

/**
 * useAgent return type
 */
export interface UseAgentReturn<TState = Record<string, unknown>> {
  /** Current agent state */
  state: TState;
  /** Whether agent is running */
  isRunning: boolean;
  /** Current node name (for graph-based agents) */
  nodeName: string | null;
  /** Start the agent */
  start: (input?: string | Record<string, unknown>) => Promise<void>;
  /** Stop the agent */
  stop: () => void;
  /** Update agent state */
  setState: (state: Partial<TState>) => void;
  /** Error if any */
  error: Error | null;
}

/**
 * Hook for connecting to agents (LangGraph, etc.)
 *
 * @example
 * ```tsx
 * const { state, isRunning, start } = useAgent<{ city: string }>({
 *   name: 'weather-agent',
 *   initialState: { city: '' },
 * });
 *
 * return (
 *   <div>
 *     <p>City: {state.city}</p>
 *     <button onClick={() => start('What is the weather?')}>
 *       {isRunning ? 'Running...' : 'Start'}
 *     </button>
 *   </div>
 * );
 * ```
 */
export function useAgent<TState = Record<string, unknown>>(
  options: UseAgentOptions<TState>,
): UseAgentReturn<TState> {
  const { name, initialState = {} as TState, onStateChange } = options;
  const { config } = useCopilotContext();

  const [state, setStateInternal] = useState<TState>(initialState);
  const [isRunning, setIsRunning] = useState(false);
  const [nodeName, setNodeName] = useState<string | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  // Get agent endpoint
  const getEndpoint = useCallback(() => {
    if (config.cloud) {
      return `${config.cloud.endpoint || "https://api.yourgpt.ai/v1"}/agents/${name}`;
    }
    return `${config.runtimeUrl || "/api"}/agents/${name}`;
  }, [config, name]);

  // Start agent
  const start = useCallback(
    async (input?: string | Record<string, unknown>) => {
      setIsRunning(true);
      setError(null);

      abortControllerRef.current = new AbortController();

      try {
        const endpoint = getEndpoint();
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };

        if (config.cloud?.apiKey) {
          headers["Authorization"] = `Bearer ${config.cloud.apiKey}`;
        }

        const response = await fetch(`${endpoint}/start`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            input: typeof input === "string" ? { message: input } : input,
            state,
          }),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          throw new Error(`Agent error: ${response.status}`);
        }

        // Process stream
        for await (const event of streamSSE(response)) {
          handleAgentEvent(event);
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setError(err instanceof Error ? err : new Error("Unknown error"));
        }
      } finally {
        setIsRunning(false);
        abortControllerRef.current = null;
      }
    },
    [config, getEndpoint, state],
  );

  // Handle agent events
  const handleAgentEvent = useCallback(
    (event: StreamEvent & { state?: TState; nodeName?: string }) => {
      if (event.type === "error") {
        setError(new Error(event.message));
        return;
      }

      // Handle state updates (custom event)
      if ("state" in event && event.state) {
        setStateInternal(event.state);
        onStateChange?.(event.state);
      }

      // Handle node changes
      if ("nodeName" in event && event.nodeName) {
        setNodeName(event.nodeName);
      }
    },
    [onStateChange],
  );

  // Stop agent
  const stop = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  // Update state
  const setState = useCallback(
    (partialState: Partial<TState>) => {
      setStateInternal((prev) => {
        const newState = { ...prev, ...partialState };
        onStateChange?.(newState);
        return newState;
      });
    },
    [onStateChange],
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  return {
    state,
    isRunning,
    nodeName,
    start,
    stop,
    setState,
    error,
  };
}
