"use client";

import { useMemo } from "react";
import { useCopilotContext } from "../context/CopilotContext";

/**
 * SDK State for DevLogger
 * This type is compatible with DevLoggerState in @yourgpt/copilot-sdk-ui
 */
export interface DevLoggerState {
  chat: {
    isLoading: boolean;
    messageCount: number;
    threadId: string;
    error: string | null;
  };
  tools: {
    isEnabled: boolean;
    isCapturing: boolean;
    pendingConsent: boolean;
  };
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
  registered: {
    tools: Array<{ name: string; location: string }>;
    actions: Array<{ name: string }>;
    contextCount: number;
  };
  permissions: {
    stored: Array<{ toolName: string; level: string }>;
    loaded: boolean;
  };
  config: {
    provider: string;
    model: string;
    runtimeUrl: string;
  };
}

/**
 * Hook to build DevLogger state from SDK context
 *
 * Used internally by CopilotProvider when showLogger is true
 */
export function useDevLogger(): DevLoggerState {
  const ctx = useCopilotContext();

  return useMemo<DevLoggerState>(() => {
    // Build tool executions from agent loop state
    const toolExecutions = (ctx.agentLoop?.toolExecutions || []).map(
      (exec) => ({
        id: exec.id,
        name: exec.name,
        status: exec.status,
        approvalStatus: exec.approvalStatus || "not_required",
      }),
    );

    // Count pending approvals
    const pendingApprovalsCount = ctx.pendingApprovals?.length || 0;

    // Get registered tools
    const registeredTools = (ctx.registeredTools || []).map((tool) => ({
      name: tool.name,
      location: tool.location || "client",
    }));

    // Get registered actions
    const registeredActions = (ctx.registeredActions || []).map((action) => ({
      name: action.name,
    }));

    // Get stored permissions
    const storedPermissions = (ctx.storedPermissions || []).map((p) => ({
      toolName: p.toolName,
      level: p.level,
    }));

    return {
      chat: {
        isLoading: ctx.chat?.isLoading || false,
        messageCount: ctx.chat?.messages?.length || 0,
        threadId: ctx.chat?.threadId || "none",
        error: ctx.chat?.error?.message || null,
      },
      tools: {
        isEnabled: !!ctx.toolsConfig,
        isCapturing: ctx.tools?.isCapturing || false,
        pendingConsent: !!ctx.tools?.pendingConsent,
      },
      agentLoop: {
        toolExecutions,
        pendingApprovals: pendingApprovalsCount,
        iteration: ctx.agentLoop?.iteration || 0,
        maxIterations: ctx.agentLoop?.maxIterations || 10,
      },
      registered: {
        tools: registeredTools,
        actions: registeredActions,
        contextCount: ctx.contextTree?.length || 0,
      },
      permissions: {
        stored: storedPermissions,
        loaded: ctx.permissionsLoaded || false,
      },
      config: {
        provider:
          ctx.config?.config?.provider ||
          (ctx.config?.cloud ? "yourgpt-cloud" : "unknown"),
        model: ctx.config?.config?.model || "default",
        runtimeUrl: ctx.config?.runtimeUrl || ctx.config?.cloud?.endpoint || "",
      },
    };
  }, [
    ctx.chat,
    ctx.tools,
    ctx.toolsConfig,
    ctx.agentLoop,
    ctx.pendingApprovals,
    ctx.registeredTools,
    ctx.registeredActions,
    ctx.contextTree,
    ctx.storedPermissions,
    ctx.permissionsLoaded,
    ctx.config,
  ]);
}
