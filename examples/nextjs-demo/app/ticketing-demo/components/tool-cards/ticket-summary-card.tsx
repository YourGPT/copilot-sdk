import { FileText, CheckCircle2, Copy, Share2 } from "lucide-react";
import { useState } from "react";

interface TicketSummaryCardProps {
  summary: string;
  keyPoints: string[];
  nextSteps: string[];
}

export function TicketSummaryCard({
  summary,
  keyPoints,
  nextSteps,
}: TicketSummaryCardProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    const text = `Summary:\n${summary}\n\nKey Points:\n${keyPoints.map((p, i) => `${i + 1}. ${p}`).join("\n")}\n\nNext Steps:\n${nextSteps.map((s, i) => `${i + 1}. ${s}`).join("\n")}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-primary" />
          <span className="font-semibold text-foreground">Ticket Summary</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleCopy}
            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent rounded transition-colors"
            title="Copy summary"
          >
            {copied ? (
              <CheckCircle2 className="w-4 h-4 text-green-500" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
          </button>
          <button
            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent rounded transition-colors"
            title="Share summary"
          >
            <Share2 className="w-4 h-4" />
          </button>
        </div>
      </div>
      <p className="text-sm text-foreground leading-relaxed">{summary}</p>
      <div className="space-y-2">
        <div className="text-xs font-medium text-muted-foreground uppercase">
          Key Points
        </div>
        <ul className="space-y-1">
          {keyPoints.map((point, i) => (
            <li
              key={i}
              className="flex items-start gap-2 text-sm text-foreground"
            >
              <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
              {point}
            </li>
          ))}
        </ul>
      </div>
      <div className="space-y-2 pt-2 border-t border-border">
        <div className="text-xs font-medium text-muted-foreground uppercase">
          Recommended Next Steps
        </div>
        <ul className="space-y-1">
          {nextSteps.map((step, i) => (
            <li
              key={i}
              className="flex items-start gap-2 text-sm text-foreground"
            >
              <span className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs shrink-0">
                {i + 1}
              </span>
              {step}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
