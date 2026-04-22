import { createMDX } from "fumadocs-mdx/next";

// Playground deployment URL - update this after deploying the playground
const PLAYGROUND_URL = process.env.PLAYGROUND_URL || "https://copilot-playground-git-delta4-infotech.vercel.app";

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  async redirects() {
    return [
      // ── Legacy / renamed routes ──────────────────────────────────────────
      {
        source: "/docs/quickstart",
        destination: "/docs/getting-started",
        permanent: true,
      },
      {
        source: "/docs/multimodal",
        destination: "/docs/chat/attachments",
        permanent: true,
      },
      {
        source: "/docs/attachments",
        destination: "/docs/chat/attachments",
        permanent: true,
      },
      {
        source: "/docs/chat-history",
        destination: "/docs/chat/storage/chat-history",
        permanent: true,
      },
      {
        source: "/docs/smart-ai-context",
        destination: "/docs/skills",
        permanent: true,
      },
      {
        source: "/docs/ai-context",
        destination: "/docs/skills",
        permanent: true,
      },
      {
        source: "/docs/custom-tools",
        destination: "/docs/tools/frontend-tools",
        permanent: true,
      },
      {
        source: "/docs/streaming",
        destination: "/docs/llm-sdk/stream-text",
        permanent: true,
      },
      {
        source: "/docs/ai-response-control",
        destination: "/docs/tools/agentic-loop",
        permanent: true,
      },
      {
        source: "/docs/tool-approval",
        destination: "/docs/tools/frontend-tools",
        permanent: true,
      },
      {
        source: "/docs/tools/screenshot",
        destination: "/docs/tools/built-in/screenshot",
        permanent: true,
      },
      // ── context/ → advanced/ ─────────────────────────────────────────────
      {
        source: "/docs/context",
        destination: "/docs/advanced",
        permanent: true,
      },
      {
        source: "/docs/context/compaction",
        destination: "/docs/advanced/compaction",
        permanent: true,
      },
      {
        source: "/docs/context/token-tracking",
        destination: "/docs/advanced/token-tracking",
        permanent: true,
      },
      {
        source: "/docs/context/session",
        destination: "/docs/chat/storage/session",
        permanent: true,
      },
      // ── tools subpages removed ───────────────────────────────────────────
      {
        source: "/docs/tools/deferred-tools",
        destination: "/docs/tools",
        permanent: true,
      },
      {
        source: "/docs/tools/hidden-tools",
        destination: "/docs/tools",
        permanent: true,
      },
      // ── chat/* pages moved (our restructuring) ───────────────────────────
      {
        source: "/docs/chat/generative-ui",
        destination: "/docs/generative-ui",
        permanent: true,
      },
      {
        source: "/docs/chat/branching",
        destination: "/docs/advanced/branching",
        permanent: true,
      },
      {
        source: "/docs/chat/message-actions",
        destination: "/docs/chat/ui",
        permanent: true,
      },
    ];
  },
  async rewrites() {
    return [
      // Playground proxy
      {
        source: "/playground",
        destination: `${PLAYGROUND_URL}/playground`,
      },
      {
        source: "/playground/:path*",
        destination: `${PLAYGROUND_URL}/playground/:path*`,
      },
      // MDX route for LLM features (e.g., /docs/quickstart.mdx -> /llms.mdx/docs/quickstart)
      {
        source: "/docs/:path*.mdx",
        destination: "/llms.mdx/docs/:path*",
      },
    ];
  },
};

const withMDX = createMDX({});

export default withMDX(config);
