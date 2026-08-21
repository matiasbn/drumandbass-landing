'use client';

import { useEffect, useState } from 'react';

// Lista los top tracks de un artista de Spotify como una lista de reproductores
// embebidos compactos (uno por track). Alternativa al widget de artista, que es
// menos útil. Si no se pueden leer los tracks, cae al embed de artista.
export default function SpotifyArtistTracks({ url, fallbackEmbed }: { url: string; fallbackEmbed: string }) {
  const [tracks, setTracks] = useState<{ id: string; title: string }[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/pk/spotify?url=${encodeURIComponent(url)}`)
      .then((r) => (r.ok ? r.json() : { tracks: [] }))
      .then((d) => { if (!cancelled) setTracks(d.tracks || []); })
      .catch(() => { if (!cancelled) setTracks([]); });
    return () => { cancelled = true; };
  }, [url]);

  if (tracks === null) {
    return <div className="mono text-xs uppercase opacity-50 p-4 brutalist-border bg-white">Cargando tracks de Spotify…</div>;
  }
  if (!tracks.length) {
    // Fallback: el embed de artista (por si el scrape falla).
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
    <div className="space-y-2">
      {tracks.map((t) => (
        <iframe
          key={t.id}
          src={`https://open.spotify.com/embed/track/${t.id}`}
          className="w-full"
          height={80}
          style={{ border: 0, borderRadius: 12 }}
          loading="lazy"
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          title={t.title}
        />
      ))}
    </div>
  );
}
