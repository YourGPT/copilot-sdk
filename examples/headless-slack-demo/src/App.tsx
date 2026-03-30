import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useParams,
  useNavigate,
} from "react-router-dom";
import {
  CopilotProvider,
  useCopilot,
  useCopilotEvent,
} from "@yourgpt/copilot-sdk/react";
import { useEffect, useRef } from "react";
import Sidebar from "./components/Sidebar";
import MessageList from "./components/MessageList";
import MessageInput from "./components/MessageInput";
import { useCalculatorTool, useTimeTool } from "./hooks/useTools";
import { loadMessages, saveMessages } from "./lib/storage";

const CHANNELS = [
  { id: "general", name: "general" },
  { id: "random", name: "random" },
  { id: "ai-assistant", name: "ai-assistant" },
  { id: "design", name: "design" },
  { id: "engineering", name: "engineering" },
];

// Inner component — mounted per channel, has access to useCopilot()
function ChannelChat({ channelId }: { channelId: string }) {
  const { messages, messageMeta } = useCopilot();

  // Register client tools
  useCalculatorTool();
  useTimeTool();

  // Only save when new messages arrive beyond what was restored from localStorage.
  // Prevents overwriting with metadata-stripped versions of restored messages.
  const initialCount = useRef(messages.length);

  useEffect(() => {
    if (messages.length <= initialCount.current) return;
    const complete = messages.filter(
      (m) => !(m.role === "assistant" && !m.content),
    );
    if (complete.length > 0) {
      saveMessages(channelId, complete);
    }
  }, [messages, channelId]);

  // Write thinking/tool state into messageMeta during streaming
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

  useCopilotEvent("action:start", (e) => {
    if (!e.messageId) return;
    messageMeta.updateMeta(e.messageId, (prev) => ({
      ...prev,
      tools: { ...((prev.tools as object) ?? {}), [e.name]: "running" },
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
      toolResults: {
        ...((prev.toolResults as object) ?? {}),
        ...(e.result ? { [e.name]: e.result } : {}),
      },
    }));
  });

  useCopilotEvent("tool:result", (e) => {
    if (!e.messageId) return;
    messageMeta.updateMeta(e.messageId, (prev) => ({
      ...prev,
      toolResults: {
        ...((prev.toolResults as object) ?? {}),
        [e.name]: e.result,
      },
    }));
  });

  return (
    <>
      <MessageList />
      <MessageInput />
    </>
  );
}

// Route component — creates CopilotProvider per channel with threadId + initialMessages
function ChannelRoute() {
  const { channelId } = useParams<{ channelId: string }>();
  const navigate = useNavigate();
  const channel = CHANNELS.find((c) => c.id === channelId);

  if (!channel) {
    navigate("/channel/general", { replace: true });
    return null;
  }

  const initialMessages = loadMessages(channelId!);

  return (
    <CopilotProvider
      key={channelId}
      runtimeUrl="/api/copilot"
      threadId={channelId}
      initialMessages={initialMessages}
    >
      <div className="flex h-screen bg-white overflow-hidden">
        <Sidebar channels={CHANNELS} activeChannel={channelId!} />
        <div className="flex flex-col flex-1 min-w-0">
          {/* Channel header */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-200 bg-white shadow-sm shrink-0">
            <span className="text-gray-500 text-lg">#</span>
            <span className="font-bold text-gray-900 text-base">
              {channel.name}
            </span>
            <span className="text-gray-400 text-sm ml-2 hidden sm:block">
              AI-powered channel
            </span>
          </div>
          <ChannelChat channelId={channelId!} />
        </div>
      </div>
    </CopilotProvider>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={<Navigate to="/channel/ai-assistant" replace />}
        />
        <Route path="/channel/:channelId" element={<ChannelRoute />} />
      </Routes>
    </BrowserRouter>
  );
}
