import {
  useState,
  useEffect,
  useContext,
  createContext,
  useCallback,
} from "react";
import { Drawer } from "vaul";
import { CopilotProvider, useCopilot } from "@yourgpt/copilot-sdk/react";
import {
  CopilotChat,
  PromptInput,
  PromptInputTextarea,
  PromptInputActions,
  PromptInputAction,
  SendIcon,
  StopIcon,
} from "@yourgpt/copilot-sdk/ui";
import type { ToolRendererProps } from "@yourgpt/copilot-sdk/ui";
import "@yourgpt/copilot-sdk/ui/styles.css";

// ─── Skill Activity Context ───────────────────────────────────────────────────

interface SkillActivity {
  executingSkill: string | null;
  loadedSkills: Set<string>;
  setExecutingSkill: (name: string | null) => void;
  addLoadedSkill: (name: string) => void;
}

const SkillActivityContext = createContext<SkillActivity>({
  executingSkill: null,
  loadedSkills: new Set(),
  setExecutingSkill: () => {},
  addLoadedSkill: () => {},
});

// ─── Skill Domain Icons ───────────────────────────────────────────────────────

function OnboardingIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
      <circle
        cx="10"
        cy="6"
        r="3"
        stroke="currentColor"
        strokeWidth="1.75"
        fill="currentColor"
        fillOpacity="0.12"
      />
      <path
        d="M4 17c0-3.314 2.686-6 6-6s6 2.686 6 6"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <path
        d="M13.5 10l1.5 1.5L17 9"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ReviewIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
      <rect
        x="3"
        y="3"
        width="14"
        height="14"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.75"
        fill="currentColor"
        fillOpacity="0.08"
      />
      <path
        d="M6.5 10l2.5 2.5L13.5 8"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function DefaultSkillIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
      <circle
        cx="10"
        cy="10"
        r="7"
        stroke="currentColor"
        strokeWidth="1.75"
        opacity="0.35"
      />
      <path
        d="M10 7V10.5L12.5 13"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ─── Skill Config Map ─────────────────────────────────────────────────────────

interface SkillConfig {
  color: string;
  bg: string;
  Icon: () => JSX.Element;
}

const SKILL_CONFIGS: Record<string, SkillConfig> = {
  "employee-onboarding": {
    color: "#0d9488",
    bg: "rgba(13, 148, 136, 0.08)",
    Icon: OnboardingIcon,
  },

  "performance-review": {
    color: "#2563eb",
    bg: "rgba(37, 99, 235, 0.08)",
    Icon: ReviewIcon,
  },
};

// ─── General Icons ────────────────────────────────────────────────────────────

function AiIdeaIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M11.5 1.25C12.5375 1.25 13.5302 1.4415 14.4448 1.79107L14.3664 2.00295C14.1817 2.50197 14.0537 2.81903 13.9797 2.97966C13.819 3.05365 13.502 3.18172 13.003 3.36637L12.3059 3.6243C11.5211 3.91472 11 4.66312 11 5.5C11 6.33688 11.5211 7.08527 12.3059 7.3757L13.003 7.63363C13.502 7.81828 13.819 7.94635 13.9797 8.02034C14.0537 8.18097 14.1817 8.49803 14.3664 8.99705L14.6243 9.69407C14.9147 10.4789 15.6631 11 16.5 11C17.3369 11 18.0853 10.4789 18.3757 9.69407L18.6336 8.99705C18.8183 8.49803 18.9463 8.18097 19.0203 8.02034C19.1296 7.97001 19.3112 7.89466 19.5733 7.7935C19.6891 8.34411 19.75 8.91495 19.75 9.5C19.75 12.6019 18.0381 15.304 15.5075 16.713L15.398 17.37C15.2172 18.4549 14.2785 19.2501 13.1786 19.2501H9.72003C8.62014 19.2501 7.68146 18.4549 7.50064 17.37L7.38056 16.6495C4.91156 15.2238 3.25 12.556 3.25 9.5C3.25 4.94365 6.94365 1.25 11.5 1.25ZM16.5 1.25C16.8138 1.25 17.0945 1.4454 17.2034 1.73972L17.4613 2.43675C17.8233 3.4151 17.9388 3.68091 18.1289 3.87106C18.3191 4.06121 18.5849 4.17667 19.5633 4.53869L20.2603 4.79661C20.5546 4.90552 20.75 5.18617 20.75 5.5C20.75 5.81383 20.5546 6.09448 20.2603 6.20339L19.5633 6.46131C18.5849 6.82333 18.3191 6.93879 18.1289 7.12894C17.9388 7.31909 17.8233 7.5849 17.4613 8.56325L17.2034 9.26028C17.0945 9.5546 16.8138 9.75 16.5 9.75C16.1862 9.75 15.9055 9.5546 15.7966 9.26028L15.5387 8.56325C15.1767 7.5849 15.0612 7.31909 14.8711 7.12894C14.6809 6.93879 14.4151 6.82333 13.4367 6.46131L12.7397 6.20339C12.4454 6.09448 12.25 5.81383 12.25 5.5C12.25 5.18617 12.4454 4.90552 12.7397 4.79661L13.4367 4.53869C14.4151 4.17667 14.6809 4.06121 14.8711 3.87106C15.0612 3.68091 15.1767 7.5849 15.5387 2.43675L15.7966 1.73972C15.9055 1.4454 16.1862 1.25 16.5 1.25ZM8.75 20.5V20.9999C8.75 21.9664 9.5335 22.7499 10.5 22.7499H12.5C13.4665 22.7499 14.25 21.9664 14.25 20.9999V20.5H8.75Z"
      />
    </svg>
  );
}

function CheckCircleIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 22.75C6.06294 22.75 1.25 17.9371 1.25 12C1.25 6.06294 6.06294 1.25 12 1.25C17.9371 1.25 22.75 6.06294 22.75 12C22.75 17.9371 17.9371 22.75 12 22.75ZM16.48 9.37756C16.9645 9.11257 17.1425 8.50493 16.8775 8.02038C16.6125 7.53582 16.0049 7.35782 15.5204 7.62282C13.6917 8.62286 12.1796 10.5529 11.1629 12.1096C10.7872 12.685 10.4662 13.2297 10.2094 13.6911C9.96984 13.4587 9.73258 13.257 9.52038 13.0892C9.2427 12.8697 8.99282 12.6965 8.81063 12.5772L8.49559 12.3815C8.01585 12.1079 7.40513 12.275 7.13152 12.7548C6.85797 13.2344 7.02493 13.8449 7.50442 14.1187L7.71471 14.2502C7.85752 14.3437 8.05764 14.4823 8.27997 14.6581C8.73753 15.0198 9.23126 15.494 9.54198 16.0135C9.73267 16.3323 10.0844 16.5191 10.4553 16.4987C10.8261 16.4782 11.1551 16.2536 11.3096 15.9159L11.4079 15.7105C11.4756 15.5721 11.577 15.3697 11.709 15.1204C11.9735 14.6207 12.3581 13.9372 12.8374 13.2032C13.8208 11.6975 15.1086 10.1275 16.48 9.37756Z"
      />
    </svg>
  );
}

// ─── TextShimmer ──────────────────────────────────────────────────────────────

function TextShimmer({
  children,
  duration = 1.8,
}: {
  children: string;
  duration?: number;
}) {
  return (
    <span
      className="text-shimmer"
      style={{ animationDuration: `${duration}s` }}
    >
      {children}
    </span>
  );
}

// ─── Tool Renderers ───────────────────────────────────────────────────────────

function SkillLoadedCard({ execution }: ToolRendererProps) {
  const { setExecutingSkill, addLoadedSkill, loadedSkills } =
    useContext(SkillActivityContext);

  const skillName = (execution.args?.name ??
    execution.args?.skill_name ??
    execution.args?.skill ??
    "skill") as string;

  // Sync state to skills panel — must be before any early return (Rules of Hooks)
  useEffect(() => {
    if (execution.status === "pending" || execution.status === "executing") {
      setExecutingSkill(skillName);
    } else if (execution.status === "completed" && execution.result) {
      addLoadedSkill(skillName);
      const t = setTimeout(() => setExecutingSkill(null), 600);
      return () => clearTimeout(t);
    }
  }, [
    execution.status,
    execution.result,
    skillName,
    setExecutingSkill,
    addLoadedSkill,
  ]);

  // Guard phantom completed-without-result double-fire from SDK
  if (execution.status === "completed" && !execution.result) return null;

  // Deduplicate: if this skill is already loaded (from a prior execution), skip the shimmer
  if (
    (execution.status === "pending" || execution.status === "executing") &&
    loadedSkills.has(skillName)
  ) {
    return null;
  }

  if (execution.status === "pending" || execution.status === "executing") {
    return (
      <div className="flex items-center gap-1.5 px-0.5 py-1">
        <AiIdeaIcon className="size-4 shrink-0 text-primary" />
        <span className="text-xs text-muted-foreground">Reading from:</span>
        <TextShimmer duration={1.8}>{skillName}</TextShimmer>
      </div>
    );
  }

  if (execution.status === "error" || execution.status === "failed") {
    return (
      <div className="flex items-center gap-1.5 px-0.5 py-1">
        <span className="text-xs text-destructive">
          Failed to load skill: {skillName}
        </span>
      </div>
    );
  }

  // Completed with result — show a distinct "read" confirmation
  return (
    <div className="flex items-center gap-1.5 px-0.5 py-1">
      <AiIdeaIcon className="size-4 shrink-0 text-primary" />
      <p className="text-xs text-muted-foreground">
        Reading from:{" "}
        <span className="font-medium text-foreground">{skillName}</span>
      </p>
    </div>
  );
}

function FallbackToolCard({ execution }: ToolRendererProps) {
  const label = execution.name
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

  if (execution.status === "pending" || execution.status === "executing") {
    return (
      <div className="px-0.5 py-1">
        <TextShimmer>{`Running ${label}…`}</TextShimmer>
      </div>
    );
  }

  const isError = execution.status === "error" || execution.status === "failed";
  return (
    <div className="flex items-center gap-1.5 px-0.5 py-1">
      {isError ? (
        <span className="size-4 text-destructive shrink-0 text-sm">✕</span>
      ) : (
        <CheckCircleIcon className="size-4 text-emerald-500 shrink-0" />
      )}
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

const toolRenderers = { load_skill: SkillLoadedCard };

// ─── Custom Fixed Input ───────────────────────────────────────────────────────
// Uses useCopilot() (CopilotProvider-level) instead of useCopilotChatContext()
// so it can live as a sibling to CopilotChat without being inside renderInput.
// This lets the SDK's use-stick-to-bottom auto-scroll work correctly.

function CustomInput() {
  const { sendMessage, stop, isLoading } = useCopilot();
  const [value, setValue] = useState("");

  const submit = () => {
    if (!value.trim() || isLoading) return;
    sendMessage(value);
    setValue("");
  };

  return (
    <div className="custom-input-fixed">
      <PromptInput
        value={value}
        onValueChange={setValue}
        onSubmit={submit}
        isLoading={isLoading}
        className="custom-prompt-input"
      >
        <PromptInputTextarea
          placeholder="Ask about onboarding, video updates, performance reviews…"
          className="custom-prompt-textarea"
        />
        <PromptInputActions className="custom-prompt-actions">
          <PromptInputAction tooltip={isLoading ? "Stop" : "Send"}>
            <button
              onClick={isLoading ? stop : submit}
              className="custom-send-btn"
            >
              {isLoading ? (
                <StopIcon className="size-3.5" />
              ) : (
                <SendIcon className="size-3.5" />
              )}
            </button>
          </PromptInputAction>
        </PromptInputActions>
      </PromptInput>
    </div>
  );
}

// ─── Welcome message (bypasses home screen; shown on load) ───────────────────

const INITIAL_MESSAGES = [
  {
    id: "welcome-1",
    role: "assistant" as const,
    content:
      "Hey! I'm your **HR Copilot** — your AI assistant for people operations.\n\nI can help you with:\n- **Employee Onboarding** — checklists, Day 1 plans, 30/60/90 milestones\n- **Performance Reviews** — review cycles, calibration, feedback frameworks\n\nJust ask me anything to get started.",
    createdAt: new Date(),
  },
];

// ─── Logo avatar ─────────────────────────────────────────────────────────────

function LogoAvatar() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 28 28"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        opacity="0.4"
        d="M17.3887 1.87109C17.7844 1.87109 18.1273 2.14532 18.2143 2.53134L18.8221 5.22971C19.2659 7.19972 20.8043 8.73814 22.7743 9.1819L25.4727 9.78974C25.8588 9.8767 26.1329 10.2196 26.1329 10.6153C26.1329 11.011 25.8588 11.3538 25.4727 11.4408L22.7743 12.0486C20.8043 12.4924 19.2659 14.0308 18.8221 16.0008L18.2143 18.6992C18.1273 19.0853 17.7844 19.3594 17.3887 19.3594C16.993 19.3594 16.6502 19.0853 16.5632 18.6992L15.9554 16.0008C15.5116 14.0308 13.9732 12.4924 12.0032 12.0486L9.30478 11.4408C8.91876 11.3538 8.64453 11.011 8.64453 10.6153C8.64453 10.2196 8.91876 9.8767 9.30478 9.78974L12.0032 9.1819C13.9732 8.73814 15.5116 7.19972 15.9554 5.22971L16.5632 2.53134C16.6502 2.14532 16.993 1.87109 17.3887 1.87109Z"
        fill="#007676"
      />
      <path
        d="M8.36264 13.1523C8.75834 13.1523 9.10121 13.4265 9.18817 13.8126L9.62233 15.7401C9.9188 17.0561 10.9465 18.0838 12.2626 18.3802L14.19 18.8144C14.5761 18.9014 14.8503 19.2443 14.8503 19.64C14.8503 20.0356 14.5761 20.3785 14.19 20.4655L12.2626 20.8997C10.9465 21.1961 9.9188 22.2238 9.62233 23.5399L9.18817 25.4673C9.10121 25.8534 8.75834 26.1276 8.36264 26.1276C7.96694 26.1276 7.62406 25.8534 7.53711 25.4673L7.10294 23.5399C6.80647 22.2238 5.77873 21.1961 4.46266 20.8997L2.53525 20.4655C2.14923 20.3785 1.875 20.0356 1.875 19.64C1.875 19.2443 2.14923 18.9014 2.53525 18.8144L4.46266 18.3802C5.77873 18.0838 6.80647 17.0561 7.10294 15.7401L7.53711 13.8126C7.62406 13.4265 7.96694 13.1523 8.36264 13.1523Z"
        fill="#007676"
      />
    </svg>
  );
}

// ─── Message Debug Logger ─────────────────────────────────────────────────────

function MessageLogger() {
  const { messages } = useCopilot();
  useEffect(() => {
    console.log(
      `[SDK messages] count=${messages.length}`,
      messages.map((m) => ({
        role: m.role,
        content:
          typeof m.content === "string"
            ? m.content.slice(0, 80)
            : JSON.stringify(m.content).slice(0, 120),
      })),
    );
  }, [messages]);
  return null;
}

// ─── Chat Inner ───────────────────────────────────────────────────────────────

function ChatInner() {
  return (
    <div className="h-[600px] my-auto">
      <MessageLogger />
      <CopilotChat
        className=""
        loaderVariant="typing"
        placeholder="Ask about onboarding, video updates, performance reviews…"
        toolRenderers={toolRenderers}
        fallbackToolRenderer={FallbackToolCard}
        attachmentsEnabled={false}
        assistantAvatar={{
          component: <LogoAvatar />,
          className:
            "!bg-white !rounded-full shadow-sm flex items-center justify-center",
        }}
      />
    </div>
  );
}

// ─── Skills Panel ─────────────────────────────────────────────────────────────

interface Skill {
  name: string;
  description: string;
  strategy: string;
  version?: string;
  source?: string;
}

function slugToTitle(slug: string): string {
  return slug.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function parseFrontmatter(content: string): Record<string, string> {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};
  const result: Record<string, string> = {};
  for (const line of match[1].split(/\r?\n/)) {
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    const val = line
      .slice(colonIdx + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
    if (key) result[key] = val;
  }
  return result;
}

function SkillCard({ skill }: { skill: Skill }) {
  const { executingSkill, loadedSkills } = useContext(SkillActivityContext);
  const isExecuting = executingSkill === skill.name;
  const isLoaded = loadedSkills.has(skill.name);
  const isActive = isExecuting || isLoaded;

  const config = SKILL_CONFIGS[skill.name];
  const Icon = config?.Icon ?? DefaultSkillIcon;
  const color = config?.color ?? "#6b7280";
  const bg = config?.bg ?? "rgba(107, 114, 128, 0.08)";
  const displayName = slugToTitle(skill.name);

  const [open, setOpen] = useState(false);
  const [content, setContent] = useState<string | null>(null);

  const handleOpen = (val: boolean) => {
    setOpen(val);
    if (val && content === null) {
      fetch(`/api/skills/${skill.name}`)
        .then((r) => r.json())
        .then((d) => {
          // Strip frontmatter block
          const raw: string = d.content ?? "";
          const stripped = raw.replace(/^---[\s\S]*?---\r?\n/, "").trim();
          setContent(stripped);
        })
        .catch(() => setContent("Could not load skill content."));
    }
  };

  const cardEl = (
    <div
      className={`skill-card${isActive ? " skill-card--active" : ""}${isExecuting ? " skill-card--executing" : ""}`}
      style={
        isActive
          ? ({
              "--skill-color": color,
              "--skill-bg": bg,
            } as React.CSSProperties)
          : undefined
      }
    >
      <div className="skill-card-body">
        <div
          className="skill-icon-wrap"
          style={{
            background: isActive ? bg : "rgba(0,0,0,0.04)",
            color: isActive ? color : "#9ca3af",
          }}
        >
          <Icon />
        </div>
        <div className="skill-card-content">
          <div className="skill-card-header">
            <span
              className="skill-card-title"
              style={isActive ? { color } : undefined}
            >
              {displayName}
            </span>
            <div className="skill-card-right">
              {isExecuting && !isLoaded && (
                <span
                  className="skill-loaded-badge"
                  style={{ color, background: bg, borderColor: color + "40" }}
                >
                  Loading…
                </span>
              )}
              {isLoaded && !isExecuting && (
                <span
                  className="skill-loaded-badge"
                  style={{ color, background: bg, borderColor: color + "40" }}
                >
                  ✓ Loaded
                </span>
              )}
              {!isActive && (
                <span
                  className={`skill-badge ${skill.source === "dropped" ? "skill-badge--dropped" : "skill-badge--file"}`}
                >
                  {skill.source === "dropped" ? "Dropped" : "Skill"}
                </span>
              )}
            </div>
          </div>
          <p className="skill-card-desc">{skill.description}</p>
        </div>
      </div>
      {isLoaded && (
        <div className="skill-loaded-section" style={{ color }}>
          <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
            <circle
              cx="6"
              cy="6"
              r="5.5"
              fill={color}
              opacity="0.18"
              stroke={color}
              strokeWidth="1"
            />
            <path
              d="M3.5 6L5 7.5L8.5 4"
              stroke={color}
              strokeWidth="1.25"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span>Loaded by Copilot</span>
        </div>
      )}
    </div>
  );

  return (
    <Drawer.Root open={open} onOpenChange={handleOpen} shouldScaleBackground>
      <Drawer.Trigger asChild>{cardEl}</Drawer.Trigger>
      <Drawer.Portal>
        <Drawer.Overlay className="skill-drawer-overlay" />
        <Drawer.Content className="skill-drawer-content">
          {/* Drag handle */}
          <div className="skill-drawer-handle" />

          {/* Header */}
          <div
            className="skill-drawer-header"
            style={{ borderColor: color + "22" }}
          >
            <div
              className="skill-drawer-icon"
              style={{ background: bg, color }}
            >
              <Icon />
            </div>
            <div className="skill-drawer-header-text">
              <Drawer.Title className="skill-drawer-title" style={{ color }}>
                {displayName}
              </Drawer.Title>
              <p className="skill-drawer-subtitle">{skill.description}</p>
            </div>
            <div className="skill-drawer-meta">
              <span
                className="skill-drawer-badge"
                style={{ background: bg, color, borderColor: color + "30" }}
              >
                {skill.strategy}
              </span>
              {skill.version && (
                <span className="skill-drawer-version">v{skill.version}</span>
              )}
            </div>
          </div>

          {/* Content */}
          <div className="skill-drawer-body">
            {content === null ? (
              <p className="skill-drawer-loading">Loading…</p>
            ) : (
              <pre className="skill-drawer-text">{content}</pre>
            )}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

function SkillsPanel() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    // Clear any dropped skills from previous session on page load
    fetch("/api/skills/dynamic", { method: "DELETE" }).catch(() => {});
    fetch("/api/skills")
      .then((r) => r.json())
      .then((data: Skill[]) => setSkills(data))
      .catch(() => {});
  }, []);

  // Window-level drag — whole page is the drop target
  useEffect(() => {
    let depth = 0;

    const onDragEnter = (e: DragEvent) => {
      if (!e.dataTransfer?.types.includes("Files")) return;
      depth++;
      if (depth === 1) setIsDragging(true);
    };

    const onDragLeave = () => {
      depth = Math.max(0, depth - 1);
      if (depth === 0) setIsDragging(false);
    };

    const onDragOver = (e: DragEvent) => {
      e.preventDefault();
    };

    const onDrop = async (e: DragEvent) => {
      e.preventDefault();
      depth = 0;
      setIsDragging(false);

      const files = Array.from(e.dataTransfer?.files ?? []).filter(
        (f) => f.name.endsWith(".md") || f.name.endsWith(".txt"),
      );
      if (!files.length) return;

      for (const file of files) {
        const content = await file.text();
        const frontmatter = parseFrontmatter(content);
        const baseName = file.name.replace(/\.(md|txt)$/, "");
        const name = frontmatter.name || baseName;
        const description =
          frontmatter.description || `Skill loaded from ${file.name}`;
        const strategy = frontmatter.strategy || "auto";

        try {
          await fetch("/api/skills/register", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ name, description, content, strategy }),
          });
          setSkills((prev) => {
            const filtered = prev.filter((s) => s.name !== name);
            return [
              ...filtered,
              { name, description, strategy, source: "dropped" },
            ];
          });
        } catch {
          // silently ignore
        }
      }
    };

    window.addEventListener("dragenter", onDragEnter);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("drop", onDrop);

    return () => {
      window.removeEventListener("dragenter", onDragEnter);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("drop", onDrop);
    };
  }, []);

  return (
    <aside className="skills-panel">
      {isDragging && (
        <div className="skills-drop-overlay">
          <div className="skills-drop-overlay-inner">
            <svg
              width="26"
              height="26"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 16v-8m0 0-3 3m3-3 3 3M6.5 19.5h11"
              />
            </svg>
            <span>Add skill</span>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="skills-panel-heading">
        <div className="skills-panel-eyebrow">
          <span className="skills-panel-live-dot" />
          Live Skills
        </div>
        <h1 className="skills-panel-title">Copilot Skills</h1>
        <p className="skills-panel-subtitle">
          {skills.length} skill{skills.length !== 1 ? "s" : ""} · loads
          automatically when relevant
        </p>
      </div>

      <div className="skills-panel-hint">
        Drop a <code>.md</code> or <code>.txt</code> anywhere to add a skill.
      </div>

      <div className="skills-list">
        {skills.length === 0 ? (
          <p className="skills-empty">No skills found.</p>
        ) : (
          skills.map((skill) => <SkillCard key={skill.name} skill={skill} />)
        )}
      </div>
    </aside>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [executingSkill, setExecutingSkill] = useState<string | null>(null);
  const [loadedSkills, setLoadedSkills] = useState<Set<string>>(new Set());

  const addLoadedSkill = useCallback((name: string) => {
    setLoadedSkills((prev) => {
      const next = new Set(prev);
      next.add(name);
      return next;
    });
  }, []);

  return (
    <SkillActivityContext.Provider
      value={{
        executingSkill,
        loadedSkills,
        setExecutingSkill,
        addLoadedSkill,
      }}
    >
      <div
        data-vaul-drawer-wrapper
        className="root data-[vaul-drawer-wrapper=true]:!rounded-[16px]"
      >
        <div className="app max-w-5xl mx-auto">
          <SkillsPanel />
          <main className="chat-panel">
            <CopilotProvider
              runtimeUrl="/api/chat"
              initialMessages={INITIAL_MESSAGES}
            >
              <ChatInner />
            </CopilotProvider>
          </main>
        </div>
      </div>
    </SkillActivityContext.Provider>
  );
}
