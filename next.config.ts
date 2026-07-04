import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // firebase-admin pulls in jwks-rsa -> jose (ESM-only); without this,
  // Turbopack tries to bundle it for the API routes and the production
  // build fails with ERR_REQUIRE_ESM while collecting page data.
  serverExternalPackages: ["firebase-admin"],
  experimental: {
    // View Transitions API for page-to-page navigation (design plan D7).
    viewTransition: true,
  },
};

export default nextConfig;
