import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@yourgpt/copilot-sdk", "@yourgpt/llm-sdk"],
};

export default nextConfig;
