import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Permite buildear en una carpeta aparte (NEXT_BUILD_DIR=.next-release) para no
  // interrumpir un `next dev` que use `.next`. Sin la env var, usa `.next` normal.
  distDir: process.env.NEXT_BUILD_DIR || '.next',
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
