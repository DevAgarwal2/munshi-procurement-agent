import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  experimental: {
    serverActions: {
      bodySizeLimit: "12mb",
    },
  },
};

export default nextConfig;
