// Helpers PUROS de URL de Beatport. Beatport está detrás de Cloudflare (JS
// challenge) y su API v4 exige OAuth aprobado, así que NO se puede scrapear ni
// reproducir en nuestro player propio. La única vía sin auth es su embed oficial
// (iframe), que se muestra en una sección propia del presskit.

// Tipos de URL de Beatport que reconocemos.
const BEATPORT_TYPES = ['track', 'release', 'chart', 'artist', 'label', 'playlist'];
// SOLO estos son embebibles en el widget oficial (embed.beatport.com). Las
// páginas de ARTISTA y LABEL NO tienen embed → el widget responde "that item
// can't be displayed". Para esas mostramos solo el botón/link a Beatport.
const BEATPORT_EMBEDDABLE = ['track', 'release', 'chart', 'playlist'];

export function isBeatportUrl(url: string): boolean {
  return /(?:^|\.)beatport\.com/i.test(url || '');
}

// Devuelve el tipo + id de una URL de Beatport (beatport.com/<tipo>/<slug>/<id>),
// o null si no se pudo resolver. NO decide si es embebible (ver beatportEmbed).
export function beatportParse(url: string): { type: string; id: string } | null {
  try {
    const u = new URL((url || '').startsWith('http') ? url : `https://${url}`);
    if (!/beatport\.com$/i.test(u.hostname.replace(/^www\./, ''))) return null;
    const seg = u.pathname.split('/').filter(Boolean);
    const type = (seg[0] || '').toLowerCase();
    const id = seg[seg.length - 1]; // el id numérico es el último tramo
    if (!BEATPORT_TYPES.includes(type) || !/^\d+$/.test(id || '')) return null;
    return { type, id };
  } catch {
    return null;
  }
}

// Datos del embed oficial SOLO si el tipo es embebible (track/release/chart/
// playlist). Para artista/label devuelve null (se muestra como link, no iframe).
export function beatportEmbed(url: string): { src: string; type: string; id: string } | null {
  const p = beatportParse(url);
  if (!p || !BEATPORT_EMBEDDABLE.includes(p.type)) return null;
  return { src: `https://embed.beatport.com/?id=${p.id}&type=${p.type}`, type: p.type, id: p.id };
}

// Alto del iframe según el tipo: artista/label/chart/playlist listan varios
// tracks (alto); track/release son compactos.
export function beatportEmbedHeight(type: string): number {
  return type === 'track' || type === 'release' ? 246 : 500;
}
