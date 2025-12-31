import {
  Heart,
  TrendingUp,
  ExternalLink,
  Copy,
  CheckCircle2,
  RefreshCw,
} from "lucide-react";
import { useState } from "react";
import type { CustomerContext } from "../types";

interface CustomerContextCardProps {
  context: CustomerContext;
}

export function CustomerContextCard({ context }: CustomerContextCardProps) {
  const [copied, setCopied] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const handleCopy = () => {
    const text = `Customer Intelligence Report
━━━━━━━━━━━━━━━━━━━━━━━━━━
Lifetime Value: ${context.ltv}
Satisfaction: ${context.satisfactionScore}%
Orders: ${context.orderCount}
Tickets: ${context.ticketCount}

Recommendations:
${context.recommendations.map((r, i) => `${i + 1}. ${r}`).join("\n")}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1500);
  };

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Heart className="w-5 h-5 text-red-500" />
          <span className="font-semibold text-foreground">
            Customer Intelligence
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleRefresh}
            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent rounded transition-colors"
            title="Refresh data"
          >
            <RefreshCw
              className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`}
            />
          </button>
          <button
            onClick={handleCopy}
            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent rounded transition-colors"
            title="Copy report"
          >
            {copied ? (
              <CheckCircle2 className="w-4 h-4 text-green-500" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="p-2 bg-muted rounded">
          <div className="text-xs text-muted-foreground">Lifetime Value</div>
          <div className="text-lg font-semibold text-foreground">
            {context.ltv}
          </div>
        </div>
        <div className="p-2 bg-muted rounded">
          <div className="text-xs text-muted-foreground">Satisfaction</div>
          <div className="text-lg font-semibold text-foreground">
            {context.satisfactionScore}%
          </div>
        </div>
        <div className="p-2 bg-muted rounded">
          <div className="text-xs text-muted-foreground">Orders</div>
          <div className="text-lg font-semibold text-foreground">
            {context.orderCount}
          </div>
        </div>
        <div className="p-2 bg-muted rounded">
          <div className="text-xs text-muted-foreground">Tickets</div>
          <div className="text-lg font-semibold text-foreground">
            {context.ticketCount}
          </div>
        </div>
      </div>
      <div className="space-y-2 pt-2 border-t border-border">
        <div className="text-xs font-medium text-muted-foreground uppercase">
          AI Recommendations
        </div>
        <ul className="space-y-1">
          {context.recommendations.map((rec, i) => (
            <li
              key={i}
              className="flex items-start gap-2 text-sm text-foreground"
            >
              <TrendingUp className="w-3 h-3 text-green-500 mt-1 shrink-0" />
              {rec}
            </li>
          ))}
        </ul>
      </div>
      <button className="w-full flex items-center justify-center gap-2 px-3 py-2 border border-border text-foreground rounded-lg hover:bg-accent transition-colors text-sm">
        <ExternalLink className="w-4 h-4" />
        View Full Profile
      </button>
    </div>
  );
}
