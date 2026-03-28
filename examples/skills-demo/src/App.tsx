import { useState, useEffect } from "react";
import { GitBranch, Zap, Bot, ChevronRight } from "lucide-react";
import { CopilotProvider, CopilotChat } from "@yourgpt/copilot-sdk/ui";
import "@yourgpt/copilot-sdk/ui/styles.css";

// ============================================
// Types
// ============================================

interface SkillInfo {
  name: string;
  description: string;
  strategy: "eager" | "auto" | "manual";
  version?: string;
}

// ============================================
// Helpers
// ============================================

function formatSkillName(name: string): string {
  return name
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function StrategyBadge({ strategy }: { strategy: SkillInfo["strategy"] }) {
  const config: Record<
    SkillInfo["strategy"],
    { label: string; className: string }
  > = {
    eager: {
      label: "eager",
      className:
        "bg-emerald-500/15 text-emerald-400 border border-emerald-500/25",
    },
    auto: {
      label: "auto",
      className: "bg-blue-500/15 text-blue-400 border border-blue-500/25",
    },
    manual: {
      label: "manual",
      className: "bg-amber-500/15 text-amber-400 border border-amber-500/25",
    },
  };

  const { label, className } = config[strategy];

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${className}`}
    >
      {label}
    </span>
  );
}

// ============================================
// Toggle Switch
// ============================================

function ToggleSwitch({
  checked,
  onChange,
  id,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  id: string;
}) {
  return (
    <button
      id={id}
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-zinc-900 ${
        checked ? "bg-blue-500" : "bg-zinc-700"
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
          checked ? "translate-x-4" : "translate-x-0"
        }`}
      />
    </button>
  );
}

// ============================================
// Skill Card
// ============================================

function SkillCard({ skill }: { skill: SkillInfo }) {
  return (
    <div className="group rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 transition-colors hover:border-zinc-700 hover:bg-zinc-900">
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-medium text-zinc-100 leading-tight">
          {formatSkillName(skill.name)}
        </span>
        <StrategyBadge strategy={skill.strategy} />
      </div>
      <p className="mt-1.5 text-xs text-zinc-500 leading-relaxed line-clamp-2">
        {skill.description}
      </p>
    </div>
  );
}

// ============================================
// Sidebar
// ============================================

function Sidebar({
  branchingEnabled,
  onBranchingChange,
}: {
  branchingEnabled: boolean;
  onBranchingChange: (v: boolean) => void;
}) {
  const [skills, setSkills] = useState<SkillInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/skills")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<SkillInfo[]>;
      })
      .then((data) => {
        setSkills(data);
        setLoading(false);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Failed to load skills");
        setLoading(false);
      });
  }, []);

  return (
    <aside className="flex h-full w-[280px] flex-shrink-0 flex-col border-r border-zinc-800 bg-zinc-900">
      {/* Header */}
      <div className="border-b border-zinc-800 px-4 py-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/15 border border-blue-500/25">
            <Zap className="h-4 w-4 text-blue-400" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-zinc-100">Skills Demo</h1>
            <p className="text-xs text-zinc-500">
              Server-side skill management
            </p>
          </div>
        </div>
      </div>

      {/* Skills section */}
      <div className="flex-1 overflow-y-auto px-3 py-4">
        <div className="mb-3 flex items-center gap-1.5 px-1">
          <Bot className="h-3.5 w-3.5 text-zinc-500" />
          <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">
            Available Skills
          </span>
        </div>

        {loading && (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-16 rounded-lg border border-zinc-800 bg-zinc-900/50 animate-pulse"
              />
            ))}
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2.5">
            <p className="text-xs text-red-400">
              Failed to load skills — is the server running?
            </p>
            <p className="mt-0.5 text-xs text-red-500/70">{error}</p>
          </div>
        )}

        {!loading && !error && skills.length === 0 && (
          <p className="px-1 text-xs text-zinc-600">No skills found.</p>
        )}

        {!loading && !error && skills.length > 0 && (
          <div className="space-y-2">
            {skills.map((skill) => (
              <SkillCard key={skill.name} skill={skill} />
            ))}
          </div>
        )}

        {/* Strategy legend */}
        {!loading && !error && skills.length > 0 && (
          <div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-950/50 px-3 py-2.5">
            <p className="mb-2 text-xs font-medium text-zinc-500">
              Strategy legend
            </p>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <StrategyBadge strategy="eager" />
                <span className="text-xs text-zinc-500">Always injected</span>
              </div>
              <div className="flex items-center gap-2">
                <StrategyBadge strategy="auto" />
                <span className="text-xs text-zinc-500">
                  AI decides when to load
                </span>
              </div>
              <div className="flex items-center gap-2">
                <StrategyBadge strategy="manual" />
                <span className="text-xs text-zinc-500">
                  Explicit invocation only
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Branching section */}
      <div className="border-t border-zinc-800 px-3 py-4">
        <div className="mb-2 flex items-center gap-1.5 px-1">
          <GitBranch className="h-3.5 w-3.5 text-zinc-500" />
          <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">
            Branching
          </span>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 px-3 py-3">
          <div className="flex items-center justify-between gap-3">
            <label htmlFor="branching-toggle" className="flex-1 cursor-pointer">
              <span className="block text-sm font-medium text-zinc-200">
                Conversation Branching
              </span>
              <span className="block text-xs text-zinc-500 mt-0.5">
                Edit messages to create branches
              </span>
            </label>
            <ToggleSwitch
              id="branching-toggle"
              checked={branchingEnabled}
              onChange={onBranchingChange}
            />
          </div>
          {branchingEnabled && (
            <div className="mt-2.5 flex items-start gap-1.5 rounded-md bg-blue-500/10 border border-blue-500/20 px-2.5 py-2">
              <ChevronRight className="mt-0.5 h-3 w-3 flex-shrink-0 text-blue-400" />
              <p className="text-xs text-blue-400 leading-relaxed">
                Click the edit icon on any user message to branch the
                conversation.
              </p>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}

// ============================================
// App
// ============================================

export default function App() {
  const [branchingEnabled, setBranchingEnabled] = useState(false);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-zinc-950">
      <Sidebar
        branchingEnabled={branchingEnabled}
        onBranchingChange={setBranchingEnabled}
      />

      {/* Chat panel */}
      <main className="flex flex-1 flex-col overflow-hidden">
        <CopilotProvider runtimeUrl="/api/chat">
          <CopilotChat
            allowEdit={branchingEnabled}
            header={{
              title: "Skills Chat",
            }}
            className="h-full"
          />
        </CopilotProvider>
      </main>
    </div>
  );
}
