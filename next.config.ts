import type { NextConfig } from "next";

// Host de Supabase Storage (bucket público 'flyers' del CMS propio). Único
// host remoto de imágenes: los flyers migrados de Contentful ya viven en el
// bucket (scripts/migrate-contentful.mjs), así que ctfassets no se permite.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: {
    remotePatterns: supabaseUrl
      ? [new URL(`${supabaseUrl}/storage/v1/object/public/**`)]
      : [],
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
