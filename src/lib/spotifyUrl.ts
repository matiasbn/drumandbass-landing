// Helpers PUROS de URL de Spotify: detectar y convertir a URL de embed, para
// incrustar tracks/álbumes/playlists/artistas de Spotify en el presskit.
// Spotify no permite reproducir el audio completo fuera de su reproductor, así
// que se muestra su embed oficial (previews de 30s / completo con Premium).

const SPOTIFY_TYPES = ['track', 'album', 'playlist', 'artist', 'episode', 'show'];

export function isSpotifyUrl(url: string): boolean {
  return /open\.spotify\.com|(?:^|\.)spotify\.com/i.test(url || '');
}

// Convierte una URL de Spotify (con o sin prefijo de locale intl-xx / query ?si=)
// a { src: URL de embed, type }. Devuelve null si no se pudo resolver.
export function spotifyEmbed(url: string): { src: string; type: string } | null {
  try {
    const u = new URL((url || '').startsWith('http') ? url : `https://${url}`);
    if (!/spotify\.com$/i.test(u.hostname.replace(/^www\./, ''))) return null;
    const seg = u.pathname.split('/').filter(Boolean);
    // Salta el prefijo de idioma (p.ej. /intl-es/track/…).
    const start = /^intl-/i.test(seg[0] || '') ? 1 : 0;
    const type = (seg[start] || '').toLowerCase();
    const id = seg[start + 1];
    if (!SPOTIFY_TYPES.includes(type) || !id) return null;
    return { src: `https://open.spotify.com/embed/${type}/${id}`, type };
  } catch {
    return null;
  }
}
