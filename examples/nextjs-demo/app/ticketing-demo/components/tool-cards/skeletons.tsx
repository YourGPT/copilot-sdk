/**
 * Skeleton loading components for tool cards
 */

export function CardSkeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`bg-card border border-border rounded-xl p-4 animate-pulse ${className}`}
    >
      <div className="flex items-center gap-2 mb-3">
        <div className="w-5 h-5 bg-muted rounded" />
        <div className="h-4 w-32 bg-muted rounded" />
      </div>
      <div className="space-y-2">
        <div className="h-3 w-full bg-muted rounded" />
        <div className="h-3 w-3/4 bg-muted rounded" />
      </div>
    </div>
  );
}

export function DraftResponseSkeleton() {
  return (
    <div className="bg-card border border-border rounded-xl p-4 animate-pulse">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 bg-primary/20 rounded" />
          <div className="h-4 w-28 bg-muted rounded" />
        </div>
        <div className="h-5 w-16 bg-muted rounded-full" />
      </div>
      <div className="space-y-3">
        <div>
          <div className="h-3 w-12 bg-muted rounded mb-2" />
          <div className="h-8 w-full bg-muted rounded" />
        </div>
        <div>
          <div className="h-3 w-14 bg-muted rounded mb-2" />
          <div className="h-24 w-full bg-muted rounded" />
        </div>
      </div>
      <div className="flex gap-2 pt-3 mt-3 border-t border-border">
        <div className="flex-1 h-9 bg-primary/20 rounded-lg" />
        <div className="w-10 h-9 bg-muted rounded-lg" />
        <div className="w-10 h-9 bg-muted rounded-lg" />
      </div>
    </div>
  );
}

export function TicketSummarySkeleton() {
  return (
    <div className="bg-card border border-border rounded-xl p-4 animate-pulse">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 bg-primary/20 rounded" />
          <div className="h-4 w-28 bg-muted rounded" />
        </div>
        <div className="flex gap-1">
          <div className="w-7 h-7 bg-muted rounded" />
          <div className="w-7 h-7 bg-muted rounded" />
        </div>
      </div>
      <div className="space-y-2 mb-3">
        <div className="h-3 w-full bg-muted rounded" />
        <div className="h-3 w-5/6 bg-muted rounded" />
        <div className="h-3 w-4/6 bg-muted rounded" />
      </div>
      <div className="space-y-2">
        <div className="h-3 w-20 bg-muted rounded" />
        <div className="space-y-1">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="w-4 h-4 bg-green-500/20 rounded-full" />
              <div className="h-3 flex-1 bg-muted rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function SimilarTicketsSkeleton() {
  return (
    <div className="bg-card border border-border rounded-xl p-4 animate-pulse">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-5 h-5 bg-primary/20 rounded" />
        <div className="h-4 w-36 bg-muted rounded" />
        <div className="ml-auto h-5 w-16 bg-muted rounded-full" />
      </div>
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-3 w-16 bg-muted rounded" />
              <div className="h-4 w-14 bg-muted rounded" />
            </div>
            <div className="h-3 w-full bg-muted rounded mb-1" />
            <div className="h-3 w-3/4 bg-muted rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function CompensationSkeleton() {
  return (
    <div className="bg-card border border-border rounded-xl p-4 animate-pulse">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 bg-green-500/20 rounded" />
          <div className="h-4 w-28 bg-muted rounded" />
        </div>
        <div className="h-5 w-20 bg-muted rounded-full" />
      </div>
      <div className="h-10 w-full bg-muted rounded mb-3" />
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <div className="h-4 w-24 bg-muted rounded mb-1" />
                <div className="h-3 w-40 bg-muted rounded" />
              </div>
              <div className="h-4 w-14 bg-green-500/20 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ResolutionSkeleton() {
  return (
    <div className="bg-card border border-border rounded-xl p-4 animate-pulse">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 bg-yellow-500/20 rounded" />
          <div className="h-4 w-32 bg-muted rounded" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-2 w-16 bg-muted rounded-full" />
          <div className="h-3 w-8 bg-muted rounded" />
        </div>
      </div>
      <div className="p-3 bg-muted/50 rounded-lg mb-3">
        <div className="h-4 w-full bg-muted rounded mb-2" />
        <div className="h-3 w-3/4 bg-muted rounded" />
      </div>
      <div className="space-y-2">
        <div className="h-3 w-24 bg-muted rounded" />
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="w-5 h-5 bg-primary/10 rounded-full" />
            <div className="h-3 flex-1 bg-muted rounded" />
          </div>
        ))}
      </div>
      <div className="flex gap-2 mt-3">
        <div className="flex-1 h-9 bg-primary/20 rounded-lg" />
        <div className="w-10 h-9 bg-muted rounded-lg" />
      </div>
    </div>
  );
}

export function CustomerRiskSkeleton() {
  return (
    <div className="bg-card border border-border rounded-xl p-4 animate-pulse">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 bg-red-500/20 rounded" />
          <div className="h-4 w-36 bg-muted rounded" />
        </div>
        <div className="h-5 w-16 bg-red-500/10 rounded-full" />
      </div>
      <div className="flex items-center gap-3 mb-3">
        <div className="flex-1 h-2 bg-muted rounded-full" />
        <div className="h-4 w-12 bg-muted rounded" />
      </div>
      <div className="space-y-1">
        <div className="h-3 w-20 bg-muted rounded mb-2" />
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="w-3 h-3 bg-red-500/20 rounded-full" />
            <div className="h-3 flex-1 bg-muted rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function SentimentSkeleton() {
  return (
    <div className="bg-card border border-border rounded-xl p-4 animate-pulse">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 bg-primary/20 rounded" />
          <div className="h-4 w-32 bg-muted rounded" />
        </div>
        <div className="flex items-center gap-2 px-2 py-1 bg-muted rounded-full">
          <div className="w-5 h-5 bg-muted rounded-full" />
          <div className="h-4 w-16 bg-muted rounded" />
        </div>
      </div>
      <div className="space-y-1">
        <div className="h-3 w-24 bg-muted rounded mb-2" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-500/20 rounded" />
            <div className="h-3 flex-1 bg-muted rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function CustomerContextSkeleton() {
  return (
    <div className="bg-card border border-border rounded-xl p-4 animate-pulse">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 bg-red-500/20 rounded" />
          <div className="h-4 w-36 bg-muted rounded" />
        </div>
        <div className="flex gap-1">
          <div className="w-7 h-7 bg-muted rounded" />
          <div className="w-7 h-7 bg-muted rounded" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 mb-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="p-2 bg-muted/50 rounded">
            <div className="h-3 w-16 bg-muted rounded mb-1" />
            <div className="h-5 w-12 bg-muted rounded" />
          </div>
        ))}
      </div>
      <div className="pt-2 border-t border-border">
        <div className="h-3 w-28 bg-muted rounded mb-2" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-2 mb-1">
            <div className="w-3 h-3 bg-green-500/20 rounded" />
            <div className="h-3 flex-1 bg-muted rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function KnowledgeBaseSkeleton() {
  return (
    <div className="bg-card border border-border rounded-xl p-4 animate-pulse">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-5 h-5 bg-primary/20 rounded" />
        <div className="h-4 w-28 bg-muted rounded" />
        <div className="ml-auto h-5 w-16 bg-muted rounded-full" />
      </div>
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="p-3 bg-muted/50 rounded-lg">
            <div className="h-4 w-3/4 bg-muted rounded mb-2" />
            <div className="h-3 w-full bg-muted rounded mb-1" />
            <div className="h-3 w-2/3 bg-muted rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function CallbackSkeleton() {
  return (
    <div className="bg-card border border-border rounded-xl p-4 animate-pulse">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-5 h-5 bg-primary/20 rounded" />
        <div className="h-4 w-32 bg-muted rounded" />
      </div>
      <div className="space-y-2 mb-3">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-muted rounded" />
          <div className="h-4 w-36 bg-muted rounded" />
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-muted rounded" />
          <div className="h-4 w-28 bg-muted rounded" />
        </div>
      </div>
      <div className="flex gap-2 pt-2">
        <div className="flex-1 h-9 bg-primary/20 rounded-lg" />
        <div className="w-10 h-9 bg-muted rounded-lg" />
      </div>
    </div>
  );
}

export function EscalationSkeleton() {
  return (
    <div className="bg-card border border-destructive/30 rounded-xl p-4 animate-pulse">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 bg-destructive/20 rounded" />
          <div className="h-4 w-28 bg-destructive/20 rounded" />
        </div>
        <div className="h-5 w-14 bg-destructive/10 rounded" />
      </div>
      <div className="space-y-2">
        <div className="flex justify-between">
          <div className="h-4 w-20 bg-muted rounded" />
          <div className="h-4 w-28 bg-muted rounded" />
        </div>
        <div className="h-12 w-full bg-muted rounded" />
      </div>
    </div>
  );
}

export function CustomerProfileSkeleton() {
  return (
    <div className="bg-card border border-border rounded-xl p-4 animate-pulse">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-12 h-12 bg-primary/20 rounded-full" />
        <div className="flex-1">
          <div className="h-4 w-28 bg-muted rounded mb-1" />
          <div className="h-4 w-20 bg-muted rounded-full" />
        </div>
      </div>
      <div className="space-y-2 mb-3">
        <div className="flex items-center justify-between p-2 bg-muted/50 rounded">
          <div className="flex items-center gap-2">
            <div className="w-3.5 h-3.5 bg-muted rounded" />
            <div className="h-4 w-36 bg-muted rounded" />
          </div>
          <div className="w-6 h-6 bg-muted rounded" />
        </div>
        <div className="flex items-center justify-between p-2 bg-muted/50 rounded">
          <div className="flex items-center gap-2">
            <div className="w-3.5 h-3.5 bg-muted rounded" />
            <div className="h-4 w-28 bg-muted rounded" />
          </div>
          <div className="w-6 h-6 bg-muted rounded" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="p-2 bg-muted/50 rounded">
          <div className="h-3 w-16 bg-muted rounded mb-1" />
          <div className="h-5 w-8 bg-muted rounded" />
        </div>
        <div className="p-2 bg-muted/50 rounded">
          <div className="h-3 w-20 bg-muted rounded mb-1" />
          <div className="h-5 w-14 bg-muted rounded" />
        </div>
      </div>
    </div>
  );
}
