import { Mail, Check, Edit3, Copy, CheckCircle2 } from "lucide-react";
import { useState } from "react";

interface DraftResponseCardProps {
  subject: string;
  body: string;
  tone: string;
  onUseReply: () => void;
}

export function DraftResponseCard({
  subject,
  body,
  tone,
  onUseReply,
}: DraftResponseCardProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(`Subject: ${subject}\n\n${body}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Mail className="w-5 h-5 text-primary" />
          <span className="font-semibold text-foreground">
            AI Draft Response
          </span>
        </div>
        <span className="text-xs px-2 py-1 bg-muted text-muted-foreground rounded-full capitalize">
          {tone}
        </span>
      </div>
      <div className="space-y-2">
        <div className="text-xs text-muted-foreground">Subject</div>
        <div className="text-sm font-medium text-foreground bg-muted p-2 rounded">
          {subject}
        </div>
      </div>
      <div className="space-y-2">
        <div className="text-xs text-muted-foreground">Message</div>
        <div className="text-sm text-foreground bg-muted p-3 rounded whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
          {body}
        </div>
      </div>
      <div className="flex gap-2 pt-2">
        <button
          onClick={onUseReply}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium"
        >
          <Check className="w-4 h-4" />
          Use This Reply
        </button>
        <button
          onClick={handleCopy}
          className="px-3 py-2 border border-border text-foreground rounded-lg hover:bg-accent transition-colors text-sm"
          title="Copy to clipboard"
        >
          {copied ? (
            <CheckCircle2 className="w-4 h-4 text-green-500" />
          ) : (
            <Copy className="w-4 h-4" />
          )}
        </button>
        <button
          className="px-3 py-2 border border-border text-foreground rounded-lg hover:bg-accent transition-colors text-sm"
          title="Edit draft"
        >
          <Edit3 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
