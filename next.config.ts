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
  async headers() {
    // Belt-and-suspenders noindex for crawlers that ignore robots.txt / meta.
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "X-Robots-Tag",
            value: "noindex, nofollow, noarchive",
          },
          {
            // Explicitly allow mic for this origin (some Safari builds are strict).
            key: "Permissions-Policy",
            value: "microphone=(self)",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
