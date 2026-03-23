import { useState, useRef, KeyboardEvent } from "react";
import { useCopilot } from "@yourgpt/copilot-sdk/react";
import { Send, Paperclip, Smile } from "lucide-react";

export default function MessageInput() {
  const [input, setInput] = useState("");
  const { sendMessage, status } = useCopilot();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = () => {
    const text = input.trim();
    if (!text || status === "streaming") return;
    sendMessage(text);
    setInput("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  };

  return (
    <div className="px-4 pb-4 pt-2 shrink-0">
      <div className="border border-gray-300 rounded-lg overflow-hidden focus-within:border-gray-400 focus-within:ring-1 focus-within:ring-gray-300 transition-all">
        {/* Toolbar */}
        <div className="flex items-center gap-1 px-3 pt-2 pb-1 border-b border-gray-100">
          <button className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
            <Paperclip size={15} />
          </button>
          <button className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
            <Smile size={15} />
          </button>
        </div>

        {/* Textarea */}
        <div className="flex items-end gap-2 px-3 py-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onInput={handleInput}
            placeholder="Message #ai-assistant"
            rows={1}
            disabled={status === "streaming"}
            className="flex-1 resize-none bg-transparent text-sm text-gray-800 placeholder-gray-400 outline-none leading-5 max-h-40 disabled:opacity-50"
            style={{ minHeight: "20px" }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || status === "streaming"}
            className="shrink-0 w-7 h-7 rounded flex items-center justify-center transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            style={{
              backgroundColor:
                input.trim() && status !== "streaming" ? "#007a5a" : undefined,
              color: input.trim() && status !== "streaming" ? "white" : "#aaa",
            }}
          >
            <Send size={14} />
          </button>
        </div>

        {/* Hint */}
        <div className="px-3 pb-2 flex items-center justify-between">
          <span className="text-xs text-gray-400">
            <kbd className="bg-gray-100 px-1 rounded text-[10px]">Enter</kbd> to
            send &nbsp;·&nbsp;
            <kbd className="bg-gray-100 px-1 rounded text-[10px]">
              Shift+Enter
            </kbd>{" "}
            for new line
          </span>
          {status === "streaming" && (
            <span className="text-xs text-purple-500 animate-pulse">
              AI is typing…
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
