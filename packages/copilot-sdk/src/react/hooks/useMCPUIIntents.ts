"use client";

import { useCallback, useMemo } from "react";
import type {
  MCPUIIntent,
  MCPUIIntentContext,
  UseMCPUIIntentsConfig,
  UseMCPUIIntentsReturn,
} from "../../mcp/ui/types";

/**
 * useMCPUIIntents - Hook for handling MCP-UI intents
 *
 * This hook provides a unified handler for all MCP-UI intent types.
 * Use it to handle user interactions from MCP-UI components rendered
 * in the chat interface.
 *
 * @example
 * ```tsx
 * function ChatWithMCPUI() {
 *   const { sendMessage, callTool } = useCopilotChat();
 *
 *   const { handleIntent } = useMCPUIIntents({
 *     // Handle tool calls from UI
 *     onToolCall: async (name, args) => {
 *       await callTool(name, args);
 *     },
 *     // Handle semantic actions
 *     onIntent: (action, data) => {
 *       if (action === "add_to_cart") {
 *         // Dispatch to state management or send to agent
 *         sendMessage(`Add ${data?.productId} to cart`);
 *       }
 *     },
 *     // Pre-fill chat input
 *     onPrompt: (text) => {
 *       setInputValue(text);
 *     },
 *     // Show toast notifications
 *     onNotify: (message, level) => {
 *       toast({ message, type: level });
 *     },
 *     // Handle link clicks
 *     onLink: (url, newTab) => {
 *       // Return false to prevent default behavior
 *       if (url.startsWith('internal://')) {
 *         navigate(url.replace('internal://', '/'));
 *         return false;
 *       }
 *     },
 *   });
 *
 *   return (
 *     <CopilotChat
 *       onUIIntent={handleIntent}
 *     />
 *   );
 * }
 * ```
 */
export function useMCPUIIntents(
  config: UseMCPUIIntentsConfig = {},
): UseMCPUIIntentsReturn {
  const {
    onToolCall,
    onIntent,
    onPrompt,
    onNotify,
    onLink,
    requireConsent = { tool: false, link: true },
  } = config;

  const handleIntent = useCallback(
    async (intent: MCPUIIntent, context?: MCPUIIntentContext) => {
      switch (intent.type) {
        case "tool": {
          // Tool call intent - invoke another MCP tool
          if (requireConsent.tool) {
            // TODO: Implement consent dialog for tool calls
            // For now, just call the handler
          }
          await onToolCall?.(intent.name, intent.arguments, context);
          break;
        }

        case "intent": {
          // Semantic action intent - let the agent/app interpret
          await onIntent?.(intent.action, intent.data, context);
          break;
        }

        case "prompt": {
          // Prompt intent - add text to chat input
          onPrompt?.(intent.text, context);
          break;
        }

        case "notify": {
          // Notification intent - show toast/alert
          onNotify?.(intent.message, intent.level, context);
          break;
        }

        case "link": {
          // Link intent - open URL
          const shouldContinue = onLink?.(intent.url, intent.newTab, context);

          // If handler returns false, skip default behavior
          if (shouldContinue === false) {
            break;
          }

          // Default behavior: open link
          if (requireConsent.link) {
            // TODO: Implement consent dialog for links
            // For now, check if it's a safe URL
            const isSafeUrl =
              intent.url.startsWith("https://") ||
              intent.url.startsWith("http://localhost");
            if (!isSafeUrl) {
              console.warn(
                "[MCP-UI] Blocked potentially unsafe link:",
                intent.url,
              );
              break;
            }
          }

          // Open the link
          if (typeof window !== "undefined") {
            if (intent.newTab !== false) {
              window.open(intent.url, "_blank", "noopener,noreferrer");
            } else {
              window.location.href = intent.url;
            }
          }
          break;
        }

        default: {
          console.warn(
            "[MCP-UI] Unknown intent type:",
            (intent as unknown as { type: string }).type,
          );
        }
      }
    },
    [onToolCall, onIntent, onPrompt, onNotify, onLink, requireConsent],
  );

  return useMemo(
    () => ({
      handleIntent,
    }),
    [handleIntent],
  );
}

/**
 * Create a simple intent handler that sends intents as messages
 *
 * This is a convenience function for when you want all intents
 * to be converted to natural language messages sent to the agent.
 *
 * @example
 * ```tsx
 * const { sendMessage } = useCopilotChat();
 * const { handleIntent } = useMCPUIIntents(
 *   createMessageIntentHandler(sendMessage)
 * );
 * ```
 */
export function createMessageIntentHandler(
  sendMessage: (message: string) => void | Promise<void>,
): UseMCPUIIntentsConfig {
  return {
    onIntent: async (action, data) => {
      const dataStr = data ? ` with ${JSON.stringify(data)}` : "";
      await sendMessage(`User action: ${action}${dataStr}`);
    },
    onPrompt: (text) => {
      sendMessage(text);
    },
    onNotify: (message, level) => {
      // Convert notifications to messages
      if (level === "error") {
        sendMessage(`Error: ${message}`);
      }
    },
  };
}

/**
 * Create an intent handler that integrates with a tool executor
 *
 * This connects MCP-UI tool intents directly to useMCPTools
 * for seamless tool chaining.
 *
 * @example
 * ```tsx
 * const { callTool } = useMCPTools({ ... });
 * const { handleIntent } = useMCPUIIntents(
 *   createToolIntentHandler(callTool)
 * );
 * ```
 */
export function createToolIntentHandler(
  callTool: (name: string, args?: Record<string, unknown>) => Promise<unknown>,
): UseMCPUIIntentsConfig {
  return {
    onToolCall: async (name, args) => {
      await callTool(name, args);
    },
  };
}

export type { UseMCPUIIntentsConfig, UseMCPUIIntentsReturn };
