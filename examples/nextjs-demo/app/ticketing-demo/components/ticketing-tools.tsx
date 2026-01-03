"use client";

import { useTools, useAIContext } from "@yourgpt/copilot-sdk/react";
import { tool, success } from "@yourgpt/copilot-sdk/core";
import { useDashboard } from "./context/dashboard-context";
import { currentTicket } from "./data/mock-data";
import type { CustomerRisk, Sentiment, CustomerContext } from "./types";
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
} from "./tool-cards";

// Separate component for AI context to ensure proper hook ordering
function TicketContext() {
  useAIContext({
    key: "current-ticket",
    description: "Current support ticket",
    data: {
      ticketId: currentTicket.id,
      issue: currentTicket.title,
      customer: {
        name: currentTicket.customer.name,
        company: currentTicket.customer.company,
        plan: currentTicket.customer.tier,
        ltv: currentTicket.customer.lifetimeValue,
        since: currentTicket.customer.memberSince,
      },
      subscription: {
        plan: currentTicket.subscription.plan,
        price: `$${currentTicket.subscription.price}/mo`,
        nextBilling: currentTicket.subscription.nextBilling,
      },
    },
  });
  return null;
}

export function TicketingTools() {
  const dashboard = useDashboard();

  // Note: useTools types expect ToolDefinition but tool() returns Omit<ToolDefinition, "name">
  // The name is derived from the object key at runtime. Using 'as any' to work around type mismatch.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  useTools({
    // ========================================
    // CATEGORY 1: GENERATIVE UI TOOLS
    // ========================================

    draft_response: tool({
      title: (args) =>
        `Draft ${(args.tone as string) || "professional"} response`,
      executingTitle: "AI is writing response...",
      completedTitle: "Response drafted",
      description:
        "Generate a personalized response email for the customer. AI analyzes the conversation context and drafts an appropriate reply with the right tone.",
      location: "client",
      aiResponseMode: "none",
      aiContext: (result) => {
        const data = result.data as { tone: string } | undefined;
        return `[UI Card Displayed: Draft response with ${data?.tone || "empathetic"} tone. User can review/edit/send. Do NOT repeat the content - just briefly acknowledge.]`;
      },
      inputSchema: {
        type: "object",
        properties: {
          tone: {
            type: "string",
            enum: ["professional", "friendly", "empathetic", "apologetic"],
            description: "Tone of the response",
          },
          includeOffer: {
            type: "boolean",
            description: "Whether to include a compensation offer",
          },
        },
      },
      handler: async (params) => {
        await new Promise((r) => setTimeout(r, 1000));
        const tone = (params.tone as string) || "empathetic";
        const includeOffer = params.includeOffer as boolean;
        const subject = `Re: Your ${currentTicket.customer.plan} - Let's find a solution`;
        const body = `Hi ${currentTicket.customer.name},

Thank you for being upfront about your situation - I really appreciate that, and I want to help find a solution that works for both you and your team.

I took a look at your account and I can see you've been with us for almost 5 years - that's incredible, and we truly value your partnership. I also noticed that while you're on the Pro plan, you're mainly using the Analytics and API features.

${
  includeOffer
    ? `Here's what I can do for you:

I'd like to offer you a **25% discount on your Pro plan** for the next 12 months. That brings your monthly cost from $49 to $36.75 - which is actually below our Basic plan price, but you'd keep full API access and Analytics that your team relies on.

This way, you can show your manager a meaningful cost reduction while keeping the features you need. Would this work for your budget goals?`
    : `I have a few options I'd like to discuss with you that could help meet your budget goals while keeping the features your team depends on.

Would you have a few minutes to chat about what might work best?`
}

Best regards,
Marcus`;

        return { success: true, data: { subject, body, tone } };
      },
      render: (props) => {
        const result = props.result?.data as
          | { subject: string; body: string; tone: string }
          | undefined;
        if (!result) return null;
        return (
          <DraftResponseCard
            subject={result.subject}
            body={result.body}
            tone={result.tone}
            onUseReply={() => {
              dashboard.setComposeText(result.body);
            }}
            onSendEmail={(subject, body) => {
              dashboard.sendAgentMessage(body, "Email", subject);
            }}
          />
        );
      },
    }),

    generate_summary: tool({
      title: "Generate ticket summary",
      executingTitle: "Analyzing conversation...",
      completedTitle: "Summary generated",
      description:
        "Generate an AI summary of the current ticket for handoff or escalation. Includes key points and recommended next steps.",
      location: "client",
      aiResponseMode: "none",
      aiContext: (result) => {
        const data = result.data as { keyPoints: string[] } | undefined;
        return `[UI Card Displayed: Ticket summary with ${data?.keyPoints?.length || 0} key points and next steps. User sees full details. Do NOT repeat - just acknowledge briefly.]`;
      },
      inputSchema: { type: "object", properties: {} },
      handler: async () => {
        await new Promise((r) => setTimeout(r, 800));

        const summary = `${currentTicket.customer.name} from ${currentTicket.customer.company} (Pro plan, ${currentTicket.customer.lifetimeValue} LTV, 5-year customer) is considering downgrading due to budget pressure from management. Customer mentioned competitor pricing (Notion) and needs to cut software costs by 20%. Currently using mainly Analytics and API features. Not frustrated, but needs to justify costs to manager.`;

        const keyPoints = [
          "High-value 5-year customer with $2,842 LTV",
          "Budget pressure from management - 20% cut required",
          "Only actively using Analytics + API (not full Pro features)",
          "Mentioned competitor (Notion) as alternative",
          "Renewal date: Jan 15 - decision needed this week",
        ];

        const nextSteps = [
          "Offer custom discount to meet budget target",
          "Consider API-only plan at reduced rate",
          "Escalate to retention team if needed",
          "Schedule follow-up before renewal date",
        ];

        return { success: true, data: { summary, keyPoints, nextSteps } };
      },
      render: (props) => {
        const result = props.result?.data as
          | { summary: string; keyPoints: string[]; nextSteps: string[] }
          | undefined;
        if (!result) return null;
        return (
          <TicketSummaryCard
            summary={result.summary}
            keyPoints={result.keyPoints}
            nextSteps={result.nextSteps}
          />
        );
      },
    }),

    find_similar_tickets: tool({
      title: "Find similar tickets",
      executingTitle: "Searching ticket database...",
      completedTitle: "Found similar tickets",
      description:
        "Search for similar resolved tickets to find proven solutions. AI analyzes ticket content and finds relevant past cases.",
      location: "client",
      aiResponseMode: "none",
      aiContext: (result) => {
        const data = result.data as
          | {
              tickets: Array<{
                id: string;
                resolution: string;
                similarity: number;
              }>;
            }
          | undefined;
        if (!data?.tickets?.length) return "[No similar tickets found]";
        const best = data.tickets[0];
        return `[UI Card Displayed: ${data.tickets.length} similar tickets. Top: ${best.id} (${best.similarity}%) resolved by "${best.resolution}". User sees full list. Briefly mention key insight only.]`;
      },
      inputSchema: { type: "object", properties: {} },
      handler: async () => {
        await new Promise((r) => setTimeout(r, 900));

        const tickets = [
          {
            id: "TK-3421",
            title: "Pro customer wants to downgrade - budget cuts",
            status: "Resolved",
            resolution: "Offered 30% annual discount - customer stayed on Pro",
            similarity: 96,
          },
          {
            id: "TK-3156",
            title: "Considering cancellation - competitor pricing",
            status: "Resolved",
            resolution:
              "Created custom plan with only needed features at 25% off",
            similarity: 91,
          },
          {
            id: "TK-2987",
            title: "Team downsizing - need smaller plan",
            status: "Resolved",
            resolution:
              "Switched to per-seat billing, added free trial of Team plan",
            similarity: 84,
          },
        ];

        return { success: true, data: { tickets } };
      },
      render: (props) => {
        const result = props.result?.data as
          | {
              tickets: Array<{
                id: string;
                title: string;
                status: string;
                resolution: string;
                similarity: number;
              }>;
            }
          | undefined;
        if (!result) return null;
        return (
          <SimilarTicketsCard
            tickets={result.tickets}
            onLinkTicket={(ticket) => {
              dashboard.addLinkedTicket(ticket);
            }}
          />
        );
      },
    }),

    suggest_resolution: tool({
      title: "Suggest resolution",
      executingTitle: "AI analyzing best approach...",
      completedTitle: "Resolution recommended",
      description:
        "AI analyzes the ticket and suggests the best resolution path based on similar cases, customer value, and company policies.",
      location: "client",
      aiResponseMode: "none",
      aiContext: (result) => {
        const data = result.data as
          | { suggestion: string; confidence: number; steps: string[] }
          | undefined;
        return `[UI Card Displayed: Resolution "${data?.suggestion}" (${data?.confidence}% confidence) with ${data?.steps?.length || 0} action steps. User can apply directly. Just acknowledge - don't repeat steps.]`;
      },
      inputSchema: { type: "object", properties: {} },
      handler: async () => {
        await new Promise((r) => setTimeout(r, 1100));

        const suggestion = "Offer 25% annual Pro discount";
        const confidence = 92;
        const reasoning =
          "Based on 96% similar case match and customer's specific needs. Annual discount provides 25% savings ($147/year) while maintaining API access. Meets their 20% budget reduction target with room to spare. 89% retention rate for this approach.";
        const steps = [
          "Acknowledge their budget constraints empathetically",
          "Present the 25% annual Pro discount ($36.75/mo vs $49)",
          "Highlight that this beats their 20% target",
          "Emphasize keeping API access their team relies on",
          "Offer to schedule a call if they need manager approval help",
        ];

        return {
          success: true,
          data: { suggestion, confidence, reasoning, steps },
        };
      },
      render: (props) => {
        const result = props.result?.data as
          | {
              suggestion: string;
              confidence: number;
              reasoning: string;
              steps: string[];
            }
          | undefined;
        if (!result) return null;
        return (
          <ResolutionSuggestionCard
            suggestion={result.suggestion}
            confidence={result.confidence}
            reasoning={result.reasoning}
            steps={result.steps}
            onApply={() => {
              dashboard.setAppliedResolution(result.suggestion);
            }}
          />
        );
      },
    }),

    calculate_compensation: tool({
      title: "Calculate compensation",
      executingTitle: "Calculating fair offer...",
      completedTitle: "Compensation options ready",
      description:
        "Calculate appropriate compensation based on customer lifetime value, issue severity, and company guidelines. Provides tiered options.",
      location: "client",
      aiResponseMode: "none",
      aiContext: (result) => {
        const data = result.data as
          | {
              options: Array<{ type: string; value: string }>;
              customerValue: string;
            }
          | undefined;
        return `[UI Card Displayed: ${data?.options?.length || 0} compensation options for ${data?.customerValue} LTV customer. User can select and send. Brief acknowledgment only.]`;
      },
      inputSchema: {
        type: "object",
        properties: {
          issueSeverity: {
            type: "string",
            enum: ["low", "medium", "high"],
            description: "Severity of the issue",
          },
        },
      },
      handler: async () => {
        await new Promise((r) => setTimeout(r, 700));

        const options = [
          {
            type: "Annual Discount",
            value: "25% off",
            description:
              "Pro plan at $36.75/mo (billed annually) - saves $147/year",
          },
          {
            type: "API-Only Plan",
            value: "$29/mo",
            description: "Custom plan with just Analytics + API access",
          },
          {
            type: "3 Months Free",
            value: "$147 credit",
            description: "Stay on Pro, next 3 months free while they evaluate",
          },
        ];

        const reasoning = `Customer LTV of ${currentTicket.customer.lifetimeValue} over 5 years makes retention high priority. Budget pressure is the driver, not dissatisfaction. Recommend annual discount - it meets their 20% target while preserving full functionality and our revenue.`;

        return {
          success: true,
          data: {
            options,
            reasoning,
            customerValue: currentTicket.customer.lifetimeValue,
          },
        };
      },
      render: (props) => {
        const result = props.result?.data as
          | {
              options: Array<{
                type: string;
                value: string;
                description: string;
              }>;
              reasoning: string;
              customerValue: string;
            }
          | undefined;
        if (!result) return null;
        return (
          <CompensationCard
            options={result.options}
            reasoning={result.reasoning}
            customerValue={result.customerValue}
            onSendOffer={(offer) => {
              dashboard.setSentOffer(offer);
            }}
          />
        );
      },
    }),

    // ========================================
    // CATEGORY 3: DASHBOARD STATE TOOLS
    // ========================================

    analyze_customer_risk: tool({
      title: "Analyze churn risk",
      executingTitle: "Analyzing customer patterns...",
      completedTitle: "Risk assessment complete",
      description:
        "Analyze customer churn risk based on behavior patterns, purchase history, and sentiment. Updates the dashboard risk indicator.",
      location: "client",
      aiResponseMode: "none",
      aiContext: (result) => {
        const data = result.data as { risk: CustomerRisk } | undefined;
        const r = data?.risk;
        return `[UI Card Displayed: ${r?.level?.toUpperCase()} churn risk (${r?.score}/100). ${r?.reasons?.length || 0} risk factors shown. Dashboard updated. Acknowledge briefly.]`;
      },
      inputSchema: { type: "object", properties: {} },
      handler: async () => {
        await new Promise((r) => setTimeout(r, 800));

        const risk: CustomerRisk = {
          level: "high",
          score: 72,
          reasons: [
            "Actively considering downgrade/cancellation",
            "Mentioned competitor by name (Notion)",
            "External budget pressure from management",
            "Renewal in 2 weeks - decision imminent",
          ],
        };

        dashboard.setCustomerRisk(risk);

        return { success: true, data: { risk } };
      },
      render: (props) => {
        const result = props.result?.data as { risk: CustomerRisk } | undefined;
        if (!result) return null;
        return <CustomerRiskCard risk={result.risk} />;
      },
    }),

    detect_sentiment: tool({
      title: "Detect sentiment",
      executingTitle: "Reading customer mood...",
      completedTitle: "Sentiment detected",
      description:
        "Analyze customer sentiment from the conversation. Detects emotions and updates the dashboard sentiment indicator.",
      location: "client",
      aiResponseMode: "none",
      aiContext: (result) => {
        const data = result.data as { sentiment: Sentiment } | undefined;
        const s = data?.sentiment;
        return `[UI Card Displayed: ${s?.emoji} ${s?.label} sentiment (${s?.score}/100). Dashboard updated. Just acknowledge briefly.]`;
      },
      inputSchema: { type: "object", properties: {} },
      handler: async () => {
        await new Promise((r) => setTimeout(r, 600));

        const sentiment: Sentiment = {
          emoji: "😐",
          label: "Neutral-Concerned",
          score: 55,
          reasons: [
            "Professional tone, no hostility",
            "Expressed frustration about pricing structure",
            "Mentioned being 'stuck' between options",
            "Showed loyalty - 'really like the product'",
            "Open to solutions - 'all ears' for flexibility",
          ],
        };

        dashboard.setSentiment(sentiment);

        return { success: true, data: { sentiment } };
      },
      render: (props) => {
        const result = props.result?.data as
          | { sentiment: Sentiment }
          | undefined;
        if (!result) return null;
        return <SentimentCard sentiment={result.sentiment} />;
      },
    }),

    get_customer_context: tool({
      title: "Get customer intelligence",
      executingTitle: "Gathering customer data...",
      completedTitle: "Customer context loaded",
      description:
        "Get comprehensive customer intelligence including LTV, satisfaction history, and AI-powered recommendations for handling this customer.",
      location: "client",
      aiResponseMode: "none",
      aiContext: (result) => {
        const data = result.data as { context: CustomerContext } | undefined;
        const ctx = data?.context;
        return `[UI Card Displayed: Customer intel - ${ctx?.ltv} LTV, ${ctx?.tier} tier, ${ctx?.satisfactionScore}% satisfaction. ${ctx?.riskFactors?.length || 0} risks, ${ctx?.recommendations?.length || 0} recommendations shown. User sees full details. Acknowledge briefly.]`;
      },
      inputSchema: { type: "object", properties: {} },
      handler: async () => {
        await new Promise((r) => setTimeout(r, 900));

        const context: CustomerContext = {
          ltv: currentTicket.customer.lifetimeValue,
          tier: currentTicket.customer.tier,
          orderCount: currentTicket.customer.subscriptionMonths,
          ticketCount: 3,
          avgResponseTime: "< 1 hour",
          satisfactionScore: 91,
          riskFactors: [
            "Considering downgrade due to budget",
            "Only using 2 of 8 Pro features",
            "Mentioned competitor pricing",
          ],
          recommendations: [
            "Offer annual discount to meet 20% budget target",
            "Highlight ROI of features they use (Analytics, API)",
            "Consider custom plan with only needed features",
            "Schedule call to help with manager justification",
          ],
        };

        dashboard.setCustomerContext(context);

        return { success: true, data: { context } };
      },
      render: (props) => {
        const result = props.result?.data as
          | { context: CustomerContext }
          | undefined;
        if (!result) return null;
        return <CustomerContextCard context={result.context} />;
      },
    }),

    // ========================================
    // BASIC TOOLS
    // ========================================

    get_customer_profile: tool({
      title: "Customer profile",
      executingTitle: "Loading profile...",
      completedTitle: `${currentTicket.customer.name}'s profile`,
      description: "Retrieve basic customer profile information.",
      location: "client",
      aiResponseMode: "none",
      aiContext: () =>
        `[UI Card Displayed: ${currentTicket.customer.name}'s profile - ${currentTicket.customer.tier} plan, ${currentTicket.customer.lifetimeValue} LTV. User sees contact info. Acknowledge briefly.]`,
      inputSchema: {
        type: "object",
        properties: {
          customerId: { type: "string", description: "The customer ID" },
        },
      },
      handler: async () => {
        return success({ customer: currentTicket.customer });
      },
      render: () => <CustomerProfileCard customer={currentTicket.customer} />,
    }),

    search_knowledge_base: tool({
      title: (args) => `Search: "${args.query || "..."}"`,
      executingTitle: "Searching knowledge base...",
      completedTitle: "Articles found",
      description: "Search the knowledge base for relevant articles.",
      location: "client",
      aiResponseMode: "none",
      aiContext: (result) => {
        const data = result.data as
          | { articles: Array<{ title: string }> }
          | undefined;
        return `[UI Card Displayed: ${data?.articles?.length || 0} knowledge base articles. User can browse. Acknowledge briefly.]`;
      },
      inputSchema: {
        type: "object",
        properties: { query: { type: "string", description: "Search query" } },
        required: ["query"],
      },
      handler: async () => {
        const articles = [
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
        ];
        return success({ articles });
      },
      render: () => (
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
      ),
    }),

    schedule_callback: tool({
      title: (args) => `Schedule callback ${args.date || ""}`,
      executingTitle: "Scheduling callback...",
      completedTitle: (args) => `Callback: ${args.date} at ${args.time}`,
      description: "Schedule a callback with the customer.",
      location: "client",
      aiResponseMode: "none",
      aiContext: (result, args) =>
        `[UI Card Displayed: Callback scheduled ${args.date} at ${args.time}. User sees confirmation. Acknowledge briefly.]`,
      inputSchema: {
        type: "object",
        properties: {
          date: { type: "string", description: "Callback date" },
          time: { type: "string", description: "Callback time" },
        },
        required: ["date", "time"],
      },
      handler: async (params) => {
        dashboard.setCallbackScheduled({
          date: params.date as string,
          time: params.time as string,
        });
        return success({ scheduled: true });
      },
      render: (props) => (
        <CallbackScheduledCard
          date={props.args.date as string}
          time={props.args.time as string}
          phone={currentTicket.customer.phone}
          customerName={currentTicket.customer.name}
        />
      ),
    }),

    escalate_ticket: tool({
      title: (args) => `Escalate (${args.priority || "High"})`,
      executingTitle: "Assigning to supervisor...",
      completedTitle: "Ticket escalated",
      description:
        "Escalate ticket to supervisor. Pauses for user to select supervisor before completing.",
      location: "client",
      // NEW: This pauses execution until user selects a supervisor
      needsApproval: true,
      approvalMessage: "Select a supervisor to escalate this ticket to",
      aiResponseMode: "none",
      aiContext: (result) => {
        const data = result.data as
          | { supervisor: { name: string; role: string }; reason: string }
          | undefined;
        if (data?.supervisor) {
          return `[Escalation COMPLETED: Ticket has been escalated to ${data.supervisor.name} (${data.supervisor.role}). Reason: ${data.reason}. The supervisor has been notified and will take over this case.]`;
        }
        return `[Escalation failed or was cancelled]`;
      },
      inputSchema: {
        type: "object",
        properties: {
          reason: { type: "string", description: "Reason for escalation" },
          priority: {
            type: "string",
            description: "Priority level",
            enum: ["High", "Critical"],
          },
        },
        required: ["reason", "priority"],
      },
      // Handler receives user's selection via context.approvalData
      handler: async (params, context) => {
        // Get the supervisor selected by user from approval data
        const supervisor = context?.approvalData?.supervisor as
          | { name: string; role: string }
          | undefined;

        if (!supervisor) {
          return { success: false, error: "No supervisor selected" };
        }

        // Update dashboard state
        dashboard.setEscalatedTo(`${supervisor.name} (${supervisor.role})`);

        // Return the result - this becomes the tool response sent to AI
        return success({
          supervisor,
          reason: params.reason as string,
          priority: params.priority as string,
        });
      },
      // Render handles all statuses including approval-required
      render: (props) => {
        const { status, args, approval, result } = props;

        // Waiting for user to select supervisor
        if (status === "approval-required" && approval) {
          return (
            <EscalationCard
              reason={args.reason as string}
              priority={args.priority as string}
              onAssign={(supervisor) => {
                // Pass supervisor to handler via approval.onApprove
                approval.onApprove({ supervisor });
              }}
              onCancel={() => approval.onReject("Cancelled by user")}
            />
          );
        }

        // Completed - show assigned state
        if (status === "completed" && result?.data) {
          const data = result.data as {
            supervisor: { name: string; role: string };
            reason: string;
            priority: string;
          };
          return (
            <EscalationCard
              reason={data.reason}
              priority={data.priority}
              initialAssigned={true}
              initialSupervisor={data.supervisor.name}
            />
          );
        }

        // Error or rejected
        if (status === "error") {
          return (
            <div className="bg-card border border-red-500/30 rounded-xl p-4">
              <span className="text-sm text-red-500">
                Escalation failed: {props.error || "Unknown error"}
              </span>
            </div>
          );
        }

        return null;
      },
    }),
  } as any);

  return <TicketContext />;
}
