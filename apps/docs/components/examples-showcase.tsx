"use client";

import { Play, X } from "lucide-react";
import { useState, useEffect, useCallback } from "react";

interface Example {
  id: string;
  title: string;
  description: string;
  preview: string;
  tags: string[];
  href?: string;
  github?: string;
  video?: string;
}

const VIDEO_BASE_URL = "https://assets.yourgpt.ai/web/copilot-sdk";

const examples: Example[] = [
  {
    id: "mcp-demo",
    title: "MCP Integration",
    description:
      "Connect to MCP servers and access 50+ tools including web search, scraping, SEO, and more. Features MCP-UI for interactive components like product cards, polls, and charts.",
    preview: "/images/mcp-demo.png",
    tags: ["MCP", "Tools", "MCP-UI", "Interactive"],
    github:
      "https://github.com/YourGPT/copilot-sdk/tree/main/examples/mcp-demo",
    video: `${VIDEO_BASE_URL}/mcp-copilot-sdk.mp4`,
  },
  {
    id: "web-search-demo",
    title: "Web Search Assistant",
    description:
      "Real-time market research assistant with native web search. Click on stocks or news to instantly research using AI-powered search from OpenAI, Google, or Anthropic.",
    preview: "/images/web-search-demo.png",
    tags: ["Web Search", "Research", "Real-time", "Finance"],
    github:
      "https://github.com/YourGPT/copilot-sdk/tree/main/examples/web-search-demo",
    video: `${VIDEO_BASE_URL}/web-search-copilot-sdk.mp4`,
  },
  {
    id: "support-system",
    title: "Support Ticket System",
    description:
      "AI-powered customer support with intelligent ticket routing, automatic escalation, and context-aware responses. Handle inquiries, resolve issues, and escalate complex cases seamlessly.",
    preview: "/images/copilot-sdk-support-demo.png",
    tags: ["Customer Support", "Ticketing", "Escalation", "Enterprise"],
    href: "#",
    github: "https://github.com/YourGPT/copilot-sdk/tree/main/examples",
    video: `${VIDEO_BASE_URL}/copilot-sdk-demo-1.mp4`,
  },
  {
    id: "debug-assistant",
    title: "Debug Assistant",
    description:
      "AI-powered debugging companion that captures console logs, takes screenshots, and provides intelligent analysis with actionable suggestions.",
    preview: "/images/debug-assistant-demo.webp",
    tags: ["Developer Tools", "Debugging", "Console Logs", "Screenshots"],
    github:
      "https://github.com/YourGPT/copilot-sdk/tree/main/examples/debug-assistant-demo",
    video: `${VIDEO_BASE_URL}/support-assistant-1.mp4`,
  },
  {
    id: "saas-demo",
    title: "SaaS Application",
    description:
      "SaaS template with AI copilot integration. Includes subscription handling, billing management, and intelligent assistance for common workflows.",
    preview: "/images/saas-demo.webp",
    tags: ["SaaS", "Subscription", "Billing", "Dashboard"],
    github:
      "https://github.com/YourGPT/copilot-sdk/tree/main/examples/saas-demo",
    video: `${VIDEO_BASE_URL}/smart-banking-assistant.mp4`,
  },
];

function VideoModal({
  isOpen,
  onClose,
  videoUrl,
  posterUrl,
}: {
  isOpen: boolean;
  onClose: () => void;
  videoUrl: string;
  posterUrl?: string;
}) {
  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [isOpen, handleEscape]);

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center transition-all duration-300 ${isOpen ? "opacity-100 visible" : "opacity-0 invisible pointer-events-none"}`}
      onClick={onClose}
    >
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity duration-300 ${isOpen ? "opacity-100" : "opacity-0"}`}
      />

      {/* Modal Content */}
      <div
        className={`relative w-full max-w-5xl mx-4 transition-all duration-300 ${isOpen ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 translate-y-4"}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute -top-12 right-0 flex items-center gap-2 text-white/80 hover:text-white transition-colors group"
        >
          <span className="text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity">
            Close
          </span>
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors">
            <X className="h-5 w-5" />
          </div>
        </button>

        {/* Video Container */}
        <div
          className="relative overflow-hidden rounded-2xl bg-black shadow-2xl ring-1 ring-white/10"
          style={{ aspectRatio: "1277/720" }}
        >
          {isOpen && (
            <video
              src={videoUrl}
              poster={posterUrl}
              className="w-full h-full object-contain my-0!"
              controls
              autoPlay
              playsInline
            />
          )}
        </div>
      </div>
    </div>
  );
}

function ExampleCard({
  example,
  onPlayClick,
}: {
  example: Example;
  index: number;
  onPlayClick: () => void;
}) {
  const hasVideo = Boolean(example.video);

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-2xl border border-fd-border bg-fd-card transition-colors duration-200 hover:border-fd-border/80">
      {/* Preview Area */}
      {hasVideo ? (
        <button
          onClick={onPlayClick}
          className="relative aspect-video overflow-hidden bg-fd-secondary/50 cursor-pointer w-full text-left"
        >
          {/* Thumbnail Image */}
          <img
            src={example.preview}
            alt={example.title}
            className="absolute inset-0 w-full h-full object-cover"
          />

          {/* Play button overlay */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full border border-fd-border bg-fd-background/90 shadow-lg group-hover:scale-110 group-hover:bg-fd-background transition-all duration-200">
              <Play
                className="h-5 w-5 text-fd-foreground ml-0.5"
                fill="currentColor"
              />
            </div>
          </div>

          {/* Watch Demo label */}
          <div className="absolute bottom-3 left-3 flex items-center gap-1.5 rounded-full bg-fd-background/90 border border-fd-border px-3 py-1 text-xs font-medium text-fd-foreground opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <Play className="h-3 w-3" fill="currentColor" />
            Watch Demo
          </div>
        </button>
      ) : (
        <div className="relative aspect-video overflow-hidden bg-fd-secondary/50">
          {/* Poster Image */}
          <img
            src={example.preview}
            alt={example.title}
            className="absolute inset-0 w-full h-full object-cover"
          />
          {/* Video coming soon badge */}
          <div className="absolute top-3 right-3 flex items-center gap-1.5 rounded-full bg-fd-background/90 border border-fd-border px-2.5 py-1 text-[10px] font-medium text-fd-muted-foreground">
            Video coming soon
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex flex-1 flex-col p-5">
        <h3 className="text-lg font-semibold text-fd-foreground tracking-tight mb-2">
          {example.title}
        </h3>

        <p className="text-sm text-fd-muted-foreground leading-relaxed mb-4 flex-1">
          {example.description}
        </p>

        {/* Tags & GitHub */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-wrap gap-1.5">
            {example.tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center rounded-md bg-fd-secondary/70 px-2 py-0.5 text-[11px] font-medium text-fd-muted-foreground"
              >
                {tag}
              </span>
            ))}
          </div>
          {example.github && (
            <a
              href={example.github}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-fd-muted-foreground hover:text-fd-foreground transition-colors shrink-0"
              onClick={(e) => e.stopPropagation()}
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
              </svg>
              GitHub
            </a>
          )}
        </div>
      </div>
    </article>
  );
}

export function ExamplesShowcase() {
  const [videoModalOpen, setVideoModalOpen] = useState(false);
  const [activeVideoUrl, setActiveVideoUrl] = useState("");
  const [activePosterUrl, setActivePosterUrl] = useState("");

  const openVideoModal = (videoUrl: string, posterUrl: string) => {
    setActiveVideoUrl(videoUrl);
    setActivePosterUrl(posterUrl);
    setVideoModalOpen(true);
  };

  return (
    <div className="w-full not-prose">
      {/* Video Modal */}
      <VideoModal
        isOpen={videoModalOpen}
        onClose={() => setVideoModalOpen(false)}
        videoUrl={activeVideoUrl}
        posterUrl={activePosterUrl}
      />

      {/* Hero Header */}
      <header className="relative mb-8 overflow-hidden rounded-2xl border border-fd-border">
        {/* Background layers */}
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-br from-fd-primary/[0.03] via-fd-background to-fd-primary/[0.06]" />
          <div
            className="absolute inset-0 opacity-[0.4] dark:opacity-[0.15]"
            style={{
              backgroundImage: `radial-gradient(circle at 1px 1px, currentColor 0.5px, transparent 0.5px)`,
              backgroundSize: "24px 24px",
              color: "var(--color-fd-muted-foreground)",
            }}
          />
          <div className="absolute -top-32 -right-32 h-64 w-64 rounded-full bg-fd-primary/10 blur-3xl" />
          <div className="absolute -bottom-32 -left-32 h-64 w-64 rounded-full bg-fd-primary/5 blur-3xl" />
        </div>

        {/* Content */}
        <div className="relative px-6 py-10 sm:px-8 sm:py-12 text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-fd-primary/10 border border-fd-primary/20 px-3 py-1 text-xs font-medium text-fd-primary mb-6">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-fd-primary opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-fd-primary" />
            </span>
            Real-world implementations
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-fd-foreground mb-4">
            Copilot Examples
          </h1>

          <p className="text-base sm:text-lg text-fd-muted-foreground max-w-2xl mx-auto leading-relaxed mb-6">
            Explore how teams are building AI-powered experiences with Copilot
            SDK. From customer support to developer tools.
          </p>

          <a
            href="https://github.com/YourGPT/copilot-sdk/tree/main/examples"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg bg-fd-secondary/80 border border-fd-border px-4 py-2 text-sm font-medium text-fd-foreground hover:bg-fd-secondary transition-colors"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
            </svg>
            View on GitHub
          </a>
        </div>
      </header>

      {/* Examples */}
      <div className="flex flex-col gap-4">
        {examples.map((example, index) => (
          <ExampleCard
            key={example.id}
            example={example}
            index={index}
            onPlayClick={() =>
              example.video && openVideoModal(example.video, example.preview)
            }
          />
        ))}
      </div>
    </div>
  );
}
