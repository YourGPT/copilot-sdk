"use client";

import * as React from "react";
import { useCopilotChatContext } from "./chat";
import { DefaultMessage } from "./default-message";
import type { ChatMessage } from "./types";

export interface MessageListProps {
  /**
   * Render function called for each message.
   * Return your own component or fall back to <Chat.DefaultMessage />.
   *
   * @example
   * ```tsx
   * <Chat.MessageList>
   *   {(message) =>
   *     message.metadata?.type === "plan"
   *       ? <PlanCard key={message.id} data={message.metadata} />
   *       : <Chat.DefaultMessage key={message.id} message={message} />
   *   }
   * </Chat.MessageList>
   * ```
   */
  children?: (message: ChatMessage, index: number) => React.ReactNode;
  className?: string;
}

/**
 * Chat.MessageList — renders the message list using a render-prop pattern.
 * Must be used inside <CopilotChat>.
 *
 * If no children are provided, renders all messages with the default SDK layout.
 */
export function MessageList({ children, className }: MessageListProps) {
  const { messages, registeredTools } = useCopilotChatContext();

  return (
    <div className={className}>
      {messages.map((message, index) => {
        if (children) {
          return (
            <React.Fragment key={message.id}>
              {children(message, index)}
            </React.Fragment>
          );
        }
        return (
          <DefaultMessage
            key={message.id}
            message={message}
            userAvatar={{ fallback: "U" }}
            assistantAvatar={{ fallback: "AI" }}
            registeredTools={registeredTools}
            isLastMessage={index === messages.length - 1}
          />
        );
      })}
    </div>
  );
}
