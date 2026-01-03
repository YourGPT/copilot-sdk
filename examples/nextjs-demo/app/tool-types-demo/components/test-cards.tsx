"use client";

import {
  Loader2,
  CheckCircle2,
  XCircle,
  CloudSun,
  Trash2,
  Users,
  BarChart3,
  Zap,
} from "lucide-react";

// ============================================
// Skeleton Components
// ============================================

export function WeatherSkeleton() {
  return (
    <div className="bg-card border border-border rounded-xl p-4 animate-pulse">
      <div className="flex items-center gap-2 mb-3">
        <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
        <span className="text-sm font-medium">Fetching weather...</span>
      </div>
      <div className="space-y-2">
        <div className="h-4 bg-muted rounded w-3/4" />
        <div className="h-8 bg-muted rounded w-1/2" />
      </div>
    </div>
  );
}

export function SelectionSkeleton() {
  return (
    <div className="bg-card border border-border rounded-xl p-4 animate-pulse">
      <div className="flex items-center gap-2 mb-3">
        <Loader2 className="w-5 h-5 animate-spin text-yellow-500" />
        <span className="text-sm font-medium">Loading options...</span>
      </div>
      <div className="space-y-2">
        <div className="h-10 bg-muted rounded" />
        <div className="h-10 bg-muted rounded" />
      </div>
    </div>
  );
}

export function ChartSkeleton() {
  return (
    <div className="bg-card border border-border rounded-xl p-4 animate-pulse">
      <div className="flex items-center gap-2 mb-3">
        <Loader2 className="w-5 h-5 animate-spin text-purple-500" />
        <span className="text-sm font-medium">Generating chart...</span>
      </div>
      <div className="h-32 bg-muted rounded" />
    </div>
  );
}

// ============================================
// Result Cards
// ============================================

interface WeatherCardProps {
  city: string;
  temp: string;
  condition: string;
}

export function WeatherCard({ city, temp, condition }: WeatherCardProps) {
  return (
    <div className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-500/30 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <CloudSun className="w-5 h-5 text-blue-500" />
        <span className="text-sm font-semibold text-foreground">Weather</span>
      </div>
      <div className="text-2xl font-bold text-foreground">{temp}</div>
      <div className="text-sm text-muted-foreground">
        {city} • {condition}
      </div>
    </div>
  );
}

interface SelectionCardProps {
  title: string;
  options: Array<{ id: string; name: string; description: string }>;
  onSelect: (option: { id: string; name: string }) => void;
  onCancel: () => void;
}

export function SelectionCard({
  title,
  options,
  onSelect,
  onCancel,
}: SelectionCardProps) {
  return (
    <div className="bg-card border border-yellow-500/30 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Users className="w-5 h-5 text-yellow-500" />
        <span className="text-sm font-semibold text-foreground">{title}</span>
      </div>
      <div className="space-y-2 mb-3">
        {options.map((opt) => (
          <button
            key={opt.id}
            onClick={() => onSelect({ id: opt.id, name: opt.name })}
            className="w-full text-left p-3 rounded-lg border border-border hover:border-primary hover:bg-primary/5 transition-colors"
          >
            <div className="font-medium text-sm">{opt.name}</div>
            <div className="text-xs text-muted-foreground">
              {opt.description}
            </div>
          </button>
        ))}
      </div>
      <button
        onClick={onCancel}
        className="w-full py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        Cancel
      </button>
    </div>
  );
}

interface CompletedCardProps {
  title: string;
  message: string;
  data?: Record<string, unknown>;
}

export function CompletedCard({ title, message, data }: CompletedCardProps) {
  return (
    <div className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 border border-green-500/30 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <CheckCircle2 className="w-5 h-5 text-green-500" />
        <span className="text-sm font-semibold text-foreground">{title}</span>
      </div>
      <div className="text-sm text-foreground">{message}</div>
      {data && (
        <pre className="mt-2 text-xs bg-muted/50 p-2 rounded overflow-auto">
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  );
}

interface ChartCardProps {
  title: string;
  data: number[];
}

export function ChartCard({ title, data }: ChartCardProps) {
  const max = Math.max(...data);
  return (
    <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/30 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <BarChart3 className="w-5 h-5 text-purple-500" />
        <span className="text-sm font-semibold text-foreground">{title}</span>
      </div>
      <div className="flex items-end gap-1 h-20">
        {data.map((value, i) => (
          <div
            key={i}
            className="flex-1 bg-purple-500 rounded-t"
            style={{ height: `${(value / max) * 100}%` }}
          />
        ))}
      </div>
      <div className="text-xs text-muted-foreground mt-2">
        Values: {data.join(", ")}
      </div>
    </div>
  );
}

interface ErrorCardProps {
  message: string;
}

export function ErrorCard({ message }: ErrorCardProps) {
  return (
    <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
      <div className="flex items-center gap-2">
        <XCircle className="w-5 h-5 text-red-500" />
        <span className="text-sm text-red-500">{message}</span>
      </div>
    </div>
  );
}

// ============================================
// Override Test Cards (for toolRenderers)
// ============================================

export function AppOverrideCard() {
  return (
    <div className="bg-gradient-to-br from-orange-500/10 to-red-500/10 border border-orange-500/30 rounded-xl p-4">
      <div className="flex items-center gap-2">
        <Zap className="w-5 h-5 text-orange-500" />
        <span className="text-sm font-semibold text-orange-600">
          App Override (toolRenderers wins!)
        </span>
      </div>
      <div className="text-xs text-muted-foreground mt-1">
        This card is from toolRenderers, not tool.render
      </div>
    </div>
  );
}

export function ToolRenderCard() {
  return (
    <div className="bg-gradient-to-br from-gray-500/10 to-slate-500/10 border border-gray-500/30 rounded-xl p-4">
      <div className="flex items-center gap-2">
        <Zap className="w-5 h-5 text-gray-500" />
        <span className="text-sm font-semibold text-gray-600">
          Tool Render (should NOT show if override exists)
        </span>
      </div>
    </div>
  );
}
