"use client";

import { useEffect, useRef } from "react";
import { useDashboard } from "../context/dashboard-context";
import { Message } from "./message";
import { MessageComposer } from "./message-composer";

export function ConversationArea() {
  const { messages } = useDashboard();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="flex-1 flex flex-col bg-background min-w-0">
      {/* Tabs */}
      <div className="flex items-center gap-6 px-6 border-b border-border">
        <button className="text-sm font-medium text-primary border-b-2 border-primary py-3">
          Conversation
        </button>
        <button className="text-sm text-muted-foreground hover:text-foreground py-3">
          Task
        </button>
        <button className="text-sm text-muted-foreground hover:text-foreground py-3">
          Activity Logs
        </button>
        <button className="text-sm text-muted-foreground hover:text-foreground py-3">
          Notes
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <div className="flex items-center justify-center py-4">
          <div className="flex-1 border-t border-border"></div>
          <span className="px-4 text-xs text-muted-foreground font-medium bg-background">
            Today
          </span>
          <div className="flex-1 border-t border-border"></div>
        </div>
        <div className="space-y-1">
          {messages.map((msg) => (
            <Message key={msg.id} message={msg} />
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Composer */}
      <MessageComposer />
    </div>
  );
}
