import { cn } from "@/lib/utils";
import { Target, Link2, ExternalLink, Copy, CheckCircle2 } from "lucide-react";
import { useState } from "react";

interface SimilarTicket {
  id: string;
  title: string;
  status: string;
  resolution: string;
  similarity: number;
}

interface SimilarTicketsCardProps {
  tickets: SimilarTicket[];
  onLinkTicket: (ticket: {
    id: string;
    title: string;
    status: string;
    resolution: string;
  }) => void;
}

export function SimilarTicketsCard({
  tickets,
  onLinkTicket,
}: SimilarTicketsCardProps) {
  const [linkedIds, setLinkedIds] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleLink = (ticket: SimilarTicket) => {
    onLinkTicket(ticket);
    setLinkedIds((prev) => new Set([...prev, ticket.id]));
  };

  const handleCopyResolution = (ticket: SimilarTicket) => {
    navigator.clipboard.writeText(
      `Resolution from #${ticket.id}:\n${ticket.resolution}`,
    );
    setCopiedId(ticket.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Target className="w-5 h-5 text-primary" />
        <span className="font-semibold text-foreground">
          Similar Tickets Found
        </span>
        <span className="ml-auto text-xs px-2 py-1 bg-muted text-muted-foreground rounded-full">
          {tickets.length} matches
        </span>
      </div>
      <div className="space-y-2">
        {tickets.map((ticket) => (
          <div key={ticket.id} className="p-3 bg-muted rounded-lg">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-primary">
                    #{ticket.id}
                  </span>
                  <span
                    className={cn(
                      "text-xs px-1.5 py-0.5 rounded",
                      ticket.status === "Resolved"
                        ? "bg-green-500/20 text-green-600"
                        : "bg-yellow-500/20 text-yellow-600",
                    )}
                  >
                    {ticket.status}
                  </span>
                  <span className="text-xs text-primary font-medium ml-auto">
                    {ticket.similarity}% match
                  </span>
                </div>
                <p className="text-sm text-foreground mt-1 line-clamp-1">
                  {ticket.title}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Resolution: {ticket.resolution}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border/50">
              <button
                onClick={() => handleLink(ticket)}
                disabled={linkedIds.has(ticket.id)}
                className="flex items-center gap-1 px-2 py-1 text-xs bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {linkedIds.has(ticket.id) ? (
                  <>
                    <CheckCircle2 className="w-3 h-3" />
                    Linked
                  </>
                ) : (
                  <>
                    <Link2 className="w-3 h-3" />
                    Link
                  </>
                )}
              </button>
              <button
                onClick={() => handleCopyResolution(ticket)}
                className="flex items-center gap-1 px-2 py-1 text-xs border border-border text-foreground rounded hover:bg-accent transition-colors"
                title="Copy resolution"
              >
                {copiedId === ticket.id ? (
                  <CheckCircle2 className="w-3 h-3 text-green-500" />
                ) : (
                  <Copy className="w-3 h-3" />
                )}
              </button>
              <button
                className="flex items-center gap-1 px-2 py-1 text-xs border border-border text-foreground rounded hover:bg-accent transition-colors ml-auto"
                title="View full ticket"
              >
                <ExternalLink className="w-3 h-3" />
                View
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
