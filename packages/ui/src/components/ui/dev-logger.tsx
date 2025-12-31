"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import { cn } from "../../lib/utils";

/**
 * SDK State for DevLogger
 */
export interface DevLoggerState {
  // Chat state
  chat: {
    isLoading: boolean;
    messageCount: number;
    threadId: string;
    error: string | null;
  };
  // Tools state
  tools: {
    isEnabled: boolean;
    isCapturing: boolean;
    pendingConsent: boolean;
  };
  // Agent loop state
  agentLoop: {
    toolExecutions: Array<{
      id: string;
      name: string;
      status: string;
      approvalStatus: string;
    }>;
    pendingApprovals: number;
    iteration: number;
    maxIterations: number;
  };
  // Registered items
  registered: {
    tools: Array<{ name: string; location: string }>;
    actions: Array<{ name: string }>;
    contextCount: number;
  };
  // Permissions
  permissions: {
    stored: Array<{ toolName: string; level: string }>;
    loaded: boolean;
  };
  // Config
  config: {
    provider: string;
    model: string;
    runtimeUrl: string;
  };
}

export interface DevLoggerProps {
  /** SDK state to display */
  state: DevLoggerState;
  /** Position of the floating button */
  position?: "bottom-left" | "bottom-right" | "top-left" | "top-right";
  /** Custom class name */
  className?: string;
}

/**
 * DevLogger - Floating debug panel for SDK development
 *
 * Shows a floating button that opens a modal with all SDK state
 * for debugging purposes.
 */
export function DevLogger({
  state,
  position = "bottom-right",
  className,
}: DevLoggerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "chat" | "tools" | "agent" | "config"
  >("chat");

  // Position classes
  const positionClasses = {
    "bottom-left": "bottom-4 left-4",
    "bottom-right": "bottom-4 right-4",
    "top-left": "top-4 left-4",
    "top-right": "top-4 right-4",
  };

  return (
    <>
      {/* Floating Button */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={cn(
          "fixed z-[9999] flex items-center justify-center",
          "w-12 h-12 rounded-full shadow-lg",
          "bg-orange-500 hover:bg-orange-600 text-white",
          "transition-transform hover:scale-110",
          positionClasses[position],
          className,
        )}
        title="Open SDK DevLogger"
      >
        <svg
          className="w-6 h-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
          />
        </svg>
      </button>

      {/* Modal Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50"
          onClick={() => setIsOpen(false)}
        >
          {/* Modal Content */}
          <div
            className="bg-background border rounded-lg shadow-xl w-[600px] max-h-[80vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/50">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-orange-500" />
                <h2 className="font-semibold text-sm">Copilot SDK DevLogger</h2>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b">
              {(["chat", "tools", "agent", "config"] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    "px-4 py-2 text-sm font-medium capitalize",
                    activeTab === tab
                      ? "border-b-2 border-primary text-primary"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="p-4 overflow-y-auto max-h-[60vh]">
              {activeTab === "chat" && <ChatTab state={state} />}
              {activeTab === "tools" && <ToolsTab state={state} />}
              {activeTab === "agent" && <AgentTab state={state} />}
              {activeTab === "config" && <ConfigTab state={state} />}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/**
 * Chat Tab Content
 */
function ChatTab({ state }: { state: DevLoggerState }) {
  return (
    <div className="space-y-4">
      <Section title="Status">
        <Row label="Loading" value={state.chat.isLoading ? "Yes" : "No"} />
        <Row label="Message Count" value={state.chat.messageCount} />
        <Row label="Thread ID" value={state.chat.threadId} mono />
        <Row
          label="Error"
          value={state.chat.error || "None"}
          valueClass={state.chat.error ? "text-red-500" : "text-green-500"}
        />
      </Section>
    </div>
  );
}

/**
 * Tools Tab Content
 */
function ToolsTab({ state }: { state: DevLoggerState }) {
  return (
    <div className="space-y-4">
      <Section title="Smart Context">
        <Row label="Enabled" value={state.tools.isEnabled ? "Yes" : "No"} />
        <Row label="Capturing" value={state.tools.isCapturing ? "Yes" : "No"} />
        <Row
          label="Pending Consent"
          value={state.tools.pendingConsent ? "Yes" : "No"}
        />
      </Section>

      <Section title="Registered Tools">
        {state.registered.tools.length === 0 ? (
          <p className="text-sm text-muted-foreground">No tools registered</p>
        ) : (
          <div className="space-y-1">
            {state.registered.tools.map((tool) => (
              <div
                key={tool.name}
                className="flex items-center justify-between text-sm"
              >
                <code className="bg-muted px-1.5 py-0.5 rounded text-xs">
                  {tool.name}
                </code>
                <span className="text-muted-foreground text-xs">
                  {tool.location}
                </span>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title="Permissions">
        <Row label="Loaded" value={state.permissions.loaded ? "Yes" : "No"} />
        {state.permissions.stored.length > 0 && (
          <div className="mt-2 space-y-1">
            {state.permissions.stored.map((p) => (
              <div
                key={p.toolName}
                className="flex items-center justify-between text-sm"
              >
                <code className="bg-muted px-1.5 py-0.5 rounded text-xs">
                  {p.toolName}
                </code>
                <Badge level={p.level} />
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

/**
 * Agent Tab Content
 */
function AgentTab({ state }: { state: DevLoggerState }) {
  return (
    <div className="space-y-4">
      <Section title="Loop State">
        <Row
          label="Iteration"
          value={`${state.agentLoop.iteration} / ${state.agentLoop.maxIterations}`}
        />
        <Row
          label="Pending Approvals"
          value={state.agentLoop.pendingApprovals}
        />
      </Section>

      <Section title="Tool Executions">
        {state.agentLoop.toolExecutions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No executions</p>
        ) : (
          <div className="space-y-2">
            {state.agentLoop.toolExecutions.map((exec) => (
              <div
                key={exec.id}
                className="border rounded p-2 text-sm space-y-1"
              >
                <div className="flex items-center justify-between">
                  <code className="font-medium">{exec.name}</code>
                  <StatusBadge status={exec.status} />
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>ID: {exec.id.slice(0, 12)}...</span>
                  <span>Approval: {exec.approvalStatus}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title="Registered Actions">
        {state.registered.actions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No actions registered</p>
        ) : (
          <div className="flex flex-wrap gap-1">
            {state.registered.actions.map((action) => (
              <code
                key={action.name}
                className="bg-muted px-1.5 py-0.5 rounded text-xs"
              >
                {action.name}
              </code>
            ))}
          </div>
        )}
      </Section>

      <Section title="Context Tree">
        <Row label="Context Items" value={state.registered.contextCount} />
      </Section>
    </div>
  );
}

/**
 * Config Tab Content
 */
function ConfigTab({ state }: { state: DevLoggerState }) {
  return (
    <div className="space-y-4">
      <Section title="Provider">
        <Row label="Provider" value={state.config.provider || "Not set"} />
        <Row label="Model" value={state.config.model || "Default"} />
        <Row
          label="Runtime URL"
          value={state.config.runtimeUrl || "Not set"}
          mono
        />
      </Section>
    </div>
  );
}

// Helper Components

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
        {title}
      </h3>
      {children}
    </div>
  );
}

function Row({
  label,
  value,
  mono,
  valueClass,
}: {
  label: string;
  value: string | number;
  mono?: boolean;
  valueClass?: string;
}) {
  return (
    <div className="flex items-center justify-between py-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={cn(
          mono && "font-mono text-xs bg-muted px-1.5 py-0.5 rounded",
          valueClass,
        )}
      >
        {value}
      </span>
    </div>
  );
}

function Badge({ level }: { level: string }) {
  const colors: Record<string, string> = {
    allow_always: "bg-green-100 text-green-800",
    deny_always: "bg-red-100 text-red-800",
    session: "bg-blue-100 text-blue-800",
    ask: "bg-gray-100 text-gray-800",
  };

  return (
    <span
      className={cn(
        "px-1.5 py-0.5 rounded text-xs font-medium",
        colors[level] || colors.ask,
      )}
    >
      {level}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-800",
    executing: "bg-blue-100 text-blue-800",
    completed: "bg-green-100 text-green-800",
    error: "bg-red-100 text-red-800",
  };

  return (
    <span
      className={cn(
        "px-1.5 py-0.5 rounded text-xs font-medium",
        colors[status] || "bg-gray-100 text-gray-800",
      )}
    >
      {status}
    </span>
  );
}
