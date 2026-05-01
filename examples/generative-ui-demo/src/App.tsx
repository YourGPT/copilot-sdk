import { CopilotProvider } from "@yourgpt/copilot-sdk/react";
import { CopilotChat } from "@yourgpt/copilot-sdk/ui";
import { useGenerativeUI } from "@yourgpt/copilot-sdk/experimental";
import "@yourgpt/copilot-sdk/ui/styles.css";
import { Chat01 } from "./icons/Chat01";
import { Book01 } from "./icons/Book01";
import { Mic01 } from "./icons/Mic01";
import { PlusSign } from "./icons/PlusSign";
import { MoreHorizontal } from "./icons/MoreHorizontal";
import { Home01 } from "./icons/Home01";
import { Search01 } from "./icons/Search01";
import { Attachment01 } from "./icons/Attachment01";

// ─── Data ────────────────────────────────────────────────────────────────────

const QUICK_INSIGHTS = [
  "Show me Q4 sales performance",
  "Monthly revenue trend",
  "Top customers by spend",
];

const DICEBEAR_USER =
  "https://api.dicebear.com/9.x/notionists/svg?seed=Sahil&backgroundColor=e0e0e0";
// Copilot SDK sparkle logo as avatar
function CopilotAvatar() {
  return (
    <svg width="20" height="20" viewBox="0 0 170 170" fill="none">
      <path
        opacity={0.4}
        d="M108.379 0C111.143 0 113.538 1.91574 114.146 4.61243L118.392 23.4631C121.492 37.2253 132.239 47.9726 146.001 51.0727L164.852 55.319C167.549 55.9265 169.465 58.3218 169.465 61.0861C169.465 63.8504 167.549 66.2457 164.852 66.8532L146.001 71.0995C132.239 74.1995 121.492 84.9467 118.392 98.7088L114.146 117.56C113.538 120.257 111.143 122.172 108.379 122.172C105.614 122.172 103.219 120.257 102.611 117.56L98.3651 98.7088C95.2651 84.9467 84.5179 74.1995 70.7558 71.0995L51.9049 66.8532C49.2082 66.2457 47.2924 63.8504 47.2924 61.0861C47.2924 58.3218 49.2082 55.9265 51.9049 55.319L70.7558 51.0727C84.5179 47.9726 95.2651 37.2253 98.3651 23.4631L102.611 4.61243C103.219 1.91574 105.614 0 108.379 0Z"
        fill="#6352FF"
      />
      <path
        d="M45.3219 78.8207C48.0863 78.8207 50.4816 80.736 51.089 83.4333L54.1221 96.8982C56.1931 106.092 63.3728 113.272 72.5663 115.342L86.0313 118.375C88.7285 118.983 90.6439 121.378 90.6439 124.143C90.6439 126.907 88.7285 129.302 86.0313 129.91L72.5663 132.943C63.3728 135.014 56.1931 142.193 54.1221 151.387L51.089 164.852C50.4816 167.549 48.0863 169.465 45.3219 169.465C42.5576 169.465 40.1623 167.549 39.5549 164.852L36.5218 151.387C34.4507 142.193 27.271 135.014 18.0772 132.943L4.61243 129.91C1.91574 129.302 0 126.907 0 124.143C0 121.378 1.91574 118.983 4.61243 118.375L18.0772 115.342C27.271 113.272 34.4507 106.092 36.5218 96.8982L39.5549 83.4333C40.1623 80.736 42.5576 78.8207 45.3219 78.8207Z"
        fill="#523FFF"
      />
    </svg>
  );
}

// ─── Sidebar ─────────────────────────────────────────────────────────────────

function Sidebar() {
  return (
    <aside className="w-[54px] shrink-0 border-r border-zinc-200/60 flex flex-col items-center py-3.5 gap-0.5 bg-zinc-50/80">
      <div className="w-[34px] h-[34px] rounded-[10px] bg-indigo-600 flex items-center justify-center mb-4 shadow-sm shadow-indigo-200">
        <Chat01 size={16} className="text-white" strokeWidth={2} />
      </div>

      <SidebarBtn icon={<PlusSign size={17} />} active />
      <SidebarBtn icon={<Home01 size={17} />} />
      <SidebarBtn icon={<Search01 size={17} />} />
      <SidebarBtn icon={<Attachment01 size={17} />} />
      <SidebarBtn icon={<Book01 size={17} />} />

      <div className="flex-1" />

      <SidebarBtn icon={<MoreHorizontal size={17} />} />

      <img
        src={DICEBEAR_USER}
        alt="User"
        className="w-[34px] h-[34px] rounded-full mt-1.5 ring-2 ring-white"
      />
    </aside>
  );
}

function SidebarBtn({
  icon,
  active,
}: {
  icon: React.ReactNode;
  active?: boolean;
}) {
  return (
    <button
      className={`w-[34px] h-[34px] rounded-[9px] flex items-center justify-center transition-all duration-150 ${
        active
          ? "bg-white text-zinc-800 shadow-sm ring-1 ring-zinc-200/80"
          : "text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100/80"
      }`}
    >
      {icon}
    </button>
  );
}

// ─── Top bar ─────────────────────────────────────────────────────────────────

function TopBar() {
  return (
    <header className="h-[46px] border-b border-zinc-200/60 flex items-center px-4 shrink-0 bg-white/80 backdrop-blur-sm">
      <div className="flex items-center gap-2.5">
        <div className="w-[22px] h-[22px] rounded-md bg-indigo-50 flex items-center justify-center">
          <Chat01 size={12} className="text-indigo-600" strokeWidth={2.2} />
        </div>
        <h1 className="text-[13px] font-semibold text-zinc-900 tracking-[-0.01em]">
          Generative UI Demo
        </h1>
        <span className="px-1.5 py-[1px] text-[9px] font-bold uppercase tracking-wider text-indigo-500 bg-indigo-50 rounded">
          Beta
        </span>
      </div>

      <div className="flex-1" />

      <div className="flex items-center gap-[3px] bg-zinc-100 rounded-[8px] p-[3px]">
        {["Share", "History"].map((t) => (
          <button
            key={t}
            className="px-2.5 py-[5px] text-[11px] font-medium text-zinc-500 rounded-[6px] hover:text-zinc-700 hover:bg-white/60 transition-all"
          >
            {t}
          </button>
        ))}
        <button className="px-2.5 py-[5px] text-[11px] font-semibold text-white bg-zinc-900 rounded-[6px] shadow-sm">
          Liveline
        </button>
      </div>
    </header>
  );
}

// ─── Bottom area ─────────────────────────────────────────────────────────────

function QuickInsights() {
  return (
    <div className="flex items-center gap-2 px-4 py-2 overflow-x-auto scrollbar-none border-t border-zinc-100">
      <span className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider shrink-0">
        Insights
      </span>
      <div className="w-px h-3 bg-zinc-200 shrink-0" />
      <div className="flex gap-1.5">
        {QUICK_INSIGHTS.map((q) => (
          <button
            key={q}
            className="shrink-0 px-2.5 py-[5px] text-[11px] font-medium text-zinc-500 bg-white border border-zinc-200 rounded-full hover:border-zinc-300 hover:text-zinc-700 hover:shadow-sm transition-all whitespace-nowrap"
            onClick={() => {
              const input = document.querySelector<HTMLTextAreaElement>(
                "textarea[placeholder]",
              );
              if (input) {
                const setter = Object.getOwnPropertyDescriptor(
                  window.HTMLTextAreaElement.prototype,
                  "value",
                )?.set;
                setter?.call(input, q);
                input.dispatchEvent(new Event("input", { bubbles: true }));
                input.focus();
              }
            }}
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}

function BottomBar() {
  return (
    <div className="flex items-center justify-center gap-5 py-2 text-zinc-400">
      <button className="flex items-center gap-1.5 text-[11px] hover:text-zinc-600 transition-colors">
        <Book01 size={13} strokeWidth={1.5} />
        Library
      </button>
      <div className="w-px h-3 bg-zinc-200" />
      <button className="flex items-center gap-1.5 text-[11px] hover:text-zinc-600 transition-colors">
        <Mic01 size={13} strokeWidth={1.5} />
        Voice Record
      </button>
    </div>
  );
}

// ─── Skill loading renderer ──────────────────────────────────────────────────

function SkillLoadCard({
  execution,
}: {
  execution: {
    name: string;
    status: string;
    args: Record<string, unknown>;
    result?: unknown;
  };
}) {
  const skillName = (execution.args?.name ??
    execution.args?.skill_name ??
    "skill") as string;
  const displayName = skillName
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

  if (execution.status === "pending" || execution.status === "executing") {
    return (
      <div className="flex items-center gap-2 py-1">
        <div className="w-4 h-4 rounded-full bg-indigo-100 flex items-center justify-center">
          <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
        </div>
        <span className="text-xs text-zinc-500">Loading skill:</span>
        <span className="text-xs font-medium text-indigo-600 animate-pulse">
          {displayName}
        </span>
      </div>
    );
  }

  if (execution.status === "completed") {
    return (
      <div className="flex items-center gap-2 py-1">
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          className="text-emerald-500"
        >
          <path
            d="M12 22.75C6.06 22.75 1.25 17.94 1.25 12S6.06 1.25 12 1.25 22.75 6.06 22.75 12 17.94 22.75 12 22.75Z"
            fill="currentColor"
            fillOpacity="0.15"
          />
          <path
            d="M7.5 12l3 3 6-6"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span className="text-xs text-zinc-500">Loaded:</span>
        <span className="text-xs font-medium text-zinc-700">{displayName}</span>
      </div>
    );
  }

  return null;
}

const toolRenderers = {
  load_skill: SkillLoadCard,
};

// ─── Chat ────────────────────────────────────────────────────────────────────

function GenUIChatInner() {
  const { wrapMessage } = useGenerativeUI();

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <CopilotChat
        className="flex-1"
        placeholder="Ask quick insights…"
        showHeader={false}
        loaderVariant="text-shimmer"
        showUserAvatar
        wrapMessage={wrapMessage}
        fontSize="sm"
        classNames={{ messageList: "pt-[60px]" }}
        toolRenderers={toolRenderers}
        userAvatar={{
          src: DICEBEAR_USER,
        }}
        assistantAvatar={{
          component: <CopilotAvatar />,
          className: "!bg-indigo-50/80 !p-1 !rounded-lg",
        }}
      />
      <QuickInsights />
    </div>
  );
}

// ─── App ─────────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <div className="h-screen flex bg-white">
      <CopilotProvider runtimeUrl="/api/chat">
        <Sidebar />
        <div className="flex-1 flex flex-col min-h-0 min-w-0">
          <div className="flex-1 flex justify-center min-h-0 overflow-hidden bg-background">
            <div className="w-full max-w-[820px] flex flex-col min-h-0">
              <GenUIChatInner />
            </div>
          </div>
        </div>
      </CopilotProvider>
    </div>
  );
}
