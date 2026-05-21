import type { NextConfig } from "next";

const fastApiBaseUrl =
  process.env.FASTAPI_BASE_URL ??
  (process.env.FASTAPI_HOSTPORT ? `http://${process.env.FASTAPI_HOSTPORT}` : "http://127.0.0.1:8000");

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/fastapi/:path*",
        destination: `${fastApiBaseUrl}/:path*`,
      },
    ];
  },
};

export default nextConfig;
