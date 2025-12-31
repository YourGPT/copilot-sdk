import { cn } from "@/lib/utils";
import {
  Shield,
  AlertCircle,
  Copy,
  CheckCircle2,
  Bell,
  Flag,
} from "lucide-react";
import { useState } from "react";
import type { CustomerRisk } from "../types";

interface CustomerRiskCardProps {
  risk: CustomerRisk;
}

export function CustomerRiskCard({ risk }: CustomerRiskCardProps) {
  const [copied, setCopied] = useState(false);
  const [flagged, setFlagged] = useState(false);

  const riskColors = {
    low: {
      text: "text-green-600",
      fill: "bg-green-500",
      badge: "bg-green-500/10 text-green-600",
    },
    medium: {
      text: "text-yellow-600",
      fill: "bg-yellow-500",
      badge: "bg-yellow-500/10 text-yellow-600",
    },
    high: {
      text: "text-red-600",
      fill: "bg-red-500",
      badge: "bg-red-500/10 text-red-600",
    },
  };
  const c = riskColors[risk.level];

  const handleCopy = () => {
    const text = `Churn Risk Analysis
━━━━━━━━━━━━━━━━━━━━
Level: ${risk.level.toUpperCase()}
Score: ${risk.score}/100

Risk Factors:
${risk.reasons.map((r, i) => `${i + 1}. ${r}`).join("\n")}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleFlag = () => {
    setFlagged(true);
  };

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className={cn("w-5 h-5", c.text)} />
          <span className="font-semibold text-foreground">
            Churn Risk Analysis
          </span>
        </div>
        <span
          className={cn(
            "text-xs px-2 py-1 rounded-full font-medium uppercase",
            c.badge,
          )}
        >
          {risk.level} Risk
        </span>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className={cn("h-full rounded-full transition-all", c.fill)}
              style={{ width: `${risk.score}%` }}
            />
          </div>
        </div>
        <span className={cn("text-sm font-medium", c.text)}>
          {risk.score}/100
        </span>
      </div>
      <div className="space-y-1">
        <div className="text-xs font-medium text-muted-foreground uppercase">
          Risk Factors
        </div>
        <ul className="space-y-1">
          {risk.reasons.map((reason, i) => (
            <li
              key={i}
              className="flex items-center gap-2 text-sm text-foreground"
            >
              <AlertCircle className={cn("w-3 h-3", c.text)} />
              {reason}
            </li>
          ))}
        </ul>
      </div>
      <div className="flex items-center gap-2 pt-2 border-t border-border">
        <button
          onClick={handleFlag}
          disabled={flagged}
          className={cn(
            "flex items-center gap-1 px-3 py-1.5 text-xs rounded transition-colors",
            flagged
              ? "bg-yellow-500/20 text-yellow-600"
              : "bg-primary text-primary-foreground hover:bg-primary/90",
          )}
        >
          {flagged ? (
            <>
              <CheckCircle2 className="w-3 h-3" />
              Flagged
            </>
          ) : (
            <>
              <Flag className="w-3 h-3" />
              Flag for Review
            </>
          )}
        </button>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 px-2 py-1.5 text-xs border border-border text-foreground rounded hover:bg-accent transition-colors"
          title="Copy report"
        >
          {copied ? (
            <CheckCircle2 className="w-3 h-3 text-green-500" />
          ) : (
            <Copy className="w-3 h-3" />
          )}
        </button>
        <button
          className="flex items-center gap-1 px-2 py-1.5 text-xs border border-border text-foreground rounded hover:bg-accent transition-colors ml-auto"
          title="Notify team"
        >
          <Bell className="w-3 h-3" />
          Alert
        </button>
      </div>
    </div>
  );
}
