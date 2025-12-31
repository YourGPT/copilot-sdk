"use client";

import { cn } from "@/lib/utils";
import {
  ChevronDown,
  Send,
  Paperclip,
  Smile,
  Mic,
  Type,
  X,
  Sparkles,
} from "lucide-react";
import { useDashboard } from "../context/dashboard-context";
import { avatars } from "../data/mock-data";

export function MessageComposer() {
  const { composeText, setComposeText, sendAgentMessage } = useDashboard();

  const handleSend = () => {
    if (composeText.trim()) {
      sendAgentMessage(composeText);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="border-t border-border p-4 bg-card">
      <div className="flex items-center gap-3 mb-3">
        <img
          src={avatars.agent}
          alt="Agent"
          className="w-8 h-8 rounded-full object-cover"
        />
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-muted-foreground">Reply as</span>
          <button className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-muted rounded-md text-sm text-foreground hover:bg-accent transition-colors">
            <span>Marcus Johnson</span>
            <ChevronDown className="w-3 h-3 text-muted-foreground" />
          </button>
          <span className="text-sm text-muted-foreground">via</span>
          <button className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-muted rounded-md text-sm text-foreground hover:bg-accent transition-colors">
            <span>Chat</span>
            <ChevronDown className="w-3 h-3 text-muted-foreground" />
          </button>
        </div>
        <div className="ml-auto flex items-center gap-1">
          {composeText && (
            <span className="text-xs text-chart-1 flex items-center gap-1 px-2 py-1 bg-chart-1/10 rounded">
              <Sparkles className="w-3 h-3" />
              AI Draft
            </span>
          )}
          <button className="p-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg">
            <Sparkles className="w-5 h-5" />
          </button>
        </div>
      </div>
      <div className="relative">
        <textarea
          value={composeText}
          onChange={(e) => setComposeText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder='Comment or Type "/" For commands'
          className={cn(
            "w-full px-4 py-3 bg-background border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-ring text-sm placeholder:text-muted-foreground",
            composeText
              ? "border-chart-1/50 ring-1 ring-chart-1/20"
              : "border-input",
          )}
          rows={composeText ? 6 : 2}
        />
      </div>
      <div className="flex items-center justify-between mt-3">
        <div className="flex items-center gap-0.5">
          <button className="p-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg">
            <Type className="w-4 h-4" />
          </button>
          <button className="p-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg">
            <Smile className="w-4 h-4" />
          </button>
          <button className="p-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg">
            <Paperclip className="w-4 h-4" />
          </button>
          <button className="p-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg">
            <Mic className="w-4 h-4" />
          </button>
        </div>
        <div className="flex items-center gap-2">
          {composeText && (
            <button
              onClick={() => setComposeText("")}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent rounded-lg transition-colors"
            >
              <X className="w-3 h-3" />
              Clear
            </button>
          )}
          <button className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent rounded-lg transition-colors">
            Macros
            <ChevronDown className="w-3 h-3" />
          </button>
          <button className="px-4 py-2 text-sm text-muted-foreground hover:bg-accent rounded-lg transition-colors">
            End Chat
          </button>
          <button
            onClick={handleSend}
            disabled={!composeText.trim()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
