"use client";

import { createContext, useContext, useState, useCallback } from "react";
import type {
  DashboardState,
  DashboardContextType,
  CustomerRisk,
  Sentiment,
  CustomerContext,
  LinkedTicket,
  TicketMessage,
  TicketStatus,
} from "../types";
import { mockMessages, avatars } from "../data/mock-data";

const DashboardContext = createContext<DashboardContextType | null>(null);

export function useDashboard() {
  const context = useContext(DashboardContext);
  if (!context)
    throw new Error("useDashboard must be used within DashboardProvider");
  return context;
}

// Helper to get current time string
function getCurrentTime(): string {
  return new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function DashboardProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<DashboardState>({
    // Initialize with mock messages
    messages: mockMessages as TicketMessage[],
    ticketStatus: "open",
    composeText: "",
    customerRisk: null,
    sentiment: null,
    customerContext: null,
    linkedTickets: [],
    appliedResolution: null,
    sentOffer: null,
    refundProcessed: null,
    exchangeProcessed: null,
    callbackScheduled: null,
    escalatedTo: null,
  });

  // Message management
  const addMessage = useCallback((message: Omit<TicketMessage, "id">) => {
    setState((prev) => ({
      ...prev,
      messages: [...prev.messages, { ...message, id: Date.now() }],
    }));
  }, []);

  const sendAgentMessage = useCallback((content: string) => {
    if (!content.trim()) return;
    setState((prev) => ({
      ...prev,
      messages: [
        ...prev.messages,
        {
          id: Date.now(),
          type: "agent" as const,
          sender: "Marcus Johnson",
          avatar: avatars.agent,
          channel: "Chat",
          timestamp: getCurrentTime(),
          content,
        },
      ],
      composeText: "", // Clear compose after sending
    }));
  }, []);

  // Ticket status
  const setTicketStatus = useCallback((status: TicketStatus) => {
    setState((prev) => ({ ...prev, ticketStatus: status }));
  }, []);

  // Compose
  const setComposeText = useCallback((text: string) => {
    setState((prev) => ({ ...prev, composeText: text }));
  }, []);

  // AI Insights
  const setCustomerRisk = useCallback((risk: CustomerRisk) => {
    setState((prev) => ({ ...prev, customerRisk: risk }));
  }, []);

  const setSentiment = useCallback((sentiment: Sentiment) => {
    setState((prev) => ({ ...prev, sentiment }));
  }, []);

  const setCustomerContext = useCallback((context: CustomerContext) => {
    setState((prev) => ({ ...prev, customerContext: context }));
  }, []);

  // Actions
  const addLinkedTicket = useCallback((ticket: LinkedTicket) => {
    setState((prev) => ({
      ...prev,
      linkedTickets: prev.linkedTickets.some((t) => t.id === ticket.id)
        ? prev.linkedTickets
        : [...prev.linkedTickets, ticket],
    }));
  }, []);

  const setAppliedResolution = useCallback((resolution: string) => {
    setState((prev) => ({ ...prev, appliedResolution: resolution }));
  }, []);

  const setSentOffer = useCallback((offer: { type: string; value: string }) => {
    setState((prev) => ({ ...prev, sentOffer: offer }));
  }, []);

  const setRefundProcessed = useCallback(
    (refund: { orderId: string; amount: number; reason: string }) => {
      setState((prev) => ({ ...prev, refundProcessed: refund }));
    },
    [],
  );

  const setExchangeProcessed = useCallback(
    (exchange: { from: string; to: string }) => {
      setState((prev) => ({ ...prev, exchangeProcessed: exchange }));
    },
    [],
  );

  const setCallbackScheduled = useCallback(
    (callback: { date: string; time: string }) => {
      setState((prev) => ({ ...prev, callbackScheduled: callback }));
    },
    [],
  );

  const setEscalatedTo = useCallback((supervisor: string) => {
    setState((prev) => ({ ...prev, escalatedTo: supervisor }));
  }, []);

  return (
    <DashboardContext.Provider
      value={{
        ...state,
        addMessage,
        sendAgentMessage,
        setTicketStatus,
        setComposeText,
        setCustomerRisk,
        setSentiment,
        setCustomerContext,
        addLinkedTicket,
        setAppliedResolution,
        setSentOffer,
        setRefundProcessed,
        setExchangeProcessed,
        setCallbackScheduled,
        setEscalatedTo,
      }}
    >
      {children}
    </DashboardContext.Provider>
  );
}
