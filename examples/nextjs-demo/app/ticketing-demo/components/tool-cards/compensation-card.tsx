import { DollarSign, Send, Edit3, CheckCircle2, Star } from "lucide-react";
import { useState } from "react";

interface CompensationOption {
  type: string;
  value: string;
  description: string;
}

interface CompensationCardProps {
  options: CompensationOption[];
  reasoning: string;
  customerValue: string;
  onSendOffer: (option: { type: string; value: string }) => void;
}

export function CompensationCard({
  options,
  reasoning,
  customerValue,
  onSendOffer,
}: CompensationCardProps) {
  const [sentOffers, setSentOffers] = useState<Set<number>>(new Set());
  const [recommendedIndex] = useState(0); // First option is recommended

  const handleSend = (option: CompensationOption, index: number) => {
    onSendOffer(option);
    setSentOffers((prev) => new Set([...prev, index]));
  };

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-green-500" />
          <span className="font-semibold text-foreground">
            Retention Offers
          </span>
        </div>
        <span className="text-xs px-2 py-1 bg-muted text-muted-foreground rounded-full">
          LTV: {customerValue}
        </span>
      </div>
      <p className="text-xs text-muted-foreground bg-muted p-2 rounded">
        {reasoning}
      </p>
      <div className="space-y-2">
        {options.map((option, i) => (
          <div
            key={i}
            className={`p-3 bg-muted rounded-lg ${i === recommendedIndex ? "ring-1 ring-primary/50" : ""}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground">
                    {option.type}
                  </span>
                  {i === recommendedIndex && (
                    <span className="flex items-center gap-1 text-xs text-primary">
                      <Star className="w-3 h-3 fill-current" />
                      Best fit
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {option.description}
                </div>
              </div>
              <span className="text-sm font-semibold text-green-500 whitespace-nowrap">
                {option.value}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border/50">
              <button
                onClick={() => handleSend(option, i)}
                disabled={sentOffers.has(i)}
                className="flex items-center gap-1 px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {sentOffers.has(i) ? (
                  <>
                    <CheckCircle2 className="w-3 h-3" />
                    Sent
                  </>
                ) : (
                  <>
                    <Send className="w-3 h-3" />
                    Send Offer
                  </>
                )}
              </button>
              <button
                className="flex items-center gap-1 px-2 py-1.5 text-xs border border-border text-foreground rounded hover:bg-accent transition-colors"
                title="Customize offer"
              >
                <Edit3 className="w-3 h-3" />
                Customize
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
