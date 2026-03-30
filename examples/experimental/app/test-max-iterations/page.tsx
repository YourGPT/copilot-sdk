"use client";

import { CopilotProvider, useTools } from "@yourgpt/copilot-sdk/react";
import { CopilotChat } from "@yourgpt/copilot-sdk/ui";

/**
 * Test page for max iterations fix
 * Has tools registered with maxIterations=2 to easily trigger the limit
 */
export default function TestMaxIterationsPage() {
  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-2">Test: Max Iterations Fix</h1>
        <p className="text-muted-foreground mb-4">
          Multi-step tools test. maxIterations=2 (step 1 & 2 work, step 3
          blocked). Ask: "Run the 3-step process for testing"
        </p>

        <div className="border rounded-xl overflow-hidden h-[600px]">
          <CopilotProvider
            runtimeUrl="/api/chat/openai"
            debug
            streaming={false}
            maxIterations={2}
          >
            <TestTools />
            <CopilotChat
              title="Chat (Max Iterations Test)"
              placeholder="Ask: Run the 3-step process for testing"
              showPoweredBy={false}
              className="h-full"
            />
          </CopilotProvider>
        </div>
      </div>
    </div>
  );
}

/**
 * Register multi-step tools that require iterative execution
 * This helps test max iterations scenarios
 */
function TestTools() {
  useTools({
    // Step 1: Initialize a process
    step1_initialize: {
      location: "client",
      description:
        "Step 1: Initialize a multi-step process. MUST be called first before step2.",
      inputSchema: {
        type: "object",
        properties: {
          task: { type: "string", description: "What task to initialize" },
        },
        required: ["task"],
      },
      handler: async (params) => {
        const args = params as { task: string };
        await new Promise((r) => setTimeout(r, 500));
        return {
          success: true,
          step: 1,
          message: `Initialized: ${args.task}`,
          nextStep: "Now call step2_process to continue",
        };
      },
    },

    // Step 2: Process
    step2_process: {
      location: "client",
      description:
        "Step 2: Process the initialized task. Call this after step1_initialize.",
      inputSchema: {
        type: "object",
        properties: {
          data: { type: "string", description: "Data to process" },
        },
        required: ["data"],
      },
      handler: async (params) => {
        const args = params as { data: string };
        await new Promise((r) => setTimeout(r, 500));
        return {
          success: true,
          step: 2,
          message: `Processed: ${args.data}`,
          nextStep: "Now call step3_finalize to complete",
        };
      },
    },

    // Step 3: Finalize
    step3_finalize: {
      location: "client",
      description:
        "Step 3: Finalize and complete the process. Call this after step2_process.",
      inputSchema: {
        type: "object",
        properties: {
          summary: { type: "string", description: "Summary of what was done" },
        },
        required: ["summary"],
      },
      handler: async (params) => {
        const args = params as { summary: string };
        await new Promise((r) => setTimeout(r, 500));
        return {
          success: true,
          step: 3,
          message: `Completed: ${args.summary}`,
          complete: true,
        };
      },
    },
  });
  return null;
}
