"use client";

import { cn } from "@/lib/utils";
import {
  Copy,
  ThumbsUp,
  ThumbsDown,
  Share,
  Trash2,
  MessageCircle,
} from "lucide-react";
import type { TicketMessage } from "../types";

interface MessageProps {
  message: TicketMessage;
}

// Check if avatar is a URL or initials
function isAvatarUrl(avatar?: string): boolean {
  return avatar?.startsWith("http") || avatar?.startsWith("/") || false;
}

export function Message({ message }: MessageProps) {
  if (message.type === "system") {
    return (
      <div className="flex items-center justify-center py-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center">
            <MessageCircle className="w-3 h-3" />
          </div>
          <span>{message.content}</span>
          <span className="text-muted-foreground/60">
            • {message.timestamp}
          </span>
        </div>
      </div>
    );
  }

  const isAgent = message.type === "agent";
  const hasImageAvatar = isAvatarUrl(message.avatar);

  return (
    <div
      className={cn(
        "flex gap-3 py-4 group",
        isAgent && "bg-accent/50 px-4 -mx-4 rounded-xl",
      )}
    >
      {/* Avatar - supports both image URLs and text initials */}
      {hasImageAvatar ? (
        <img
          src={message.avatar}
          alt={message.sender}
          className="w-9 h-9 rounded-full object-cover shrink-0"
        />
      ) : (
        <div
          className={cn(
            "w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold shrink-0",
            isAgent
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground",
          )}
        >
          {message.avatar}
        </div>
      )}

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-foreground">
            {message.sender}
          </span>
          <span className="text-xs text-muted-foreground">
            • {message.timestamp}
          </span>
          {message.channel && (
            <>
              <span className="text-xs text-muted-foreground">•</span>
              <span className="inline-flex items-center gap-1 text-xs text-primary font-medium">
                <MessageCircle className="w-3 h-3" />
                {message.channel}
              </span>
            </>
          )}
        </div>
        <p className="mt-1.5 text-sm text-foreground leading-relaxed whitespace-pre-wrap">
          {message.content}
        </p>
      </div>

      {isAgent && (
        <div className="flex items-start gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-background rounded">
            <Copy className="w-4 h-4" />
          </button>
          <button className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-background rounded">
            <ThumbsUp className="w-4 h-4" />
          </button>
          <button className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-background rounded">
            <ThumbsDown className="w-4 h-4" />
          </button>
          <button className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-background rounded">
            <Share className="w-4 h-4" />
          </button>
          <button className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-background rounded">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
