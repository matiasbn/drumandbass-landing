'use client';

import { useEffect, useState } from 'react';
import { RiLoader4Line } from '@remixicon/react';
import ReleasesPlayer from '@/src/components/ReleasesPlayer';
import type { NationalRelease } from '@/src/lib/nationalReleases';

type SpTrack = { id: string; title: string; subtitle: string; previewUrl?: string | null; artwork?: string | null };

// Trae la discografía de Spotify del artista (API + preview MP3 por scrape) y la
// reproduce en NUESTRO player (previews de 30s), en vez del widget de Spotify.
export default function SpotifyReleasesPlayer({
  artistUrl,
  artistName,
  slug,
  fallbackEmbed,
}: {
  artistUrl: string;
  artistName: string;
  slug: string | null;
  fallbackEmbed: string;
}) {
  const [releases, setReleases] = useState<NationalRelease[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/pk/spotify?preview=1&url=${encodeURIComponent(artistUrl)}`)
      .then((r) => (r.ok ? r.json() : { tracks: [] }))
      .then((d) => {
        if (cancelled) return;
        const rel: NationalRelease[] = ((d.tracks || []) as SpTrack[])
          .filter((t) => t.previewUrl && t.id)
          .map((t) => ({
            title: t.title,
            url: `https://open.spotify.com/track/${t.id}`,
            artistName: t.subtitle || artistName,
            slug,
            releasedAt: null,
            downloadable: false,
            downloadUrl: null,
            isEp: false,
            kind: 'release' as const,
            streamUrl: t.previewUrl ?? null,
            artwork: t.artwork ?? null,
          }));
        setReleases(rel);
      })
      .catch(() => { if (!cancelled) setReleases([]); });
    return () => { cancelled = true; };
  }, [artistUrl, artistName, slug]);

  if (releases === null) {
    return (
      <div className="mono text-xs uppercase opacity-60 p-4 brutalist-border bg-white inline-flex items-center gap-2">
        <RiLoader4Line className="w-4 h-4 animate-spin" /> Cargando Spotify…
      </div>
    );
  }
  if (!releases.length) {
    // Fallback: el embed de artista (por si no hay previews).
    return (
      <iframe
        src={fallbackEmbed}
        className="w-full"
        height={352}
        style={{ border: 0, borderRadius: 12 }}
        loading="lazy"
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
        title="Spotify"
      />
    );
  }
  return (
    <>
      <ReleasesPlayer releases={releases} hideArtistFilter />
      <p className="mono text-[11px] uppercase opacity-50 mt-2">Previews de 30 s vía Spotify — escúchalo completo en Spotify.</p>
    </>
  );
}
