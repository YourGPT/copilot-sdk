import { Lightbulb, Zap, Copy, CheckCircle2, Edit3 } from "lucide-react";
import { useState } from "react";

interface ResolutionSuggestionCardProps {
  suggestion: string;
  confidence: number;
  reasoning: string;
  steps: string[];
  onApply: () => void;
}

export function ResolutionSuggestionCard({
  suggestion,
  confidence,
  reasoning,
  steps,
  onApply,
}: ResolutionSuggestionCardProps) {
  const [applied, setApplied] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleApply = () => {
    onApply();
    setApplied(true);
  };

  const handleCopySteps = () => {
    const text = `Resolution: ${suggestion}\n\nSteps:\n${steps.map((s, i) => `${i + 1}. ${s}`).join("\n")}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Lightbulb className="w-5 h-5 text-yellow-500" />
          <span className="font-semibold text-foreground">
            AI Recommendation
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-2 w-16 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 rounded-full"
              style={{ width: `${confidence}%` }}
            />
          </div>
          <span className="text-xs text-muted-foreground font-medium">
            {confidence}%
          </span>
        </div>
      </div>
      <div className="p-3 bg-muted rounded-lg">
        <p className="text-sm font-medium text-foreground">{suggestion}</p>
        <p className="text-xs text-muted-foreground mt-2">{reasoning}</p>
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground uppercase">
            Resolution Steps
          </span>
          <button
            onClick={handleCopySteps}
            className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-accent rounded transition-colors"
            title="Copy steps"
          >
            {copied ? (
              <CheckCircle2 className="w-3 h-3 text-green-500" />
            ) : (
              <Copy className="w-3 h-3" />
            )}
          </button>
        </div>
        <ol className="space-y-1">
          {steps.map((step, i) => (
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
        </ol>
      </div>
      <div className="flex gap-2">
        <button
          onClick={handleApply}
          disabled={applied}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium disabled:opacity-50"
        >
          {applied ? (
            <>
              <CheckCircle2 className="w-4 h-4" />
              Applied
            </>
          ) : (
            <>
              <Zap className="w-4 h-4" />
              Apply Resolution
            </>
          )}
        </button>
        <button
          className="px-3 py-2 border border-border text-foreground rounded-lg hover:bg-accent transition-colors text-sm"
          title="Edit steps"
        >
          <Edit3 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
