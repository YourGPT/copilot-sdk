import { useMessageMeta } from "@yourgpt/copilot-sdk/react";
import {
  Bot,
  User,
  Loader2,
  Wrench,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import {
  WeatherCard,
  SearchCard,
  PollCard,
  CalculatorCard,
  TimeCard,
} from "./ToolCards";
import type {
  WeatherData,
  SearchData,
  PollData,
  CalcData,
  TimeData,
} from "./ToolCards";

interface ToolExecution {
  id: string;
  name: string;
  status: string;
  result?: { success: boolean; data?: unknown };
}

interface MessageProps {
  message: {
    id: string;
    role: string;
    content: string;
    createdAt?: Date;
    metadata?: { toolExecutions?: ToolExecution[] };
  };
}

interface MyMeta extends Record<string, unknown> {
  thinking?: string;
  isThinking?: boolean;
  tools?: Record<string, "running" | "done" | "error">;
  toolResults?: Record<string, { success: boolean; data?: unknown }>;
}

function formatTime(date?: Date) {
  if (!date) return "";
  return new Intl.DateTimeFormat("en", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

export default function Message({ message }: MessageProps) {
  const { meta } = useMessageMeta<MyMeta>(message.id);
  const isAssistant = message.role === "assistant";
  const tools = meta.tools ?? {};
  const runningTools = Object.entries(tools).filter(([, v]) => v === "running");
  const doneTools = Object.entries(tools).filter(([, v]) => v === "done");
  const errorTools = Object.entries(tools).filter(([, v]) => v === "error");

  return (
    <div className="flex gap-3 px-4 py-1.5 hover:bg-[var(--message-hover)] group rounded-lg mx-2">
      {/* Avatar */}
      <div className="shrink-0 mt-0.5">
        {isAssistant ? (
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center">
            <Bot size={18} className="text-white" />
          </div>
        ) : (
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-green-400 to-teal-500 flex items-center justify-center">
            <User size={18} className="text-white" />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Name + time */}
        <div className="flex items-baseline gap-2 mb-0.5">
          <span className="font-bold text-gray-900 text-sm">
            {isAssistant ? "AI Assistant" : "You"}
          </span>
          <span className="text-gray-400 text-xs opacity-0 group-hover:opacity-100 transition-opacity">
            {formatTime(message.createdAt ?? new Date())}
          </span>
        </div>

        {/* Thinking indicator */}
        {meta.isThinking && (
          <div className="flex items-center gap-1.5 text-xs text-purple-600 mb-1 bg-purple-50 rounded px-2 py-1 w-fit">
            <Loader2 size={11} className="animate-spin" />
            <span>Thinking…</span>
            {meta.thinking && (
              <span className="text-purple-400 truncate max-w-48">
                {meta.thinking.slice(-60)}
              </span>
            )}
          </div>
        )}

        {/* Running tools */}
        {runningTools.map(([name]) => (
          <div
            key={name}
            className="flex items-center gap-1.5 text-xs text-blue-600 mb-1 bg-blue-50 rounded px-2 py-1 w-fit"
          >
            <Loader2 size={11} className="animate-spin" />
            <Wrench size={11} />
            <span>{name.replace(/_/g, " ")}</span>
          </div>
        ))}

        {/* Done tools */}
        {doneTools.map(([name]) => (
          <div
            key={name}
            className="flex items-center gap-1.5 text-xs text-green-600 mb-1 bg-green-50 rounded px-2 py-1 w-fit"
          >
            <CheckCircle2 size={11} />
            <span>{name.replace(/_/g, " ")}</span>
          </div>
        ))}

        {/* Error tools */}
        {errorTools.map(([name]) => (
          <div
            key={name}
            className="flex items-center gap-1.5 text-xs text-red-600 mb-1 bg-red-50 rounded px-2 py-1 w-fit"
          >
            <XCircle size={11} />
            <span>{name.replace(/_/g, " ")} failed</span>
          </div>
        ))}

        {/* Tool result cards — read from message.metadata (persistent across remounts) */}
        {(message.metadata?.toolExecutions ?? [])
          .filter(
            (t) =>
              t.status === "completed" && t.result?.success && t.result?.data,
          )
          .map((t) => {
            const data = t.result!.data as Record<string, unknown>;
            if (t.name === "get_weather")
              return (
                <WeatherCard key={t.id} data={data as unknown as WeatherData} />
              );
            if (t.name === "search_web")
              return (
                <SearchCard key={t.id} data={data as unknown as SearchData} />
              );
            if (t.name === "create_poll")
              return <PollCard key={t.id} data={data as unknown as PollData} />;
            if (t.name === "calculate")
              return (
                <CalculatorCard key={t.id} data={data as unknown as CalcData} />
              );
            if (t.name === "get_time")
              return <TimeCard key={t.id} data={data as unknown as TimeData} />;
            return null;
          })}

        {/* Message text */}
        {message.content && (
          <p className="text-gray-800 text-sm leading-relaxed whitespace-pre-wrap">
            {message.content}
          </p>
        )}

        {/* Streaming placeholder — only when no tool cards to show */}
        {!message.content &&
          !meta.isThinking &&
          isAssistant &&
          !message.metadata?.toolExecutions?.length && (
            <div className="flex gap-1 items-center h-5">
              <span
                className="w-2 h-2 rounded-full bg-gray-400 animate-bounce"
                style={{ animationDelay: "0ms" }}
              />
              <span
                className="w-2 h-2 rounded-full bg-gray-400 animate-bounce"
                style={{ animationDelay: "150ms" }}
              />
              <span
                className="w-2 h-2 rounded-full bg-gray-400 animate-bounce"
                style={{ animationDelay: "300ms" }}
              />
            </div>
          )}
      </div>
    </div>
  );
}
