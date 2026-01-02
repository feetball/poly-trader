import type { NextConfig } from "next";
import packageJson from "./package.json";

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_APP_VERSION: packageJson.version,
  },
  async rewrites() {
    // Proxy API calls through Next.js so the browser can always use same-origin `/api/*`.
    // In docker-compose, `bot` resolves to the API container on the shared network.
    const target = process.env.API_PROXY_TARGET || "http://bot:3030";
    return [
      {
        source: "/api/:path*",
        destination: `${target}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
