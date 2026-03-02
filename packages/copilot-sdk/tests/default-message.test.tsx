import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

import { DefaultMessage } from "../src/ui/components/composed/chat/default-message";
import type { ChatMessage } from "../src/ui/components/composed/chat/types";
import type { ToolDefinition } from "../src/core/types/tools";

// Mock ToolSteps to isolate UI filtering behavior
vi.mock("../src/ui/components/ui/tool-steps", () => ({
  ToolSteps: ({ steps }: { steps: Array<{ name: string }> }) => (
    <div data-testid="tool-steps">
      {steps.map((step) => step.name).join(",")}
    </div>
  ),
}));

// Minimal ToolDefinition mock (future-proofed)
const makeTool = (name: string, hidden?: boolean) =>
  ({
    name,
    description: `${name} tool`,
    location: "client",
    inputSchema: {
      type: "object",
      properties: {},
    },
    hidden,
  }) as ToolDefinition;

// Minimal assistant message with one completed tool execution
const makeAssistantMessage = (toolName: string): ChatMessage =>
  ({
    id: "msg-1",
    role: "assistant",
    content: "Assistant response",
    toolExecutions: [
      {
        id: "exec-1",
        name: toolName,
        args: {},
        status: "completed",
        timestamp: Date.now(),
        approvalStatus: "none",
        result: {
          success: true,
        },
      } as any, // keep test resilient to internal type changes
    ],
  }) as ChatMessage;

describe("DefaultMessage - hidden tool visibility", () => {
  it("renders tool execution when hidden is false", () => {
    render(
      <DefaultMessage
        message={makeAssistantMessage("visible_tool")}
        userAvatar={{}}
        assistantAvatar={{}}
        registeredTools={[makeTool("visible_tool", false)]}
      />,
    );

    expect(screen.getByText("Assistant response")).toBeInTheDocument();
    expect(screen.getByTestId("tool-steps")).toHaveTextContent("visible_tool");
  });

  it("renders tool execution when hidden is undefined (default visible behavior)", () => {
    render(
      <DefaultMessage
        message={makeAssistantMessage("default_visible_tool")}
        userAvatar={{}}
        assistantAvatar={{}}
        registeredTools={[makeTool("default_visible_tool")]}
      />,
    );

    expect(screen.getByTestId("tool-steps")).toHaveTextContent(
      "default_visible_tool",
    );
  });

  it("does not render tool execution when hidden=true", () => {
    render(
      <DefaultMessage
        message={makeAssistantMessage("hidden_tool")}
        userAvatar={{}}
        assistantAvatar={{}}
        registeredTools={[makeTool("hidden_tool", true)]}
      />,
    );

    expect(screen.getByText("Assistant response")).toBeInTheDocument();
    expect(screen.queryByTestId("tool-steps")).not.toBeInTheDocument();
    expect(screen.queryByText("hidden_tool")).not.toBeInTheDocument();
  });

  it("renders tool execution if registeredTools is undefined (no filtering applied)", () => {
    render(
      <DefaultMessage
        message={makeAssistantMessage("no_registry_tool")}
        userAvatar={{}}
        assistantAvatar={{}}
      />,
    );

    expect(screen.getByTestId("tool-steps")).toHaveTextContent(
      "no_registry_tool",
    );
  });
});
