"use client";

import { useState } from "react";
import { CopilotProvider, useTools } from "@yourgpt/copilot-sdk/react";
import { CopilotChat } from "@yourgpt/copilot-sdk/ui";
import "@yourgpt/copilot-sdk/ui/styles.css";
import "@yourgpt/copilot-sdk/ui/themes/claude.css";

import { toolScaleClientTools } from "@/lib/tool-scale/client-tools";
import {
  getProfileToolStats,
  toolScaleCounts,
  toolScaleProfiles,
} from "@/lib/tool-scale/catalog";

function ToolScaleClientRegistration() {
  useTools(toolScaleClientTools);
  return null;
}

const profilePrompts: Record<string, string[]> = {
  support: [
    "What refund policy and SLA guidance should I give a customer asking about delayed support?",
    "Search the right docs and pricing tools for an enterprise plan migration question.",
  ],
  workspace: [
    "Help me summarize the current workspace layout and find blocked tasks for tomorrow.",
    "What document and scheduling tools should you use to inspect upcoming deadlines?",
  ],
  commerce: [
    "Check checkout issues, promo codes, and shipping details for an abandoned cart flow.",
    "Which billing and commerce tools would you use for a failed payment complaint?",
  ],
  admin: [
    "Inspect incident status, audit signals, and dashboard metrics for an operations review.",
    "What tools are relevant for a compliance and analytics triage session?",
  ],
};

const requestSnippet = `{
  "toolProfile": "support",
  "messages": [
    {
      "role": "user",
      "content": "Help me answer a pricing and SLA question"
    }
  ]
}`;

const selectionSnippet = `toolSearch: {
  maxResults: 6,
  exposeWhenExceeds: 12,
  maxEagerTools: 6,
  defaultProfile: "support",
  includeUnprofiled: false,
  profiles: {
    support: { include: ["profile:support", "category:knowledge"] },
    workspace: { include: ["profile:workspace", "category:workspace"] },
  },
}`;

export default function ToolScalePage() {
  const [activeProfile, setActiveProfile] = useState("support");
  const stats = getProfileToolStats(activeProfile);

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col gap-6 p-4 md:p-6">
        <header className="rounded-3xl border bg-card p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                Experimental Tool Scale Lab
              </p>
              <h1 className="text-3xl font-semibold tracking-tight">
                100-tool mixed runtime test
              </h1>
              <p className="text-sm leading-6 text-muted-foreground">
                This example simulates a project with {toolScaleCounts.total}{" "}
                tools: {toolScaleCounts.server} server-side and{" "}
                {toolScaleCounts.client} client-side. Most tools are deferred,
                so the model sees a small profile-specific slice up front and
                discovers the rest through `search_tools`.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <div className="rounded-2xl border bg-background p-3">
                <div className="text-muted-foreground">Total</div>
                <div className="text-2xl font-semibold">
                  {toolScaleCounts.total}
                </div>
              </div>
              <div className="rounded-2xl border bg-background p-3">
                <div className="text-muted-foreground">Server</div>
                <div className="text-2xl font-semibold">
                  {toolScaleCounts.server}
                </div>
              </div>
              <div className="rounded-2xl border bg-background p-3">
                <div className="text-muted-foreground">Client</div>
                <div className="text-2xl font-semibold">
                  {toolScaleCounts.client}
                </div>
              </div>
              <div className="rounded-2xl border bg-background p-3">
                <div className="text-muted-foreground">Deferred</div>
                <div className="text-2xl font-semibold">
                  {toolScaleCounts.deferred}
                </div>
              </div>
            </div>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
          <aside className="space-y-6">
            <section className="rounded-3xl border bg-card p-5">
              <h2 className="text-lg font-semibold">Active profile</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                `toolProfile` is sent in the request body. The runtime applies
                the matching profile first, then dynamic selection, then
                deferred search.
              </p>

              <div className="mt-4 grid gap-2">
                {toolScaleProfiles.map((profile) => (
                  <button
                    key={profile.id}
                    type="button"
                    onClick={() => setActiveProfile(profile.id)}
                    className={`rounded-2xl border px-4 py-3 text-left transition-colors ${
                      activeProfile === profile.id
                        ? "border-foreground bg-foreground text-background"
                        : "bg-background hover:bg-accent"
                    }`}
                  >
                    <div className="font-medium">{profile.label}</div>
                    <div
                      className={`mt-1 text-xs ${
                        activeProfile === profile.id
                          ? "text-background/80"
                          : "text-muted-foreground"
                      }`}
                    >
                      {profile.description}
                    </div>
                  </button>
                ))}
              </div>
            </section>

            <section className="rounded-3xl border bg-card p-5">
              <h2 className="text-lg font-semibold">Profile effect</h2>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-2xl border bg-background p-3">
                  <div className="text-muted-foreground">Eligible tools</div>
                  <div className="text-2xl font-semibold">{stats.total}</div>
                </div>
                <div className="rounded-2xl border bg-background p-3">
                  <div className="text-muted-foreground">Immediate</div>
                  <div className="text-2xl font-semibold">
                    {stats.immediate}
                  </div>
                </div>
                <div className="rounded-2xl border bg-background p-3">
                  <div className="text-muted-foreground">Deferred</div>
                  <div className="text-2xl font-semibold">{stats.deferred}</div>
                </div>
                <div className="rounded-2xl border bg-background p-3">
                  <div className="text-muted-foreground">Dynamic cap</div>
                  <div className="text-2xl font-semibold">6</div>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border bg-background p-4 text-sm text-muted-foreground">
                <p>
                  For{" "}
                  <span className="font-medium text-foreground">
                    {activeProfile}
                  </span>
                  , the model starts from {stats.total} eligible tools, but only
                  a few immediate tools are available up front. Query-aware
                  ranking narrows that to at most 6 tools for the current turn.
                  The remaining deferred matches stay behind `search_tools`.
                </p>
              </div>

              <div className="mt-4 space-y-3 text-sm">
                <div>
                  <div className="font-medium">Categories</div>
                  <div className="mt-1 text-muted-foreground">
                    {stats.categories.join(", ")}
                  </div>
                </div>
                <div>
                  <div className="font-medium">Groups</div>
                  <div className="mt-1 text-muted-foreground">
                    {stats.groups.join(", ")}
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-3xl border bg-card p-5">
              <h2 className="text-lg font-semibold">How profiling works</h2>
              <ol className="mt-4 space-y-3 text-sm text-muted-foreground">
                <li>
                  1. The client sends `toolProfile` with the chat request.
                </li>
                <li>
                  2. The runtime keeps only tools tagged for that profile or
                  matched by configured selectors.
                </li>
                <li>
                  3. Dynamic selection ranks the remaining tools against the
                  last user context and caps the upfront list.
                </li>
                <li>
                  4. Deferred tools are hidden until the model calls
                  `search_tools`, which loads the matched tools on the next loop
                  iteration.
                </li>
              </ol>
            </section>

            <section className="rounded-3xl border bg-card p-5">
              <h2 className="text-lg font-semibold">Request body</h2>
              <pre className="mt-3 overflow-x-auto rounded-2xl bg-muted p-4 text-xs leading-5">
                {requestSnippet.replace("support", activeProfile)}
              </pre>
            </section>

            <section className="rounded-3xl border bg-card p-5">
              <h2 className="text-lg font-semibold">Selection config</h2>
              <pre className="mt-3 overflow-x-auto rounded-2xl bg-muted p-4 text-xs leading-5">
                {selectionSnippet}
              </pre>
            </section>
          </aside>

          <section className="overflow-hidden rounded-3xl border bg-card">
            <div className="border-b px-5 py-4">
              <h2 className="text-lg font-semibold">Run the scenario</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Switch profiles, then ask for something that should require
                docs, billing, workspace, checkout, or operations tools. The
                runtime will receive `toolProfile: "{activeProfile}"`.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {profilePrompts[activeProfile].map((prompt) => (
                  <span
                    key={prompt}
                    className="rounded-full border bg-background px-3 py-1 text-xs text-muted-foreground"
                  >
                    {prompt}
                  </span>
                ))}
              </div>
            </div>

            <div className="h-[calc(100vh-220px)] min-h-[640px]">
              <CopilotProvider
                runtimeUrl="/api/chat/tool-scale"
                body={{ toolProfile: activeProfile }}
                debug
              >
                <ToolScaleClientRegistration />
                <CopilotChat
                  className="h-full csdk-theme-claude"
                  placeholder={`Ask with the ${activeProfile} profile...`}
                  suggestions={profilePrompts[activeProfile]}
                />
              </CopilotProvider>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
