import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  basePath: "/playground",
  allowedDevOrigins: ["*.trycloudflare.com"],
};

export default nextConfig;
