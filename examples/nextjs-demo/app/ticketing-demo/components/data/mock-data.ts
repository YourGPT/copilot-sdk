import {
  LayoutDashboard,
  Inbox,
  Bell,
  Ticket,
  BookOpen,
  Users,
  MessageSquare,
  BarChart3,
  Phone,
  MessageCircle,
} from "lucide-react";

// Avatar URLs from randomuser.me for realistic photos
export const avatars = {
  customer: "https://randomuser.me/api/portraits/women/44.jpg",
  agent: "https://randomuser.me/api/portraits/men/32.jpg",
};

export const currentTicket = {
  id: "TK-4892",
  title: "Want to downgrade my subscription",
  customer: {
    id: "cust-2847",
    name: "Sarah Chen",
    email: "sarah.chen@techcorp.io",
    phone: "+1 415-555-0142",
    location: "San Francisco, CA",
    tier: "Pro",
    plan: "Pro Plan - $49/month",
    totalOrders: 0, // SaaS - no orders
    subscriptionMonths: 58, // 5 years
    lifetimeValue: "$2,842",
    memberSince: "Feb 2020",
    company: "TechCorp Inc.",
    teamSize: 12,
    usage: {
      activeUsers: 4,
      storageUsed: "12GB of 100GB",
      apiCalls: "2,340 / 50,000",
      features: ["Analytics", "API Access", "Priority Support"],
    },
  },
  subscription: {
    id: "SUB-2847",
    plan: "Pro",
    price: 49,
    billingCycle: "monthly",
    nextBilling: "Jan 15, 2025",
    status: "Active",
    startDate: "Feb 2020",
  },
  status: "open",
  priority: "High",
  channel: "Chat",
};

export const mockMessages = [
  {
    id: 1,
    type: "system" as const,
    content: "Chat started - Sarah Chen connected via web chat",
    timestamp: "2:14 PM",
  },
  {
    id: 2,
    type: "customer" as const,
    sender: "Sarah Chen",
    avatar: avatars.customer,
    channel: "Chat",
    timestamp: "2:14 PM",
    content:
      "Hi, I'd like to downgrade my account from Pro to Basic plan please.",
  },
  {
    id: 3,
    type: "agent" as const,
    sender: "Marcus Johnson",
    avatar: avatars.agent,
    channel: "Chat",
    timestamp: "2:15 PM",
    content:
      "Hi Sarah! Thanks for reaching out. I can definitely help you with that. Before I process the change, would you mind sharing what's prompting the switch? I want to make sure you're getting the best value.",
  },
  {
    id: 4,
    type: "customer" as const,
    sender: "Sarah Chen",
    avatar: avatars.customer,
    channel: "Chat",
    timestamp: "2:16 PM",
    content:
      "To be honest, we've been looking at costs across all our tools. I saw that Notion is offering similar features for less, and my manager is asking me to cut our software budget by 20%.",
  },
  {
    id: 5,
    type: "agent" as const,
    sender: "Marcus Johnson",
    avatar: avatars.agent,
    channel: "Chat",
    timestamp: "2:17 PM",
    content:
      "I completely understand - budget reviews are important. You've been with us for almost 5 years, which is amazing! Can I ask which Pro features your team uses most? I want to see if there's a way to keep what you need while hitting that budget target.",
  },
  {
    id: 6,
    type: "customer" as const,
    sender: "Sarah Chen",
    avatar: avatars.customer,
    channel: "Chat",
    timestamp: "2:18 PM",
    content:
      "Honestly? We mainly use the analytics dashboard and the API for our internal tools. The priority support is nice but we've only used it twice. The rest of the Pro features we barely touch.",
  },
  {
    id: 7,
    type: "customer" as const,
    sender: "Sarah Chen",
    avatar: avatars.customer,
    channel: "Chat",
    timestamp: "2:19 PM",
    content:
      "I checked and Basic doesn't include API access which we need. So I'm kind of stuck between paying $49 for features I don't use, or losing something essential. It's frustrating.",
  },
  {
    id: 8,
    type: "agent" as const,
    sender: "Marcus Johnson",
    avatar: avatars.agent,
    channel: "Chat",
    timestamp: "2:20 PM",
    content:
      "That's really helpful context, Sarah. I hear you - paying for unused features doesn't feel great. Let me look into some options that might work better for your situation. Give me just a moment.",
  },
  {
    id: 9,
    type: "system" as const,
    content: "Marcus is reviewing account details...",
    timestamp: "2:20 PM",
  },
  {
    id: 10,
    type: "customer" as const,
    sender: "Sarah Chen",
    avatar: avatars.customer,
    channel: "Chat",
    timestamp: "2:22 PM",
    content:
      "Sure, take your time. I'm not in a huge rush - our renewal isn't until the 15th. But I do need to give my manager an answer by end of week.",
  },
  {
    id: 11,
    type: "agent" as const,
    sender: "Marcus Johnson",
    avatar: avatars.agent,
    channel: "Chat",
    timestamp: "2:23 PM",
    content:
      "Thanks for your patience! I see you're using about 12GB of storage and around 2,300 API calls monthly. That's well within our limits. I'm checking what options I can offer you - I want to find something that works for both your budget and your needs.",
  },
  {
    id: 12,
    type: "customer" as const,
    sender: "Sarah Chen",
    avatar: avatars.customer,
    channel: "Chat",
    timestamp: "2:24 PM",
    content:
      "I appreciate that. Look, I really like the product - we've built some of our workflows around it. I just need to show my manager we're being cost-conscious. If there's any flexibility on pricing, I'm all ears.",
  },
];

export const sidebarNavItems = [
  { icon: LayoutDashboard, label: "Dashboard", href: "#" },
  { icon: Inbox, label: "Inbox", href: "#", badge: 12 },
  { icon: Bell, label: "Notifications", href: "#", badge: 3 },
  { icon: Ticket, label: "Tickets", href: "#", active: true },
  { icon: BookOpen, label: "Knowledge Base", href: "#" },
  { icon: Users, label: "Customers", href: "#" },
  { icon: MessageSquare, label: "Community", href: "#" },
  { icon: BarChart3, label: "Analytics", href: "#" },
];

export const conversationItems = [
  { icon: Phone, label: "Call", href: "#", badge: 1 },
  { icon: MessageCircle, label: "Side Conversation...", href: "#", count: 0 },
];

// Demo Query Journey - suggested queries in order
export const demoQueryJourney = [
  {
    step: 1,
    query: "What's Sarah's customer history and value?",
    tool: "get_customer_context",
    purpose: "Understand customer importance before responding",
  },
  {
    step: 2,
    query: "How is she feeling about this?",
    tool: "detect_sentiment",
    purpose: "Gauge emotional state - frustrated? understanding?",
  },
  {
    step: 3,
    query: "What's the risk of losing her?",
    tool: "analyze_customer_risk",
    purpose: "Assess churn probability for 5-year customer",
  },
  {
    step: 4,
    query: "Have we handled similar downgrade requests before?",
    tool: "find_similar_tickets",
    purpose: "Learn from past successful saves",
  },
  {
    step: 5,
    query: "What should I offer her to stay?",
    tool: "calculate_compensation",
    purpose: "Get personalized retention offers based on LTV",
  },
  {
    step: 6,
    query: "What's the best approach here?",
    tool: "suggest_resolution",
    purpose: "AI recommendation for handling this case",
  },
  {
    step: 7,
    query: "Draft a response with a retention offer",
    tool: "draft_response",
    purpose: "Generate empathetic message with offer",
  },
];

export type MessageType = (typeof mockMessages)[number];
