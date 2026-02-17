import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: {
    remotePatterns: [new URL('https://images.ctfassets.net/**')],
    formats: ['image/avif', 'image/webp'],
  },
};

export default nextConfig;
