"use client";

import { useContextStats } from "@yourgpt/copilot-sdk/react";
import { BarChart2 } from "lucide-react";

export function ContextStatsBar() {
  const { totalTokens, usagePercent, toolCount, messageCount } =
    useContextStats();

  const percent = Math.round(usagePercent * 100);
  const barColor =
    percent > 80
      ? "bg-red-500"
      : percent > 60
        ? "bg-amber-500"
        : "bg-emerald-500";

  return (
    <div className="px-3 py-2 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1 text-[10px] text-zinc-500">
          <BarChart2 className="w-3 h-3" />
          <span>Context</span>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-zinc-400">
          <span>{totalTokens.toLocaleString()} tokens</span>
          <span>·</span>
          <span>{toolCount} tools</span>
          <span>·</span>
          <span>{messageCount} msgs</span>
        </div>
      </div>
      <div className="h-1 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${Math.max(2, percent)}%` }}
        />
      </div>
    </div>
  );
}
