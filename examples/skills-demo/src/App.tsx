import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { CopilotProvider } from "@yourgpt/copilot-sdk/react";
import { CopilotChat } from "@yourgpt/copilot-sdk/ui";
import "@yourgpt/copilot-sdk/ui/styles.css";

// ─── Skill definitions (client-side metadata) ─────────────────────────────────

interface SkillMeta {
  id: string;
  name: string;
  icon: string;
  shortDesc: string;
  strategy: "eager" | "auto" | "manual";
  capabilities: string[];
  color: string;
}

type SkillState = "idle" | "scanning" | "loaded";

const SKILLS: SkillMeta[] = [
  {
    id: "revenue-intelligence",
    name: "Revenue Intelligence",
    icon: "◈",
    shortDesc: "MRR trends, churn analysis & expansion signals",
    strategy: "auto",
    capabilities: [
      "Monthly recurring revenue breakdown",
      "Churn forecasting & root cause",
      "Expansion revenue opportunity scoring",
    ],
    color: "#818cf8",
  },
  {
    id: "customer-health",
    name: "Customer Health",
    icon: "◉",
    shortDesc: "Account risk scoring & engagement signals",
    strategy: "auto",
    capabilities: [
      "Health score calculation (0–100)",
      "At-risk account early warning",
      "Engagement drop-off detection",
    ],
    color: "#34d399",
  },
  {
    id: "incident-runbook",
    name: "Incident Runbook",
    icon: "◬",
    shortDesc: "Production incident response protocol",
    strategy: "manual",
    capabilities: [
      "Severity classification P0–P3",
      "Step-by-step response checklist",
      "Stakeholder communication templates",
    ],
    color: "#fb923c",
  },
];

const METRICS = [
  { label: "MRR", value: "$124.8k", change: "+12%", up: true },
  { label: "Churn", value: "2.3%", change: "−0.4%", up: true },
  { label: "DAU", value: "8,429", change: "+5%", up: true },
  { label: "Open P1s", value: "2", change: "+2", up: false },
];

const DEMO_PROMPTS = [
  "Analyze our MRR growth and top churn risks this month",
  "Which enterprise accounts are most at risk right now?",
  "We have a P1 — payment API is returning 503 errors",
];

// ─── Skill load notifier (invisible, watches for load_skill tool calls) ───────

function SkillLoadNotifier({
  args,
  status,
  onLoaded,
}: {
  args: Record<string, unknown>;
  status: string;
  result?: unknown;
  toolCallId: string;
  onLoaded: (name: string) => void;
}) {
  const firedRef = useRef(false);
  useEffect(() => {
    if (status === "success" && args?.name && !firedRef.current) {
      firedRef.current = true;
      onLoaded(args.name as string);
    }
  }, [status, args?.name, onLoaded]);
  return null;
}

// ─── Individual skill card ────────────────────────────────────────────────────

function SkillCard({ skill, state }: { skill: SkillMeta; state: SkillState }) {
  const isLoaded = state === "loaded";
  const isScanning = state === "scanning";
  const strategyLabel = {
    eager: "ALWAYS ON",
    auto: "AUTO",
    manual: "ON DEMAND",
  };

  return (
    <div
      className="skill-card"
      data-state={state}
      style={{ "--sc": skill.color } as React.CSSProperties}
    >
      {isScanning && <div className="scan-line" />}

      <div className="sc-header">
        <span className="sc-icon" data-scanning={isScanning}>
          {skill.icon}
        </span>
        <div className="sc-title-group">
          <span className="sc-name">{skill.name}</span>
          <span className={`sc-badge sc-badge--${skill.strategy}`}>
            {strategyLabel[skill.strategy]}
          </span>
        </div>
        <span className="sc-dot" data-active={isLoaded} />
      </div>

      <p className="sc-desc">{skill.shortDesc}</p>

      <div className="sc-expanded" data-open={isLoaded}>
        <div className="sc-divider" />
        <p className="sc-active-label">✦ Skill active</p>
        <ul className="sc-caps">
          {skill.capabilities.map((cap, i) => (
            <li
              key={cap}
              className="sc-cap"
              data-visible={isLoaded}
              style={{
                transitionDelay: isLoaded ? `${0.12 + i * 0.09}s` : "0s",
              }}
            >
              <span className="sc-cap-dot" />
              {cap}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ─── Main app ─────────────────────────────────────────────────────────────────

export default function App() {
  const [skillStates, setSkillStates] = useState<Record<string, SkillState>>(
    () => Object.fromEntries(SKILLS.map((s) => [s.id, "idle"])),
  );
  const [branchingEnabled, setBranchingEnabled] = useState(false);

  const handleSkillLoaded = useCallback((skillName: string) => {
    if (!SKILLS.find((s) => s.id === skillName)) return;
    setSkillStates((prev) =>
      prev[skillName] === "loaded"
        ? prev
        : { ...prev, [skillName]: "scanning" },
    );
    setTimeout(() => {
      setSkillStates((prev) => ({ ...prev, [skillName]: "loaded" }));
    }, 1500);
  }, []);

  const toolRenderers = useMemo(
    () => ({
      load_skill: (props: {
        args: Record<string, unknown>;
        status: string;
        result?: unknown;
        toolCallId: string;
      }) => <SkillLoadNotifier {...props} onLoaded={handleSkillLoaded} />,
    }),
    [handleSkillLoaded],
  );

  const injectPrompt = (text: string) => {
    const ta = document.querySelector<HTMLTextAreaElement>(
      "textarea[placeholder]",
    );
    if (!ta) return;
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype,
      "value",
    )?.set;
    setter?.call(ta, text);
    ta.dispatchEvent(new Event("input", { bubbles: true }));
    ta.focus();
  };

  return (
    <>
      <style>{CSS}</style>
      <div className="d-root">
        {/* Top nav */}
        <header className="d-nav">
          <div className="d-nav__brand">
            <span className="d-nav__logo">⬡</span>
            <span className="d-nav__name">Dash</span>
            <span className="d-nav__platform">Operations Platform</span>
          </div>
          <nav className="d-nav__links">
            {["Overview", "Revenue", "Customers", "Incidents", "Settings"].map(
              (l) => (
                <span key={l} className="d-nav__link">
                  {l}
                </span>
              ),
            )}
          </nav>
          <div className="d-nav__copilot">
            <span className="d-nav__pulse" />
            AI Copilot
          </div>
        </header>

        <div className="d-body">
          {/* Sidebar */}
          <aside className="d-sidebar">
            {/* Metrics */}
            <section className="d-section">
              <h3 className="d-section__label">Live Metrics</h3>
              <div className="d-metrics">
                {METRICS.map((m) => (
                  <div key={m.label} className="d-metric">
                    <span className="d-metric__label">{m.label}</span>
                    <span className="d-metric__val">{m.value}</span>
                    <span className={`d-metric__chg ${m.up ? "up" : "dn"}`}>
                      {m.change}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            {/* Skills */}
            <section className="d-section d-section--skills">
              <div className="d-section__header-row">
                <h3 className="d-section__label">Copilot Skills</h3>
                <span className="d-section__count">{SKILLS.length}</span>
              </div>
              <div className="d-skills">
                {SKILLS.map((skill) => (
                  <SkillCard
                    key={skill.id}
                    skill={skill}
                    state={skillStates[skill.id] ?? "idle"}
                  />
                ))}
              </div>
            </section>

            {/* Branching */}
            <section className="d-section d-section--branch">
              <div className="d-branch">
                <div>
                  <p className="d-branch__label">Conversation Branching</p>
                  <p className="d-branch__desc">
                    Edit messages to explore alternatives
                  </p>
                </div>
                <button
                  className={`d-toggle ${branchingEnabled ? "d-toggle--on" : ""}`}
                  onClick={() => setBranchingEnabled((v) => !v)}
                />
              </div>
            </section>

            {/* Demo prompts */}
            <section className="d-section d-section--prompts">
              <h3 className="d-section__label">Try asking…</h3>
              <div className="d-prompts">
                {DEMO_PROMPTS.map((p) => (
                  <button
                    key={p}
                    className="d-prompt"
                    onClick={() => injectPrompt(p)}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </section>
          </aside>

          {/* Chat */}
          <main className="d-chat">
            <CopilotProvider runtimeUrl="/api/chat">
              <CopilotChat
                className="d-copilot"
                placeholder="Ask about revenue, customers, or incidents…"
                showHeader
                header={{ name: "Dash Copilot" }}
                loaderVariant="typing"
                showUserAvatar
                allowEdit={branchingEnabled}
                toolRenderers={toolRenderers as never}
              />
            </CopilotProvider>
          </main>
        </div>
      </div>
    </>
  );
}

// ─── All styles ───────────────────────────────────────────────────────────────

const CSS = `
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --bg:       #07090f;
  --s1:       #0b0e1a;
  --s2:       #0f1320;
  --s3:       #141929;
  --bd:       rgba(255,255,255,0.055);
  --bd2:      rgba(255,255,255,0.10);
  --t1:       #e8eaf6;
  --t2:       #7b82a8;
  --t3:       #3d4468;
  --ok:       #34d399;
  --err:      #f87171;
  --acc:      #818cf8;
  --font:     'Bricolage Grotesque', system-ui, sans-serif;
  --mono:     'JetBrains Mono', monospace;
}

body {
  background: var(--bg);
  font-family: var(--font);
  color: var(--t1);
  -webkit-font-smoothing: antialiased;
}

/* ── Root ── */
.d-root { display: flex; flex-direction: column; height: 100vh; overflow: hidden; }

/* ── Nav ── */
.d-nav {
  display: flex; align-items: center; gap: 20px;
  padding: 0 20px; height: 50px; flex-shrink: 0;
  background: var(--s1);
  border-bottom: 1px solid var(--bd);
}
.d-nav__brand  { display: flex; align-items: center; gap: 8px; }
.d-nav__logo   { font-size: 19px; color: var(--acc); }
.d-nav__name   { font-weight: 700; font-size: 15px; letter-spacing: -0.04em; }
.d-nav__platform { font-size: 11px; color: var(--t3); margin-left: 1px; }
.d-nav__links  { display: flex; gap: 1px; margin-left: auto; }
.d-nav__link   {
  padding: 4px 11px; border-radius: 6px;
  font-size: 12px; color: var(--t2); cursor: pointer;
  transition: all 0.12s;
}
.d-nav__link:hover { background: var(--s2); color: var(--t1); }
.d-nav__copilot {
  display: flex; align-items: center; gap: 7px;
  padding: 4px 12px; border-radius: 20px;
  background: rgba(129,140,248,0.08);
  border: 1px solid rgba(129,140,248,0.2);
  font-size: 11px; font-weight: 600; color: var(--acc);
  letter-spacing: 0.05em; text-transform: uppercase;
}
.d-nav__pulse {
  width: 6px; height: 6px; border-radius: 50%; background: var(--acc);
  animation: nav-pulse 2.2s ease-in-out infinite;
}
@keyframes nav-pulse {
  0%,100% { opacity:.5; transform:scale(1); }
  50%      { opacity:1;  transform:scale(1.35); }
}

/* ── Body ── */
.d-body { display: flex; flex: 1; min-height: 0; }

/* ── Sidebar ── */
.d-sidebar {
  width: 296px; flex-shrink: 0;
  background: var(--s1); border-right: 1px solid var(--bd);
  overflow-y: auto; display: flex; flex-direction: column;
  scrollbar-width: thin; scrollbar-color: var(--bd2) transparent;
}

.d-section {
  padding: 14px 14px;
  border-bottom: 1px solid var(--bd);
}
.d-section__label {
  font-size: 10px; font-weight: 600; letter-spacing: 0.1em;
  text-transform: uppercase; color: var(--t3); margin-bottom: 10px;
}
.d-section__header-row {
  display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;
}
.d-section__count {
  font-family: var(--mono); font-size: 10px; color: var(--t3);
  background: var(--s2); padding: 1px 6px; border-radius: 8px;
  border: 1px solid var(--bd);
}

/* ── Metrics ── */
.d-metrics { display: grid; grid-template-columns: 1fr 1fr; gap: 7px; }
.d-metric {
  background: var(--s2); border: 1px solid var(--bd);
  border-radius: 8px; padding: 9px 10px 7px;
  display: flex; flex-direction: column; gap: 1px;
}
.d-metric__label { font-size: 9.5px; color: var(--t3); font-weight: 500; text-transform: uppercase; letter-spacing: 0.06em; }
.d-metric__val   { font-family: var(--mono); font-size: 16px; font-weight: 500; color: var(--t1); line-height: 1.2; }
.d-metric__chg   { font-family: var(--mono); font-size: 10px; font-weight: 500; }
.d-metric__chg.up { color: var(--ok); }
.d-metric__chg.dn { color: var(--err); }

/* ── Skills ── */
.d-skills { display: flex; flex-direction: column; gap: 7px; }

.skill-card {
  position: relative; overflow: hidden;
  border-radius: 10px; padding: 11px;
  background: var(--s2); border: 1px solid var(--bd);
  transition: border-color 0.45s ease, background 0.45s ease, box-shadow 0.45s ease;
}
.skill-card[data-state="scanning"] {
  border-color: rgba(255,255,255,0.13);
  background: var(--s3);
}
.skill-card[data-state="loaded"] {
  border-color: color-mix(in srgb, var(--sc) 38%, transparent);
  background: color-mix(in srgb, var(--sc) 6%, var(--s2));
  box-shadow: 0 0 22px -4px color-mix(in srgb, var(--sc) 22%, transparent);
  animation: card-pop 0.55s cubic-bezier(0.22,1,0.36,1);
}
@keyframes card-pop {
  0%   { box-shadow: 0 0 0 0 color-mix(in srgb, var(--sc) 55%, transparent); }
  45%  { box-shadow: 0 0 28px 5px color-mix(in srgb, var(--sc) 32%, transparent); }
  100% { box-shadow: 0 0 22px -4px color-mix(in srgb, var(--sc) 22%, transparent); }
}

/* Scan line */
.scan-line {
  position: absolute; inset: 0; pointer-events: none; z-index: 10;
  background: linear-gradient(
    to bottom,
    transparent 0%,
    rgba(255,255,255,0.03) 40%,
    rgba(255,255,255,0.11) 50%,
    rgba(255,255,255,0.03) 60%,
    transparent 100%
  );
  animation: scan 1.5s cubic-bezier(0.4,0,0.2,1) forwards;
}
@keyframes scan {
  0%   { transform: translateY(-110%); opacity: 1; }
  80%  { opacity: 1; }
  100% { transform: translateY(210%);  opacity: 0; }
}

.sc-header { display: flex; align-items: center; gap: 8px; margin-bottom: 5px; }
.sc-icon {
  font-size: 17px; line-height: 1; flex-shrink: 0;
  color: var(--sc);
  transition: transform 0.3s ease;
}
.skill-card[data-state="loaded"] .sc-icon { transform: scale(1.12); }
.sc-icon[data-scanning="true"] { animation: icon-spin 1.5s ease-in-out; }
@keyframes icon-spin {
  0%   { transform: rotate(0deg)   scale(1); }
  50%  { transform: rotate(180deg) scale(1.2); }
  100% { transform: rotate(360deg) scale(1); }
}

.sc-title-group { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0; }
.sc-name { font-size: 12.5px; font-weight: 600; color: var(--t1); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.sc-badge {
  font-size: 9px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;
  padding: 1px 5px; border-radius: 4px; width: fit-content;
}
.sc-badge--eager  { background: rgba(52,211,153,.12); color: #34d399; border: 1px solid rgba(52,211,153,.2); }
.sc-badge--auto   { background: rgba(129,140,248,.12); color: #818cf8; border: 1px solid rgba(129,140,248,.2); }
.sc-badge--manual { background: rgba(251,146,60,.12);  color: #fb923c; border: 1px solid rgba(251,146,60,.2); }

.sc-dot {
  width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0;
  background: var(--t3);
  transition: background 0.35s, box-shadow 0.35s;
}
.sc-dot[data-active="true"] {
  background: var(--sc);
  box-shadow: 0 0 7px 1px color-mix(in srgb, var(--sc) 55%, transparent);
  animation: dot-breathe 2s ease-in-out infinite;
}
@keyframes dot-breathe {
  0%,100% { box-shadow: 0 0 7px 1px color-mix(in srgb, var(--sc) 45%, transparent); }
  50%      { box-shadow: 0 0 11px 3px color-mix(in srgb, var(--sc) 65%, transparent); }
}

.sc-desc { font-size: 11px; color: var(--t2); line-height: 1.4; padding-left: 25px; }

.sc-expanded {
  max-height: 0; overflow: hidden;
  transition: max-height 0.55s cubic-bezier(0.16,1,0.3,1);
}
.sc-expanded[data-open="true"] { max-height: 200px; }

.sc-divider { height: 1px; background: color-mix(in srgb, var(--sc) 25%, transparent); margin: 10px 0 8px; }
.sc-active-label {
  font-size: 10px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;
  color: var(--sc); margin-bottom: 7px; padding-left: 25px;
}

.sc-caps  { list-style: none; display: flex; flex-direction: column; gap: 5px; }
.sc-cap {
  display: flex; align-items: center; gap: 7px;
  font-size: 11px; color: var(--t2); padding-left: 25px;
  opacity: 0; transform: translateX(-8px);
  transition: opacity 0.3s ease, transform 0.3s ease;
}
.sc-cap[data-visible="true"] { opacity: 1; transform: translateX(0); }
.sc-cap-dot {
  width: 4px; height: 4px; border-radius: 50%; flex-shrink: 0;
  background: var(--sc);
}

/* ── Branching ── */
.d-branch {
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
}
.d-branch__label { font-size: 12px; font-weight: 600; color: var(--t1); }
.d-branch__desc  { font-size: 10px; color: var(--t3); margin-top: 2px; }
.d-toggle {
  width: 36px; height: 20px; border-radius: 10px; flex-shrink: 0; cursor: pointer;
  background: var(--s3); border: 1px solid var(--bd2); position: relative;
  transition: background 0.2s, border-color 0.2s;
}
.d-toggle::after {
  content: ''; position: absolute; top: 2px; left: 2px;
  width: 14px; height: 14px; border-radius: 50%; background: var(--t3);
  transition: transform 0.2s, background 0.2s;
}
.d-toggle--on { background: rgba(129,140,248,.2); border-color: rgba(129,140,248,.4); }
.d-toggle--on::after { transform: translateX(16px); background: var(--acc); }

/* ── Demo prompts ── */
.d-prompts { display: flex; flex-direction: column; gap: 6px; }
.d-prompt {
  text-align: left; background: var(--s2); border: 1px solid var(--bd);
  border-radius: 8px; padding: 8px 10px;
  font-size: 11px; font-family: var(--font); color: var(--t2);
  cursor: pointer; line-height: 1.4;
  transition: background 0.12s, border-color 0.12s, color 0.12s;
}
.d-prompt:hover { background: var(--s3); border-color: var(--bd2); color: var(--t1); }

/* ── Chat ── */
.d-chat { flex: 1; min-width: 0; display: flex; flex-direction: column; background: var(--bg); }
.d-copilot { height: 100% !important; }
`;
