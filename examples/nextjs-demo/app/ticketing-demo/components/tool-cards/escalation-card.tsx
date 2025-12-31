import {
  AlertTriangle,
  Undo2,
  MessageSquare,
  Copy,
  CheckCircle2,
} from "lucide-react";
import { useState } from "react";

interface EscalationCardProps {
  supervisor: string;
  reason: string;
  priority: string;
}

export function EscalationCard({
  supervisor,
  reason,
  priority,
}: EscalationCardProps) {
  const [copied, setCopied] = useState(false);
  const [undone, setUndone] = useState(false);

  const handleCopy = () => {
    const text = `Escalation Details
━━━━━━━━━━━━━━━━━━━━
Assigned To: ${supervisor}
Priority: ${priority}
Reason: ${reason}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className={`bg-card border rounded-xl p-4 space-y-3 ${undone ? "border-border" : "border-destructive/30"}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle
            className={`w-5 h-5 ${undone ? "text-muted-foreground" : "text-destructive"}`}
          />
          <span
            className={`font-semibold ${undone ? "text-muted-foreground line-through" : "text-destructive"}`}
          >
            {undone ? "Escalation Cancelled" : "Ticket Escalated"}
          </span>
        </div>
        {!undone && (
          <span className="px-2 py-0.5 bg-destructive/10 text-destructive rounded text-xs font-medium uppercase">
            {priority}
          </span>
        )}
      </div>
      {!undone && (
        <>
          <div className="text-sm space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Assigned To</span>
              <span className="text-foreground font-medium">{supervisor}</span>
            </div>
            <div className="text-muted-foreground text-xs bg-muted p-2 rounded">
              {reason}
            </div>
          </div>
          <div className="flex items-center gap-2 pt-2 border-t border-border">
            <button
              onClick={() => setUndone(true)}
              className="flex items-center gap-1 px-3 py-1.5 text-xs border border-destructive/30 text-destructive rounded hover:bg-destructive/10 transition-colors"
            >
              <Undo2 className="w-3 h-3" />
              Undo
            </button>
            <button className="flex items-center gap-1 px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors">
              <MessageSquare className="w-3 h-3" />
              Message
            </button>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 px-2 py-1.5 text-xs border border-border text-foreground rounded hover:bg-accent transition-colors ml-auto"
              title="Copy details"
            >
              {copied ? (
                <CheckCircle2 className="w-3 h-3 text-green-500" />
              ) : (
                <Copy className="w-3 h-3" />
              )}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
