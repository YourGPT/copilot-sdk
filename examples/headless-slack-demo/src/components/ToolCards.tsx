import {
  Cloud,
  Sun,
  Wind,
  Search,
  BarChart3,
  Calculator,
  Clock,
  ThumbsUp,
} from "lucide-react";
import { useState } from "react";

// ── Weather Card ──────────────────────────────────────────────────

export interface WeatherData {
  city: string;
  temperature: number;
  unit: string;
  condition: string;
  humidity: number;
  wind: number;
}

export function WeatherCard({ data }: { data: WeatherData }) {
  const iconMap: Record<string, React.ReactNode> = {
    Sunny: <Sun size={32} className="text-yellow-400" />,
    Cloudy: <Cloud size={32} className="text-gray-400" />,
    Rainy: <Cloud size={32} className="text-blue-400" />,
    Windy: <Wind size={32} className="text-teal-400" />,
    "Partly cloudy": <Cloud size={32} className="text-gray-300" />,
  };

  return (
    <div className="border border-gray-200 rounded-xl p-4 bg-gradient-to-br from-blue-50 to-sky-50 w-64 mt-2">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="font-bold text-gray-900 text-base">{data.city}</p>
          <p className="text-gray-500 text-xs">{data.condition}</p>
        </div>
        {iconMap[data.condition] ?? (
          <Sun size={32} className="text-yellow-400" />
        )}
      </div>
      <p className="text-4xl font-bold text-gray-900 mb-3">
        {data.temperature}°{data.unit === "celsius" ? "C" : "F"}
      </p>
      <div className="flex gap-4 text-xs text-gray-500">
        <span>💧 {data.humidity}%</span>
        <span>💨 {data.wind} km/h</span>
      </div>
    </div>
  );
}

// ── Search Results Card ───────────────────────────────────────────

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

export interface SearchData {
  query: string;
  results: SearchResult[];
}

export function SearchCard({ data }: { data: SearchData }) {
  return (
    <div className="border border-gray-200 rounded-xl p-3 bg-white mt-2 w-80">
      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-100">
        <Search size={14} className="text-blue-500" />
        <span className="text-sm font-semibold text-gray-700">
          Results for &quot;{data.query}&quot;
        </span>
      </div>
      <div className="flex flex-col gap-3">
        {data.results.map((r, i) => (
          <div key={i}>
            <p className="text-blue-600 text-sm font-medium hover:underline cursor-pointer">
              {r.title}
            </p>
            <p className="text-green-700 text-xs">{r.url}</p>
            <p className="text-gray-600 text-xs mt-0.5 leading-relaxed">
              {r.snippet}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Poll Card ─────────────────────────────────────────────────────

interface PollOption {
  id: number;
  text: string;
  votes: number;
}

export interface PollData {
  id: string;
  question: string;
  options: PollOption[];
}

export function PollCard({ data }: { data: PollData }) {
  const [votes, setVotes] = useState<Record<number, number>>(
    Object.fromEntries(data.options.map((o) => [o.id, o.votes])),
  );
  const [voted, setVoted] = useState<number | null>(null);
  const total = Object.values(votes).reduce((a, b) => a + b, 0);

  const vote = (id: number) => {
    if (voted !== null) return;
    setVotes((v) => ({ ...v, [id]: v[id] + 1 }));
    setVoted(id);
  };

  return (
    <div className="border border-gray-200 rounded-xl p-4 bg-white mt-2 w-72">
      <div className="flex items-center gap-2 mb-3">
        <BarChart3 size={15} className="text-purple-500" />
        <p className="font-semibold text-gray-900 text-sm">{data.question}</p>
      </div>
      <div className="flex flex-col gap-2">
        {data.options.map((o) => {
          const count = votes[o.id];
          const pct = total > 0 ? Math.round((count / total) * 100) : 0;
          const isWinner =
            voted !== null && count === Math.max(...Object.values(votes));
          return (
            <button
              key={o.id}
              onClick={() => vote(o.id)}
              disabled={voted !== null}
              className="relative text-left rounded-lg border border-gray-200 overflow-hidden disabled:cursor-default"
            >
              <div
                className="absolute inset-0 transition-all duration-500"
                style={{
                  width: voted !== null ? `${pct}%` : "0%",
                  backgroundColor: voted === o.id ? "#e0e7ff" : "#f3f4f6",
                }}
              />
              <div className="relative flex items-center justify-between px-3 py-2">
                <span className="text-sm text-gray-800">{o.text}</span>
                <div className="flex items-center gap-1">
                  {isWinner && voted !== null && (
                    <ThumbsUp size={11} className="text-purple-500" />
                  )}
                  {voted !== null && (
                    <span className="text-xs text-gray-500">{pct}%</span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
      {voted !== null && (
        <p className="text-xs text-gray-400 mt-2 text-center">
          {total} vote{total !== 1 ? "s" : ""}
        </p>
      )}
    </div>
  );
}

// ── Calculator Card ───────────────────────────────────────────────

export interface CalcData {
  expression: string;
  result: number;
}

export function CalculatorCard({ data }: { data: CalcData }) {
  return (
    <div className="border border-gray-200 rounded-xl p-4 bg-gradient-to-br from-gray-50 to-gray-100 mt-2 w-56">
      <div className="flex items-center gap-2 mb-2">
        <Calculator size={14} className="text-gray-500" />
        <span className="text-xs text-gray-500 font-medium">Calculator</span>
      </div>
      <p className="text-gray-400 text-sm font-mono">{data.expression}</p>
      <p className="text-3xl font-bold text-gray-900 font-mono mt-1">
        = {data.result}
      </p>
    </div>
  );
}

// ── Time Card ─────────────────────────────────────────────────────

export interface TimeData {
  formatted: string;
  iso: string;
  timezone: string;
}

export function TimeCard({ data }: { data: TimeData }) {
  return (
    <div className="border border-gray-200 rounded-xl p-4 bg-gradient-to-br from-indigo-50 to-purple-50 mt-2 w-64">
      <div className="flex items-center gap-2 mb-2">
        <Clock size={14} className="text-indigo-500" />
        <span className="text-xs text-indigo-500 font-medium">
          {data.timezone}
        </span>
      </div>
      <p className="text-gray-800 text-sm font-medium leading-relaxed">
        {data.formatted}
      </p>
    </div>
  );
}
