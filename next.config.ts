import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Both HeyGen SDK packages are ESM; Next.js webpack needs to transpile them
  transpilePackages: [
    "@heygen/liveavatar-web-sdk",
    "@heygen/streaming-avatar",
  ],
};

export default nextConfig;
