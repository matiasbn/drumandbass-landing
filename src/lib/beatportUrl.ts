// Helpers PUROS de URL de Beatport. Beatport está detrás de Cloudflare (JS
// challenge) y su API v4 exige OAuth aprobado, así que NO se puede scrapear ni
// reproducir en nuestro player propio. La única vía sin auth es su embed oficial
// (iframe), que se muestra en una sección propia del presskit.

const BEATPORT_TYPES = ['track', 'release', 'chart', 'artist', 'label', 'playlist'];

export function isBeatportUrl(url: string): boolean {
  return /(?:^|\.)beatport\.com/i.test(url || '');
}

// Convierte una URL de Beatport (artist/track/release/chart/label) a los datos
// de su embed oficial. Formato de URL: beatport.com/<tipo>/<slug>/<id>.
// Devuelve null si no se pudo resolver el tipo + id numérico.
export function beatportEmbed(url: string): { src: string; type: string; id: string } | null {
  try {
    const u = new URL((url || '').startsWith('http') ? url : `https://${url}`);
    if (!/beatport\.com$/i.test(u.hostname.replace(/^www\./, ''))) return null;
    const seg = u.pathname.split('/').filter(Boolean);
    const type = (seg[0] || '').toLowerCase();
    const id = seg[seg.length - 1]; // el id numérico es el último tramo
    if (!BEATPORT_TYPES.includes(type) || !/^\d+$/.test(id || '')) return null;
    return { src: `https://embed.beatport.com/?id=${id}&type=${type}`, type, id };
  } catch {
    return null;
  }
}

// Alto del iframe según el tipo: artista/label/chart/playlist listan varios
// tracks (alto); track/release son compactos.
export function beatportEmbedHeight(type: string): number {
  return type === 'track' || type === 'release' ? 246 : 500;
}
