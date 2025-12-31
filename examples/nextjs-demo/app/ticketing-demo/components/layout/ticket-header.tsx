"use client";

import {
  ChevronLeft,
  ChevronRight,
  Pin,
  MoreHorizontal,
  ChevronDown,
  Zap,
  DollarSign,
  RotateCcw,
  ArrowRightLeft,
  PhoneCall,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useDashboard } from "../context/dashboard-context";
import { currentTicket } from "../data/mock-data";

export function TicketHeader() {
  const {
    ticketStatus,
    sentiment,
    appliedResolution,
    sentOffer,
    refundProcessed,
    exchangeProcessed,
    callbackScheduled,
    escalatedTo,
  } = useDashboard();

  const statusColors = {
    open: "bg-blue-500/10 text-blue-600 border-blue-500/30",
    pending: "bg-yellow-500/10 text-yellow-600 border-yellow-500/30",
    resolved: "bg-green-500/10 text-green-600 border-green-500/30",
    closed: "bg-muted text-muted-foreground border-border",
  };

  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card flex-wrap">
      <button className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
        <ChevronLeft className="w-4 h-4" />
        <span className="text-sm">Ticket List</span>
      </button>
      <div className="flex items-center gap-1 text-muted-foreground">
        <button className="p-1 hover:bg-accent rounded">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <button className="p-1 hover:bg-accent rounded">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-foreground">
          #{currentTicket.id}
        </span>
        <span className="text-sm text-muted-foreground">
          {currentTicket.title}
        </span>
        {sentiment && (
          <span className="text-lg" title={`Sentiment: ${sentiment.label}`}>
            {sentiment.emoji}
          </span>
        )}
        <button className="p-1 text-muted-foreground hover:text-foreground">
          <Pin className="w-4 h-4" />
        </button>
      </div>

      {/* Status Badge */}
      <div
        className={cn(
          "flex items-center gap-1.5 px-2.5 py-1 border rounded-full text-xs font-medium capitalize",
          statusColors[ticketStatus],
        )}
      >
        {ticketStatus === "resolved" && <CheckCircle2 className="w-3 h-3" />}
        {ticketStatus}
      </div>

      {/* Action Badges */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Applied Resolution */}
        {appliedResolution && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-purple-500/10 border border-purple-500/30 rounded-full">
            <Zap className="w-3 h-3 text-purple-500" />
            <span className="text-xs text-purple-600 font-medium">
              {appliedResolution}
            </span>
          </div>
        )}

        {/* Sent Offer */}
        {sentOffer && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-green-500/10 border border-green-500/30 rounded-full">
            <DollarSign className="w-3 h-3 text-green-500" />
            <span className="text-xs text-green-600 font-medium">
              {sentOffer.type}: {sentOffer.value}
            </span>
          </div>
        )}

        {/* Refund Processed */}
        {refundProcessed && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-500/10 border border-blue-500/30 rounded-full">
            <RotateCcw className="w-3 h-3 text-blue-500" />
            <span className="text-xs text-blue-600 font-medium">
              Refund: ${refundProcessed.amount}
            </span>
          </div>
        )}

        {/* Exchange Processed */}
        {exchangeProcessed && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-orange-500/10 border border-orange-500/30 rounded-full">
            <ArrowRightLeft className="w-3 h-3 text-orange-500" />
            <span className="text-xs text-orange-600 font-medium">
              Exchange: {exchangeProcessed.to}
            </span>
          </div>
        )}

        {/* Callback Scheduled */}
        {callbackScheduled && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-cyan-500/10 border border-cyan-500/30 rounded-full">
            <PhoneCall className="w-3 h-3 text-cyan-500" />
            <span className="text-xs text-cyan-600 font-medium">
              Callback: {callbackScheduled.date} {callbackScheduled.time}
            </span>
          </div>
        )}

        {/* Escalated */}
        {escalatedTo && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-red-500/10 border border-red-500/30 rounded-full">
            <AlertTriangle className="w-3 h-3 text-red-500" />
            <span className="text-xs text-red-600 font-medium">
              Escalated: {escalatedTo}
            </span>
          </div>
        )}
      </div>

      <div className="ml-auto flex items-center gap-2">
        <button className="p-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg">
          <MoreHorizontal className="w-5 h-5" />
        </button>
        <button className="px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors">
          Submit as Closed
        </button>
        <button className="p-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors">
          <ChevronDown className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
