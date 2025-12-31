"use client";

import { CopilotProvider } from "@yourgpt/copilot-sdk-react";
import { DashboardProvider } from "./components/context/dashboard-context";
import { TicketingTools } from "./components/ticketing-tools";
import {
  DemoSidebar,
  TicketHeader,
  ConversationArea,
  CopilotPanel,
} from "./components/layout";

// You have AI tools to help:
// **Analysis Tools:**
// - get_customer_context - See full customer history and AI recommendations
// - detect_sentiment - Understand how the customer is feeling
// - analyze_customer_risk - Assess churn probability and risk factors

// **Research Tools:**
// - find_similar_tickets - Find past successful retention cases
// - search_knowledge_base - Check pricing policies and options

// **Action Tools:**
// - calculate_compensation - Get personalized discount/offer options
// - suggest_resolution - AI recommendation for best approach
// - draft_response - Generate empathetic response with offer
// - schedule_callback - Set up follow-up call if needed
// - escalate_ticket - Escalate to manager for special approval

const SYSTEM_PROMPT = `You are an AI assistant helping customer success agents.

**Response Style:**
Be concise by default. Tools display UI cards with full details, so don't repeat that data in your response. Keep it brief and actionable - elaborate only when the agent asks for more details.`;

export default function TicketingDemoPage() {
  return (
    <DashboardProvider>
      <CopilotProvider
        runtimeUrl="/api/chat/anthropic"
        systemPrompt={SYSTEM_PROMPT}
        streaming={true}
      >
        <TicketingTools />
        <div className="h-screen flex bg-background overflow-hidden text-foreground">
          <DemoSidebar />
          <main className="flex-1 flex flex-col overflow-hidden min-w-0">
            <TicketHeader />
            <div className="flex-1 flex overflow-hidden">
              <ConversationArea />
              <CopilotPanel />
            </div>
          </main>
        </div>
      </CopilotProvider>
    </DashboardProvider>
  );
}
