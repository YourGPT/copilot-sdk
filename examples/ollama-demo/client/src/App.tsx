import { CopilotProvider } from "@yourgpt/copilot-sdk/react";
import {
  CopilotChat,
  useCopilotChatContext,
  ThreadPicker,
} from "@yourgpt/copilot-sdk/ui";
import { useState } from "react";

function Suggestions() {
  const { send } = useCopilotChatContext();

  const suggestions = [
    "What can you help me with?",
    "What's the weather in Tokyo?",
    "Calculate 15% tip on $84.50",
    "Write a short poem about coding",
  ];

  return (
    <div className="flex flex-wrap gap-3 justify-center max-w-[600px] mt-8">
      {suggestions.map((text) => (
        <button
          key={text}
          onClick={() => send(text)}
          className="glass-button px-5 py-2.5 rounded-2xl text-sm text-slate-200 cursor-pointer border border-white/8 hover:border-white/16 hover:bg-white/8 transition-[background-color,border-color,color,transform,box-shadow] duration-200 ease-out hover:-translate-y-[1px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/40"
        >
          {text}
        </button>
      ))}
    </div>
  );
}
function CustomThreadPicker() {
  const {
    threads,
    currentThreadId,
    onSwitchThread,
    onNewChat,
    onDeleteThread,
  } = useCopilotChatContext();

  const cleanThreads = (threads || []).map((t) => ({
    ...t,
    preview: t.preview === t.title ? undefined : t.preview,
  }));

  return (
    <div className="w-[200px]">
      <ThreadPicker
        threads={cleanThreads}
        value={currentThreadId}
        onSelect={(id) => onSwitchThread?.(id)}
        onNewThread={onNewChat}
        onDeleteThread={(id) => onDeleteThread?.(id)}
        buttonClassName="glass-button w-full px-4 py-2.5 rounded-xl flex items-center justify-between text-slate-300 hover:text-white transition-[background-color,border-color,color,transform,box-shadow] duration-200 ease-out bg-white/4 hover:bg-white/8 border border-white/8 hover:border-white/16 group shadow-sm hover:-translate-y-[1px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/40"
        dropdownClassName="bg-[#0f172a]/95 backdrop-blur-2xl border border-white/10 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.5)] rounded-xl p-2 z-50 mt-2 w-[260px] animate-in fade-in zoom-in-95 duration-200 ring-1 ring-white/5"
        itemClassName="group flex items-center w-full hover:bg-white/5 text-left rounded-lg px-3 py-2.5 text-sm text-slate-400 hover:text-white transition-[background-color,border-color,color] duration-200 cursor-pointer mb-1 last:mb-0 border border-transparent hover:border-white/8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/40"
        newButtonClassName="w-full mb-2 bg-linear-to-r from-indigo-500/18 to-purple-500/18 hover:from-indigo-500/26 hover:to-purple-500/26 text-indigo-200 hover:text-white border border-indigo-400/35 hover:border-indigo-300/45 rounded-lg px-3 py-2.5 text-sm font-medium transition-[background-color,border-color,color,transform,box-shadow] duration-200 ease-out shadow-sm flex items-center justify-center gap-2 hover:-translate-y-[1px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/40"
      />
    </div>
  );
}

function ChatInterface() {
  const [showHelp, setShowHelp] = useState(false);

  return (
    <div
      className="min-h-screen w-full flex flex-col items-center justify-center p-4 sm:p-6 md:p-8 bg-linear-to-br from-slate-900 via-[#0f172a] to-indigo-950/20"
      data-csdk-theme="modern-minimal"
    >
      <div className="glass-panel w-full max-w-[1000px] h-[85vh] sm:h-[90vh] rounded-2xl sm:rounded-3xl overflow-hidden flex flex-col relative shadow-2xl ring-1 ring-white/10">
        <CopilotChat.Root
          persistence={true}
          className="h-full flex flex-col"
          showPoweredBy={false}
          assistantAvatar={{
            component: (
              <div className="w-8 h-8 rounded-full bg-linear-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold shadow-lg ring-2 ring-indigo-500/20">
                AI
              </div>
            ),
          }}
        >
          <CopilotChat.HomeView className="flex-1 flex flex-col items-center justify-center gap-8 p-4 sm:p-8 text-center relative overflow-hidden">
            {/* Background decoration */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] sm:w-[600px] h-[300px] sm:h-[600px] bg-indigo-500/10 rounded-full blur-[80px] sm:blur-[120px] -z-10 pointer-events-none" />

            <div className="flex flex-col items-center gap-6 z-10 max-w-2xl w-full mx-auto">
              <div className="relative group">
                <div className="text-6xl sm:text-7xl mb-4 animate-bounce-slow transition-transform group-hover:scale-110 duration-300">
                  🦙
                </div>
                <div className="absolute inset-0 bg-indigo-500/20 blur-2xl rounded-full -z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              </div>

              <div className="space-y-4">
                <h1 className="text-4xl sm:text-6xl font-bold tracking-tight text-gradient leading-tight">
                  Ollama Local AI
                </h1>
                <p className="text-gray-400 text-base sm:text-lg max-w-md mx-auto leading-relaxed font-light">
                  Private, ultra-fast, and running entirely on your machine.
                </p>
              </div>

              <div className="w-full max-w-xl relative group mt-4">
                <div className="absolute -inset-1 bg-linear-to-r from-indigo-500 via-purple-500 to-indigo-500 rounded-full opacity-20 group-hover:opacity-50 transition duration-500 blur-lg"></div>
                <CopilotChat.Input
                  placeholder="Ask anything..."
                  className="relative w-full bg-slate-900/80! backdrop-blur-xl! border-white/10! text-white! placeholder-gray-500! rounded-full! px-6! sm:px-8! py-4! sm:py-5! shadow-2xl! focus:ring-1! focus:ring-white/20! transition-all duration-300 text-base sm:text-lg"
                />
              </div>

              <Suggestions />
            </div>
          </CopilotChat.HomeView>

          <CopilotChat.ChatView>
            <CopilotChat.Header className="flex items-center justify-between gap-4 py-4 px-6 border-b border-white/5 bg-slate-900/40 backdrop-blur-md h-[72px]">
              <div className="flex items-center gap-4">
                <CopilotChat.BackButton className="glass-button w-10 h-10 flex items-center justify-center rounded-xl text-slate-300 hover:text-white transition-[background-color,border-color,color,transform] duration-200 ease-out hover:bg-white/8 border border-white/8 hover:border-white/16 shadow-sm hover:-translate-y-[1px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/40">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="m15 18-6-6 6-6" />
                  </svg>
                </CopilotChat.BackButton>
                <div className="flex flex-col gap-0.5">
                  <span className="font-bold text-lg text-white leading-tight tracking-tight">
                    Ollama Chat
                  </span>
                  <span className="text-[11px] text-indigo-300/70 flex items-center gap-1.5 font-medium uppercase tracking-wider">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)] animate-pulse" />
                    Local & Private
                  </span>
                </div>
              </div>

              <CustomThreadPicker />
            </CopilotChat.Header>
          </CopilotChat.ChatView>
        </CopilotChat.Root>
      </div>

      <button
        type="button"
        onClick={() => setShowHelp(true)}
        className="fixed bottom-5 left-5 sm:bottom-6 sm:left-6 z-40 glass-button w-12 h-12 rounded-full flex items-center justify-center text-slate-100 hover:text-white border border-white/10 hover:border-white/20 transition-[background-color,border-color,color,transform,box-shadow] duration-200 ease-out hover:-translate-y-[1px] shadow-md hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/40"
        aria-label="Open local setup help"
        title="Local setup help"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 2-3 4" />
          <path d="M12 17h.01" />
        </svg>
      </button>

      {showHelp && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm p-4 sm:p-6 flex items-end sm:items-center justify-center">
          <div className="w-full max-w-3xl max-h-[85vh] glass-panel rounded-2xl border border-white/10 shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-white/10 bg-slate-900/40">
              <div>
                <h2 className="text-lg sm:text-xl font-semibold text-white">
                  Local Setup Help
                </h2>
                <p className="text-xs sm:text-sm text-slate-300 mt-1">
                  Quick guide from the Ollama demo README
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowHelp(false)}
                className="glass-button w-10 h-10 rounded-xl flex items-center justify-center text-slate-200 hover:text-white border border-white/8 hover:border-white/16 transition-[background-color,border-color,color,transform] duration-200 ease-out hover:-translate-y-[1px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/40"
                aria-label="Close help"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </button>
            </div>

            <div className="px-5 sm:px-6 py-5 overflow-y-auto max-h-[calc(85vh-88px)] space-y-6 text-slate-200">
              <section className="space-y-2">
                <h3 className="text-base font-semibold text-white">
                  Prerequisites
                </h3>
                <ul className="list-disc pl-5 space-y-1 text-sm text-slate-300">
                  <li>Ollama installed and running</li>
                  <li>Node.js 18+</li>
                  <li>pnpm</li>
                </ul>
              </section>

              <section className="space-y-2">
                <h3 className="text-base font-semibold text-white">
                  1. Start Ollama
                </h3>
                <pre className="bg-slate-950/70 border border-white/10 rounded-xl p-3 text-xs sm:text-sm overflow-x-auto text-slate-200">
                  <code>{`ollama serve

# In another terminal, pull a model:
ollama pull llama3.1
# or smaller:
ollama pull qwen2.5:1.5b`}</code>
                </pre>
              </section>

              <section className="space-y-2">
                <h3 className="text-base font-semibold text-white">
                  2. Run the demo
                </h3>
                <pre className="bg-slate-950/70 border border-white/10 rounded-xl p-3 text-xs sm:text-sm overflow-x-auto text-slate-200">
                  <code>{`# From monorepo root:
pnpm install

cd examples/ollama-demo
pnpm dev`}</code>
                </pre>
                <p className="text-sm text-slate-300">
                  Server: <code>http://localhost:3002</code> | Client:{" "}
                  <code>http://localhost:5173</code>
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-base font-semibold text-white">
                  Useful scripts
                </h3>
                <div className="grid sm:grid-cols-2 gap-2 text-sm text-slate-300">
                  <div>
                    <code>pnpm dev</code> - server + client
                  </div>
                  <div>
                    <code>pnpm dev:server</code> - server only
                  </div>
                  <div>
                    <code>pnpm dev:client</code> - client only
                  </div>
                  <div>
                    <code>pnpm chat</code> - CLI chat demo
                  </div>
                  <div>
                    <code>pnpm tools</code> - CLI tool demo
                  </div>
                  <div>
                    <code>pnpm vision</code> - CLI vision demo
                  </div>
                </div>
              </section>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <CopilotProvider
      runtimeUrl="/api/copilot"
      systemPrompt="You are a helpful AI assistant running locally via Ollama. You have access to weather and calculator tools. Be concise and helpful."
    >
      <ChatInterface />
    </CopilotProvider>
  );
}
