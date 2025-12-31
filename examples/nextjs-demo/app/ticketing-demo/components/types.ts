// ============================================
// DASHBOARD STATE TYPES
// ============================================

export interface CustomerRisk {
  level: "low" | "medium" | "high";
  score: number;
  reasons: string[];
}

export interface Sentiment {
  emoji: string;
  label: string;
  score: number;
  reasons: string[];
}

export interface LinkedTicket {
  id: string;
  title: string;
  status: string;
  resolution?: string;
}

export interface CustomerContext {
  ltv: string;
  tier: string;
  orderCount: number;
  ticketCount: number;
  avgResponseTime: string;
  satisfactionScore: number;
  riskFactors: string[];
  recommendations: string[];
}

// Message types for the conversation
export interface TicketMessage {
  id: number;
  type: "system" | "customer" | "agent";
  content: string;
  timestamp: string;
  sender?: string;
  avatar?: string;
  channel?: string;
  hasEmoji?: boolean;
}

// Ticket status
export type TicketStatus = "open" | "pending" | "resolved" | "closed";

export interface DashboardState {
  // Conversation
  messages: TicketMessage[];
  ticketStatus: TicketStatus;
  // Compose
  composeText: string;
  // AI Insights
  customerRisk: CustomerRisk | null;
  sentiment: Sentiment | null;
  customerContext: CustomerContext | null;
  // Actions taken
  linkedTickets: LinkedTicket[];
  appliedResolution: string | null;
  sentOffer: { type: string; value: string } | null;
  // Refund/Exchange tracking
  refundProcessed: { orderId: string; amount: number; reason: string } | null;
  exchangeProcessed: { from: string; to: string } | null;
  callbackScheduled: { date: string; time: string } | null;
  escalatedTo: string | null;
}

export interface DashboardContextType extends DashboardState {
  // Message management
  addMessage: (message: Omit<TicketMessage, "id">) => void;
  sendAgentMessage: (content: string) => void;
  // Ticket status
  setTicketStatus: (status: TicketStatus) => void;
  // Compose
  setComposeText: (text: string) => void;
  // AI Insights
  setCustomerRisk: (risk: CustomerRisk) => void;
  setSentiment: (sentiment: Sentiment) => void;
  setCustomerContext: (context: CustomerContext) => void;
  // Actions
  addLinkedTicket: (ticket: LinkedTicket) => void;
  setAppliedResolution: (resolution: string) => void;
  setSentOffer: (offer: { type: string; value: string }) => void;
  setRefundProcessed: (refund: {
    orderId: string;
    amount: number;
    reason: string;
  }) => void;
  setExchangeProcessed: (exchange: { from: string; to: string }) => void;
  setCallbackScheduled: (callback: { date: string; time: string }) => void;
  setEscalatedTo: (supervisor: string) => void;
}

// Re-export ToolRendererProps from SDK for convenience
export type { ToolRendererProps } from "@yourgpt/copilot-sdk-ui";
