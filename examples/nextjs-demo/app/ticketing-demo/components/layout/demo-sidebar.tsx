"use client";

import { cn } from "@/lib/utils";
import {
  MoreHorizontal,
  Search,
  Command,
  Star,
  HelpCircle,
  Shield,
  Link2,
} from "lucide-react";
import { useDashboard } from "../context/dashboard-context";
import { sidebarNavItems } from "../data/mock-data";

// Geometric logo component for SupportDesk
function SupportDeskLogo() {
  return (
    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-sidebar-primary to-sidebar-primary/70 flex items-center justify-center relative overflow-hidden">
      {/* Abstract ticket/chat bubble shape */}
      <div className="relative w-6 h-6">
        {/* Main square (ticket) */}
        <div className="absolute inset-0 bg-sidebar-primary-foreground/90 rounded-sm transform rotate-3" />
        {/* Corner fold */}
        <div className="absolute top-0 right-0 w-2 h-2 bg-sidebar-primary/50 rounded-bl-sm" />
        {/* Lines representing text */}
        <div className="absolute top-1.5 left-1 right-2 space-y-1">
          <div className="h-0.5 bg-sidebar-primary/40 rounded-full w-full" />
          <div className="h-0.5 bg-sidebar-primary/40 rounded-full w-3/4" />
          <div className="h-0.5 bg-sidebar-primary/40 rounded-full w-1/2" />
        </div>
      </div>
      {/* Subtle corner accent */}
      <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-sidebar-primary-foreground/10 rounded-full blur-sm" />
    </div>
  );
}

export function DemoSidebar() {
  const { linkedTickets, customerRisk, sentiment } = useDashboard();

  return (
    <aside className="w-56 bg-sidebar border-r border-sidebar-border flex flex-col h-full">
      {/* Logo */}
      <div className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <SupportDeskLogo />
          <div className="flex-1 min-w-0">
            <h1 className="font-semibold text-sidebar-foreground text-sm">
              SupportDesk
            </h1>
            <p className="text-xs text-muted-foreground">AI-Powered Help</p>
          </div>
          <button className="p-1 text-muted-foreground hover:text-sidebar-foreground">
            <MoreHorizontal className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* AI Insights Quick View */}
      {(customerRisk || sentiment) && (
        <div className="p-3 border-b border-sidebar-border space-y-2">
          <div className="text-xs font-semibold text-muted-foreground uppercase">
            AI Insights
          </div>
          {customerRisk && (
            <div
              className={cn(
                "flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs",
                customerRisk.level === "low"
                  ? "bg-green-500/10 text-green-600"
                  : customerRisk.level === "medium"
                    ? "bg-yellow-500/10 text-yellow-600"
                    : "bg-red-500/10 text-red-600",
              )}
            >
              <Shield className="w-3 h-3" />
              <span className="capitalize">{customerRisk.level} Risk</span>
              <span className="ml-auto font-medium">
                {customerRisk.score}/100
              </span>
            </div>
          )}
          {sentiment && (
            <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-sidebar-accent text-xs text-sidebar-foreground">
              <span>{sentiment.emoji}</span>
              <span>{sentiment.label}</span>
              <span className="ml-auto font-medium">{sentiment.score}/100</span>
            </div>
          )}
        </div>
      )}

      {/* Search */}
      <div className="p-3">
        <div className="flex items-center gap-2 px-3 py-2 bg-sidebar-accent rounded-lg text-muted-foreground text-sm cursor-pointer hover:bg-accent transition-colors">
          <Search className="w-4 h-4" />
          <span>Search</span>
          <div className="ml-auto flex items-center gap-1 text-xs bg-background px-1.5 py-0.5 rounded border border-border">
            <Command className="w-3 h-3" />
            <span>K</span>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-2 overflow-y-auto">
        <ul className="space-y-1">
          {sidebarNavItems.map((item) => (
            <li key={item.label}>
              <a
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                  item.active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    : "text-sidebar-foreground hover:bg-sidebar-accent",
                )}
              >
                <item.icon className="w-4 h-4" />
                <span>{item.label}</span>
                {item.badge && (
                  <span className="ml-auto bg-sidebar-primary text-sidebar-primary-foreground text-xs px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                    {item.badge}
                  </span>
                )}
              </a>
            </li>
          ))}
        </ul>

        {/* Linked Tickets */}
        {linkedTickets.length > 0 && (
          <div className="mt-6">
            <h3 className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Linked Tickets
            </h3>
            <ul className="mt-2 space-y-1">
              {linkedTickets.map((ticket) => (
                <li key={ticket.id}>
                  <a
                    href="#"
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-sidebar-foreground hover:bg-sidebar-accent"
                  >
                    <Link2 className="w-3 h-3 text-chart-3" />
                    <span className="truncate flex-1">#{ticket.id}</span>
                    <span
                      className={cn(
                        "text-xs px-1.5 py-0.5 rounded",
                        ticket.status === "Resolved"
                          ? "bg-green-500/20 text-green-600"
                          : "bg-yellow-500/20 text-yellow-600",
                      )}
                    >
                      {ticket.status}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Pinned Tickets */}
        <div className="mt-6">
          <div className="flex items-center justify-between px-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Pinned Tickets
            </h3>
            <button className="text-xs text-muted-foreground hover:text-sidebar-foreground">
              Unpin All
            </button>
          </div>
          <ul className="mt-2 space-y-1">
            <li>
              <a
                href="#"
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-sidebar-foreground hover:bg-sidebar-accent"
              >
                <span className="w-2 h-2 bg-sidebar-primary rounded-full shrink-0"></span>
                <span className="truncate flex-1">#TC-192 product...</span>
                <Star className="w-3 h-3 text-muted-foreground shrink-0" />
              </a>
            </li>
            <li>
              <a
                href="#"
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-sidebar-foreground hover:bg-sidebar-accent"
              >
                <span className="w-2 h-2 bg-chart-4 rounded-full shrink-0"></span>
                <span className="truncate flex-1">#TC-191 paymen...</span>
                <Star className="w-3 h-3 text-muted-foreground shrink-0" />
              </a>
            </li>
          </ul>
        </div>
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-sidebar-border">
        <a
          href="#"
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-sidebar-foreground hover:bg-sidebar-accent"
        >
          <HelpCircle className="w-4 h-4" />
          <span>Help & Support</span>
        </a>
        <div className="flex items-center gap-2 px-3 py-2 mt-2">
          <span className="text-[10px] text-muted-foreground uppercase">
            AI by
          </span>
          <span className="text-xs font-semibold text-sidebar-primary">
            Copilot SDK
          </span>
        </div>
      </div>
    </aside>
  );
}
