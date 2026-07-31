import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Both HeyGen SDK packages are ESM; Next.js webpack needs to transpile them
  transpilePackages: [
    "@heygen/liveavatar-web-sdk",
    "@heygen/streaming-avatar",
  ],
  images: {
    qualities: [75, 100],
  },
  turbopack: {
    root: process.cwd(),
  },
  async redirects() {
    return [
      {
        source: "/froyd",
        destination: "/",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
