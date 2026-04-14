"use client";

import * as React from "react";
import { useCopilot } from "../react/provider/CopilotProvider";
import { GenUIFrame } from "./renderers/GenUIFrame";
import { Markdown } from "../ui/components/ui/markdown";
import type { UseGenerativeUIConfig, GenUIMessage } from "./types";

/**
 * Hook that enables generative UI rendering in CopilotChat.
 *
 * Detects `<GENUI>...</GENUI>` blocks in assistant messages and
 * renders them as interactive HTML in sandboxed iframes with
 * Tailwind CSS and Chart.js.
 *
 * Returns a `wrapMessage` function to pass to `<CopilotChat>`.
 *
 * @example
 * ```tsx
 * import { useGenerativeUI } from "@yourgpt/copilot-sdk/experimental";
 *
 * function App() {
 *   const { wrapMessage } = useGenerativeUI();
 *   return <CopilotChat wrapMessage={wrapMessage} />;
 * }
 * ```
 *
 * @example With actions (interactive iframe → parent communication)
 * ```tsx
 * const { wrapMessage } = useGenerativeUI({
 *   actions: {
 *     addToCart: (data) => cartStore.add(data.itemId),
 *     navigate: (data) => router.push(data.url),
 *   },
 * });
 * ```
 *
 * @experimental This API may change without a semver major bump.
 */
export function useGenerativeUI(config: UseGenerativeUIConfig = {}) {
  const { messages, isLoading, sendMessage } = useCopilot();
  const configRef = React.useRef(config);
  configRef.current = config;

  // Parse messages for <GENUI> blocks
  const genuiMessages: GenUIMessage[] = React.useMemo(() => {
    return messages.map((msg) => {
      if (msg.role !== "assistant" || !msg.content)
        return msg as unknown as GenUIMessage;

      const content = msg.content;
      const match = content.match(/<GENUI>([\s\S]*?)(<\/GENUI>|$)/);

      if (!match) return msg as unknown as GenUIMessage;

      const htmlContent = match[1];
      const isComplete = content.includes("</GENUI>");
      const textBefore = content.slice(0, match.index).trim();
      const textAfter = isComplete
        ? content.slice(match.index! + match[0].length).trim()
        : "";

      return {
        ...msg,
        _genui: {
          html: htmlContent,
          streaming: !isComplete,
          textBefore,
          textAfter,
        },
      } as unknown as GenUIMessage;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, isLoading]);

  // Stable action handler ref
  const handleAction = React.useCallback((name: string, data: unknown) => {
    const handler = configRef.current.actions?.[name];
    if (handler) return handler(data);
    return undefined;
  }, []);

  // Stable sendMessage handler
  const handleSendMessage = React.useCallback(
    (msg: string) => {
      sendMessage(msg);
    },
    [sendMessage],
  );

  // wrapMessage function for CopilotChat
  const wrapMessage = React.useCallback(
    (
      content: React.ReactNode,
      message: { id: string; role: string },
    ): React.ReactNode => {
      const processed = genuiMessages.find((m) => m.id === message.id);
      const genui = (
        processed as GenUIMessage & { _genui?: GenUIMessage["_genui"] }
      )?._genui;

      if (!genui) return content; // No GENUI block — keep default rendering

      const { html, streaming, textBefore, textAfter } = genui;

      // `content` is the full DefaultMessage (avatar + message bubble).
      // We replace the message-content text with GenUI, keeping the avatar
      // by using CSS to swap what's visible inside the existing layout.
      return (
        <div className="csdk-genui-wrap [&_.csdk-message-content>*]:!hidden">
          {content}
          {/* Inject GenUI inside the message-content area via adjacent positioning */}
          <style>{`.csdk-genui-wrap .csdk-message-content { padding: 0 !important; }
.csdk-genui-wrap .csdk-message-content > * { display: none !important; }
.csdk-genui-injected { margin-top: -4px; padding-left: 36px; }`}</style>
          <div className="csdk-genui-injected space-y-2">
            {textBefore && (
              <div className="text-sm text-foreground">
                <Markdown>{textBefore}</Markdown>
              </div>
            )}
            <GenUIFrame
              html={html}
              streaming={streaming}
              maxWidth={configRef.current.maxWidth}
              onSendMessage={handleSendMessage}
              onAction={handleAction}
            />
            {textAfter && (
              <div className="text-sm text-foreground">
                <Markdown>{textAfter}</Markdown>
              </div>
            )}
            {streaming && (
              <p className="text-xs text-muted-foreground animate-pulse">
                Rendering…
              </p>
            )}
          </div>
        </div>
      );
    },
    [genuiMessages, handleSendMessage, handleAction],
  );

  return { wrapMessage };
}
