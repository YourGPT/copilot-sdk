import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  basePath: "/playground",
  allowedDevOrigins: ["*.trycloudflare.com"],
  transpilePackages: ["@yourgpt/copilot-sdk", "@yourgpt/llm-sdk"],
};

export default nextConfig;
