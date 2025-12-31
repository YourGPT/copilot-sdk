"use client";

import { Sparkles } from "lucide-react";
import { CopilotChat } from "@yourgpt/copilot-sdk-ui";
import { useDashboard } from "../context/dashboard-context";
import { currentTicket } from "../data/mock-data";
import type {
  ToolRendererProps,
  CustomerRisk,
  Sentiment,
  CustomerContext,
} from "../types";
import {
  DraftResponseCard,
  TicketSummaryCard,
  SimilarTicketsCard,
  ResolutionSuggestionCard,
  CompensationCard,
  CustomerRiskCard,
  SentimentCard,
  CustomerContextCard,
  CustomerProfileCard,
  KnowledgeBaseCard,
  CallbackScheduledCard,
  EscalationCard,
  // Skeletons
  DraftResponseSkeleton,
  TicketSummarySkeleton,
  SimilarTicketsSkeleton,
  CompensationSkeleton,
  ResolutionSkeleton,
  CustomerRiskSkeleton,
  SentimentSkeleton,
  CustomerContextSkeleton,
  KnowledgeBaseSkeleton,
  CallbackSkeleton,
  EscalationSkeleton,
  CustomerProfileSkeleton,
} from "../tool-cards";

// Helper to extract data from tool result
function getResultData<T>(result: unknown): T | undefined {
  if (!result || typeof result !== "object") return undefined;
  const r = result as { data?: T };
  return r.data;
}

// Helper to check if execution is loading
function isLoading(status: string): boolean {
  return status === "pending" || status === "executing";
}

export function CopilotPanel() {
  const dashboard = useDashboard();

  // Create toolRenderers that wrap our render functions with dashboard context
  const toolRenderers: Record<
    string,
    React.ComponentType<ToolRendererProps>
  > = {
    draft_response: ({ execution }: ToolRendererProps) => {
      if (isLoading(execution.status)) return <DraftResponseSkeleton />;
      const data = getResultData<{
        subject: string;
        body: string;
        tone: string;
      }>(execution.result);
      if (execution.status !== "completed" || !data) return null;
      return (
        <DraftResponseCard
          subject={data.subject}
          body={data.body}
          tone={data.tone}
          onUseReply={() => {
            dashboard.setComposeText(data.body);
          }}
        />
      );
    },

    generate_summary: ({ execution }: ToolRendererProps) => {
      if (isLoading(execution.status)) return <TicketSummarySkeleton />;
      const data = getResultData<{
        summary: string;
        keyPoints: string[];
        nextSteps: string[];
      }>(execution.result);
      if (execution.status !== "completed" || !data) return null;
      return (
        <TicketSummaryCard
          summary={data.summary}
          keyPoints={data.keyPoints}
          nextSteps={data.nextSteps}
        />
      );
    },

    find_similar_tickets: ({ execution }: ToolRendererProps) => {
      if (isLoading(execution.status)) return <SimilarTicketsSkeleton />;
      const data = getResultData<{
        tickets: Array<{
          id: string;
          title: string;
          status: string;
          resolution: string;
          similarity: number;
        }>;
      }>(execution.result);
      if (execution.status !== "completed" || !data) return null;
      return (
        <SimilarTicketsCard
          tickets={data.tickets}
          onLinkTicket={(ticket) => {
            dashboard.addLinkedTicket(ticket);
          }}
        />
      );
    },

    suggest_resolution: ({ execution }: ToolRendererProps) => {
      if (isLoading(execution.status)) return <ResolutionSkeleton />;
      const data = getResultData<{
        suggestion: string;
        confidence: number;
        reasoning: string;
        steps: string[];
      }>(execution.result);
      if (execution.status !== "completed" || !data) return null;
      return (
        <ResolutionSuggestionCard
          suggestion={data.suggestion}
          confidence={data.confidence}
          reasoning={data.reasoning}
          steps={data.steps}
          onApply={() => {
            dashboard.setAppliedResolution(data.suggestion);
          }}
        />
      );
    },

    calculate_compensation: ({ execution }: ToolRendererProps) => {
      if (isLoading(execution.status)) return <CompensationSkeleton />;
      const data = getResultData<{
        options: Array<{ type: string; value: string; description: string }>;
        reasoning: string;
        customerValue: string;
      }>(execution.result);
      if (execution.status !== "completed" || !data) return null;
      return (
        <CompensationCard
          options={data.options}
          reasoning={data.reasoning}
          customerValue={data.customerValue}
          onSendOffer={(offer) => {
            dashboard.setSentOffer(offer);
          }}
        />
      );
    },

    analyze_customer_risk: ({ execution }: ToolRendererProps) => {
      if (isLoading(execution.status)) return <CustomerRiskSkeleton />;
      const data = getResultData<{ risk: CustomerRisk }>(execution.result);
      if (execution.status !== "completed" || !data) return null;
      return <CustomerRiskCard risk={data.risk} />;
    },

    detect_sentiment: ({ execution }: ToolRendererProps) => {
      if (isLoading(execution.status)) return <SentimentSkeleton />;
      const data = getResultData<{ sentiment: Sentiment }>(execution.result);
      if (execution.status !== "completed" || !data) return null;
      return <SentimentCard sentiment={data.sentiment} />;
    },

    get_customer_context: ({ execution }: ToolRendererProps) => {
      if (isLoading(execution.status)) return <CustomerContextSkeleton />;
      const data = getResultData<{ context: CustomerContext }>(
        execution.result,
      );
      if (execution.status !== "completed" || !data) return null;
      return <CustomerContextCard context={data.context} />;
    },

    get_customer_profile: ({ execution }: ToolRendererProps) => {
      if (isLoading(execution.status)) return <CustomerProfileSkeleton />;
      return <CustomerProfileCard customer={currentTicket.customer} />;
    },

    search_knowledge_base: ({ execution }: ToolRendererProps) => {
      if (isLoading(execution.status)) return <KnowledgeBaseSkeleton />;
      return (
        <KnowledgeBaseCard
          articles={[
            {
              title: "Retention Discount Policy",
              snippet:
                "For customers 3+ years, up to 30% annual discount available...",
              relevance: 96,
            },
            {
              title: "Plan Downgrade Process",
              snippet: "Feature comparison and data migration steps...",
              relevance: 88,
            },
            {
              title: "Custom Plan Options",
              snippet: "Enterprise and custom plans for specific needs...",
              relevance: 82,
            },
          ]}
        />
      );
    },

    schedule_callback: ({ execution }: ToolRendererProps) => {
      if (isLoading(execution.status)) return <CallbackSkeleton />;
      if (execution.status !== "completed") return null;
      return (
        <CallbackScheduledCard
          date={execution.args.date as string}
          time={execution.args.time as string}
          phone={currentTicket.customer.phone}
        />
      );
    },

    escalate_ticket: ({ execution }: ToolRendererProps) => {
      if (isLoading(execution.status)) return <EscalationSkeleton />;
      if (execution.status !== "completed") return null;
      return (
        <EscalationCard
          supervisor={
            (execution.args.supervisor as string) || "Senior Support Lead"
          }
          reason={execution.args.reason as string}
          priority={execution.args.priority as string}
        />
      );
    },
  };

  return (
    <div className="w-[440px] border-l border-border flex flex-col bg-muted shrink-0">
      {/* Header */}
      <div className="p-4 border-b border-border bg-card">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">AI Copilot</h3>
            <p className="text-xs text-muted-foreground">
              Powered by Copilot SDK
            </p>
          </div>
        </div>
      </div>

      {/* Copilot Chat with Tool Renderers */}
      <div className="flex-1 overflow-hidden">
        <CopilotChat
          placeholder="Ask AI to draft responses, analyze risk, find similar tickets..."
          className="h-full"
          toolRenderers={toolRenderers}
        />
      </div>
    </div>
  );
}
