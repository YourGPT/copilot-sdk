import { useEffect, useRef } from "react";
import { useCopilot } from "@yourgpt/copilot-sdk/react";
import Message from "./Message";
import { Bot } from "lucide-react";

export default function MessageList() {
  const { messages, status } = useCopilot();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center px-8 gap-4">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center">
          <Bot size={32} className="text-white" />
        </div>
        <div>
          <h2 className="font-bold text-gray-900 text-xl mb-1">AI Assistant</h2>
          <p className="text-gray-500 text-sm max-w-xs">
            This is the beginning of your conversation. Ask anything — I'm here
            to help.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto py-4 slack-scroll">
      {messages.map((m) => (
        <Message key={m.id} message={m} />
      ))}
      {status === "streaming" &&
        messages[messages.length - 1]?.role !== "assistant" && (
          <div className="px-4 py-1.5">
            <div className="flex gap-1 items-center h-5 ml-12">
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
          </div>
        )}
      <div ref={bottomRef} />
    </div>
  );
}
