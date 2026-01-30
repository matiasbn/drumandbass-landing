import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [new URL('https://images.ctfassets.net/**')],
  },
};

export default nextConfig;
