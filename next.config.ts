import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: {
    remotePatterns: [new URL('https://images.ctfassets.net/**')],
    formats: ['image/avif', 'image/webp'],
  },
  async rewrites() {
    return [
      {
        source: '/artistas/:slug',
        destination: '/pk/:slug',
      },
    ];
  },
};

export default nextConfig;
