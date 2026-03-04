"use client";

import { useState, useEffect } from "react";
import { CopilotProvider, useCopilot } from "@yourgpt/copilot-sdk/react";
import { CopilotChat, useCopilotChatContext } from "@yourgpt/copilot-sdk/ui";
import {
  Search,
  TrendingUp,
  TrendingDown,
  Star,
  Bell,
  Settings,
  Globe,
  BarChart2,
  PieChart,
  Activity,
  Clock,
  AlertCircle,
  Zap,
  Sparkles,
} from "lucide-react";

// ============================================
// Data
// ============================================

const watchlistStocks = [
  {
    symbol: "NVDA",
    name: "NVIDIA Corp",
    price: 892.4,
    change: -19.85,
    changePercent: -2.18,
  },
  {
    symbol: "AAPL",
    name: "Apple Inc.",
    price: 228.5,
    change: -3.42,
    changePercent: -1.47,
  },
  {
    symbol: "MSFT",
    name: "Microsoft",
    price: 412.8,
    change: -6.15,
    changePercent: -1.47,
  },
  {
    symbol: "TSLA",
    name: "Tesla Inc",
    price: 285.2,
    change: -4.62,
    changePercent: -1.59,
  },
  {
    symbol: "SMCI",
    name: "Super Micro",
    price: 48.75,
    change: 2.85,
    changePercent: 6.21,
  },
];

const breakingNews = [
  {
    title: "Markets plunge as Strait of Hormuz closure sparks oil crisis",
    time: "32 min ago",
    source: "Reuters",
    query:
      "What is happening with the Strait of Hormuz crisis today? How is it affecting stock markets in March 2026?",
  },
  {
    title: "NVIDIA invests $4B in photonics makers Coherent & Lumentum",
    time: "2h ago",
    source: "Bloomberg",
    query:
      "Why is NVIDIA investing in photonics companies? What is the Coherent and Lumentum deal about?",
  },
  {
    title: "US considers new caps on AI chip exports to China",
    time: "3h ago",
    source: "CNBC",
    query:
      "What are the new US export restrictions on AI chips to China in 2026? How will it affect NVIDIA?",
  },
];

const alerts = [
  {
    symbol: "NVDA",
    message: "Down 2.2% - export cap concerns",
    type: "warning",
  },
  { symbol: "SMCI", message: "Up 6.2% - AI server demand", type: "success" },
];

// ============================================
// Components with Copilot Integration
// ============================================

function StockRow({ stock }: { stock: (typeof watchlistStocks)[0] }) {
  const { sendMessage } = useCopilot();
  const isPositive = stock.change >= 0;

  const handleResearch = (e: React.MouseEvent) => {
    e.stopPropagation();
    const direction = isPositive ? "up" : "down";
    sendMessage(
      `Why is ${stock.symbol} ${direction} ${Math.abs(stock.changePercent).toFixed(1)}% today?`,
    );
  };

  return (
    <div className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0 group">
      <div className="flex items-center gap-3">
        <div
          className={`w-10 h-10 rounded-lg flex items-center justify-center ${
            isPositive ? "bg-green-50" : "bg-red-50"
          }`}
        >
          {isPositive ? (
            <TrendingUp className="w-4 h-4 text-green-600" />
          ) : (
            <TrendingDown className="w-4 h-4 text-red-500" />
          )}
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-900">{stock.symbol}</p>
          <p className="text-xs text-gray-500">{stock.name}</p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="text-right">
          <p className="text-sm font-semibold text-gray-900">
            ${stock.price.toFixed(2)}
          </p>
          <p
            className={`text-xs font-medium ${isPositive ? "text-green-600" : "text-red-500"}`}
          >
            {isPositive ? "+" : ""}
            {stock.changePercent.toFixed(2)}%
          </p>
        </div>
        <button
          onClick={handleResearch}
          className="opacity-0 group-hover:opacity-100 p-2 hover:bg-blue-50 rounded-lg transition-all cursor-pointer"
          title="Research this stock"
        >
          <Sparkles className="w-4 h-4 text-blue-600" />
        </button>
      </div>
    </div>
  );
}

function NewsCard({ item }: { item: (typeof breakingNews)[0] }) {
  const { sendMessage } = useCopilot();

  const handleResearch = () => {
    sendMessage(item.query);
  };

  return (
    <div className="p-4 border-b border-gray-100 last:border-0 group">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 mb-1 leading-snug">
            {item.title}
          </p>
          <div className="flex items-center gap-2 text-xs text-gray-400 mb-2">
            <span className="font-medium text-gray-500">{item.source}</span>
            <span>•</span>
            <Clock className="w-3 h-3" />
            <span>{item.time}</span>
          </div>
          <button
            onClick={handleResearch}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors cursor-pointer"
          >
            <Sparkles className="w-3 h-3" />
            Research this
          </button>
        </div>
      </div>
    </div>
  );
}

function AlertBadge({ alert }: { alert: (typeof alerts)[0] }) {
  const { sendMessage } = useCopilot();
  const isWarning = alert.type === "warning";

  const handleClick = () => {
    sendMessage(
      `Why is ${alert.symbol} ${isWarning ? "dropping" : "rising"}? What's the latest news?`,
    );
  };

  return (
    <button
      onClick={handleClick}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs cursor-pointer transition-colors ${
        isWarning
          ? "bg-amber-50 text-amber-700 hover:bg-amber-100"
          : "bg-green-50 text-green-700 hover:bg-green-100"
      }`}
    >
      <AlertCircle className="w-3.5 h-3.5" />
      <span className="font-semibold">{alert.symbol}</span>
      <span>{alert.message}</span>
      <Sparkles className="w-3 h-3 ml-1 opacity-60" />
    </button>
  );
}

// ============================================
// Copilot Suggestions
// ============================================

function SuggestionChip({ label }: { label: string }) {
  const { send } = useCopilotChatContext();
  return (
    <button
      onClick={() => send(label)}
      className="px-3 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full transition-colors cursor-pointer whitespace-nowrap"
    >
      {label}
    </button>
  );
}

function CopilotSuggestions() {
  return (
    <div className="flex flex-wrap gap-2">
      <SuggestionChip label="Strait of Hormuz crisis impact?" />
      <SuggestionChip label="NVIDIA photonics investment?" />
      <SuggestionChip label="Fed rate outlook 2026?" />
      <SuggestionChip label="China chip export caps?" />
    </div>
  );
}

// ============================================
// Main Content (Inside Provider)
// ============================================

function DashboardContent() {
  return (
    <div className="h-screen flex bg-gray-50">
      {/* Sidebar Navigation */}
      <nav className="w-16 bg-gray-900 flex flex-col items-center py-4 gap-2">
        <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center mb-4">
          <Activity className="w-5 h-5 text-white" />
        </div>
        <button className="w-10 h-10 rounded-xl bg-gray-800 flex items-center justify-center text-white">
          <PieChart className="w-5 h-5" />
        </button>
        <button className="w-10 h-10 rounded-xl hover:bg-gray-800 flex items-center justify-center text-gray-400 transition-colors">
          <BarChart2 className="w-5 h-5" />
        </button>
        <button className="w-10 h-10 rounded-xl hover:bg-gray-800 flex items-center justify-center text-gray-400 transition-colors">
          <Star className="w-5 h-5" />
        </button>
        <div className="flex-1" />
        <button className="w-10 h-10 rounded-xl hover:bg-gray-800 flex items-center justify-center text-gray-400 transition-colors relative">
          <Bell className="w-5 h-5" />
          <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full" />
        </button>
        <button className="w-10 h-10 rounded-xl hover:bg-gray-800 flex items-center justify-center text-gray-400 transition-colors">
          <Settings className="w-5 h-5" />
        </button>
      </nav>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-semibold text-gray-900">Portfolio</h1>
              <div className="flex items-center gap-4 mt-1">
                <span className="text-2xl font-bold text-gray-900">
                  $278,450.25
                </span>
                <span className="flex items-center gap-1 text-sm font-medium text-red-500">
                  <TrendingDown className="w-4 h-4" />
                  -$6,285.40 (-2.21%)
                </span>
                <span className="text-xs text-gray-400">Today</span>
              </div>
            </div>
            <div className="flex items-center gap-6 text-sm">
              <div>
                <span className="text-gray-500">S&P 500</span>
                <span className="ml-2 font-medium">5,124.30</span>
                <span className="ml-1 text-red-500">-2.18%</span>
              </div>
              <div>
                <span className="text-gray-500">NASDAQ</span>
                <span className="ml-2 font-medium">16,028</span>
                <span className="ml-1 text-red-500">-2.41%</span>
              </div>
              <div>
                <span className="text-gray-500">VIX</span>
                <span className="ml-2 font-medium">26.43</span>
                <span className="ml-1 text-red-500">+23%</span>
              </div>
            </div>
          </div>
        </header>

        {/* Content Grid */}
        <div className="p-6 grid grid-cols-2 gap-6">
          {/* Alerts */}
          <div className="col-span-2 flex gap-3">
            {alerts.map((alert, i) => (
              <AlertBadge key={i} alert={alert} />
            ))}
          </div>

          {/* Watchlist */}
          <div className="bg-white rounded-xl border border-gray-200">
            <div className="px-4 py-3 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Star className="w-4 h-4 text-yellow-500" />
                  <h3 className="font-semibold text-gray-900">Watchlist</h3>
                </div>
                <span className="text-xs text-gray-400">Hover to research</span>
              </div>
            </div>
            <div className="px-4">
              {watchlistStocks.map((stock) => (
                <StockRow key={stock.symbol} stock={stock} />
              ))}
            </div>
          </div>

          {/* Breaking News */}
          <div className="bg-white rounded-xl border border-gray-200">
            <div className="px-4 py-3 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-500" />
                  <h3 className="font-semibold text-gray-900">Breaking News</h3>
                </div>
                <span className="text-xs text-gray-400">
                  Click to dig deeper
                </span>
              </div>
            </div>
            <div>
              {breakingNews.map((item, i) => (
                <NewsCard key={i} item={item} />
              ))}
            </div>
          </div>
        </div>
      </main>

      {/* Research Assistant Sidebar */}
      <aside className="w-[400px] border-l border-gray-200 bg-white flex flex-col">
        <CopilotChat.Root
          persistence={false}
          className="h-full flex flex-col"
          showPoweredBy={false}
        >
          {/* Home View */}
          <CopilotChat.HomeView className="flex-1 flex flex-col">
            {/* Header */}
            <div className="px-5 py-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center">
                  <Search className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <h2 className="text-sm font-semibold text-gray-900">
                    Research Assistant
                  </h2>
                  <p className="text-xs text-gray-500">AI-powered web search</p>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 flex flex-col p-5 gap-5">
              {/* Welcome */}
              <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                <div className="flex items-start gap-3">
                  <Globe className="w-5 h-5 text-blue-600 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-gray-900 mb-1">
                      Real-time market intelligence
                    </p>
                    <p className="text-xs text-gray-600 leading-relaxed">
                      Click{" "}
                      <Sparkles className="w-3 h-3 inline text-blue-600" /> on
                      any stock or news to research it instantly.
                    </p>
                  </div>
                </div>
              </div>

              {/* Suggestions */}
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">
                  Suggested
                </p>
                <CopilotSuggestions />
              </div>

              {/* Spacer */}
              <div className="flex-1" />

              {/* Input */}
              <CopilotChat.Input placeholder="Ask about any stock or news..." />
            </div>
          </CopilotChat.HomeView>

          {/* Chat View */}
          <CopilotChat.ChatView>
            <CopilotChat.Header className="flex items-center gap-3 px-5 py-3 border-b border-gray-100">
              <CopilotChat.BackButton className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600 transition-colors cursor-pointer">
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
              </CopilotChat.BackButton>
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center">
                <Search className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-sm font-semibold text-gray-900">
                  Research Assistant
                </h2>
                <CopilotChat.ThreadPicker size="sm" />
              </div>
            </CopilotChat.Header>
          </CopilotChat.ChatView>
        </CopilotChat.Root>
      </aside>
    </div>
  );
}

// ============================================
// Main Page
// ============================================

export default function WebSearchDemo() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <CopilotProvider
      runtimeUrl="/api/chat"
      maxIterations={5}
      systemPrompt={`You are a concise investment research assistant. Keep responses brief and scannable:

- Use bullet points for multiple items
- Lead with the key insight or number
- Max 2-3 short paragraphs
- Skip unnecessary disclaimers
- Include source attribution when citing news

Example format:
"NVDA dropped 3.2% today due to:
• Export restrictions to China announced
• Profit-taking after 200% YTD run
• Broader tech sector pullback

Source: Reuters, Bloomberg"`}
    >
      <DashboardContent />
    </CopilotProvider>
  );
}
