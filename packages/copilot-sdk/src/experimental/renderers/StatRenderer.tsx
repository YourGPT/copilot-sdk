"use client";

import * as React from "react";
import { cn } from "../../ui/lib/utils";
import type { StatPayload } from "../types";

interface StatRendererProps {
  payload: StatPayload;
  className?: string;
}

export function StatRenderer({ payload, className }: StatRendererProps) {
  const { stats, title } = payload;

  return (
    <div className={cn("csdk-genui-stat", className)}>
      {title && (
        <p className="mb-2 text-sm font-semibold text-foreground">{title}</p>
      )}
      <div
        className={cn(
          "grid gap-2",
          stats.length === 1 && "grid-cols-1",
          stats.length === 2 && "grid-cols-2",
          stats.length >= 3 && "grid-cols-2 sm:grid-cols-3",
        )}
      >
        {stats.map((stat, i) => (
          <div
            key={i}
            className="flex flex-col gap-0.5 rounded-lg border border-border bg-card p-3"
          >
            <span className="truncate text-xs text-muted-foreground">
              {stat.label}
            </span>
            <span className="text-xl font-bold tabular-nums leading-tight text-foreground">
              {stat.value}
            </span>
            {stat.change && (
              <span
                className={cn(
                  "text-xs font-medium",
                  stat.changeDirection === "positive" &&
                    "text-green-600 dark:text-green-400",
                  stat.changeDirection === "negative" &&
                    "text-red-500 dark:text-red-400",
                  (!stat.changeDirection ||
                    stat.changeDirection === "neutral") &&
                    "text-muted-foreground",
                )}
              >
                {stat.change}
              </span>
            )}
            {stat.description && (
              <span className="text-xs leading-snug text-muted-foreground">
                {stat.description}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
