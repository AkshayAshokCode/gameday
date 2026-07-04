import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // View Transitions API for page-to-page navigation (design plan D7).
    viewTransition: true,
  },
};

export default nextConfig;
