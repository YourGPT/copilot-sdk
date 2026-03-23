import {
  CopilotProvider,
  useCopilot,
  useCopilotEvent,
} from "@yourgpt/copilot-sdk/react";
import Sidebar from "./components/Sidebar";
import MessageList from "./components/MessageList";
import MessageInput from "./components/MessageInput";
import { useState } from "react";

// Channels
const CHANNELS = [
  { id: "general", name: "general" },
  { id: "random", name: "random" },
  { id: "ai-assistant", name: "ai-assistant" },
];

function ChatApp() {
  const [activeChannel, setActiveChannel] = useState("ai-assistant");
  const { messageMeta } = useCopilot();

  // Write thinking text to messageMeta during streaming
  useCopilotEvent("thinking:delta", (e) => {
    if (!e.messageId) return;
    messageMeta.updateMeta(e.messageId, (prev) => ({
      ...prev,
      thinking: ((prev.thinking as string) ?? "") + e.content,
      isThinking: true,
    }));
  });

  useCopilotEvent("message:end", (e) => {
    if (!e.messageId) return;
    messageMeta.updateMeta(e.messageId, (prev) => ({
      ...prev,
      isThinking: false,
    }));
  });

  // Track active tools per message
  useCopilotEvent("action:start", (e) => {
    if (!e.messageId) return;
    messageMeta.updateMeta(e.messageId, (prev) => ({
      ...prev,
      tools: {
        ...((prev.tools as object) ?? {}),
        [e.name]: "running",
      },
    }));
  });

  useCopilotEvent("action:end", (e) => {
    if (!e.messageId) return;
    messageMeta.updateMeta(e.messageId, (prev) => ({
      ...prev,
      tools: {
        ...((prev.tools as object) ?? {}),
        [e.name]: e.error ? "error" : "done",
      },
    }));
  });

  return (
    <div className="flex h-screen bg-white overflow-hidden">
      <Sidebar
        channels={CHANNELS}
        activeChannel={activeChannel}
        onChannelSelect={setActiveChannel}
      />
      <div className="flex flex-col flex-1 min-w-0">
        {/* Channel header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-200 bg-white shadow-sm shrink-0">
          <span className="text-gray-500 text-lg">#</span>
          <span className="font-bold text-gray-900 text-base">
            {activeChannel}
          </span>
          <span className="text-gray-400 text-sm ml-2 hidden sm:block">
            AI-powered channel — ask anything
          </span>
        </div>

        <MessageList />
        <MessageInput />
      </div>
    </div>
  );
}

export default function App() {
  return (
    <CopilotProvider runtimeUrl="/api/copilot">
      <ChatApp />
    </CopilotProvider>
  );
}
