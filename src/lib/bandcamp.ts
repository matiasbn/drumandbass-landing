// Scraping de la discografía de un artista de Bandcamp (para importar tracks al
// presskit igual que con SoundCloud). Bandcamp no tiene API pública abierta; la
// página `/music` del artista lista sus releases en un grid con título + href.
// Frágil (si Bandcamp cambia su HTML se reimplementa), zona gris de ToS — misma
// decisión asumida que con SoundCloud.

const BC_HEADERS = {
  Accept: 'text/html',
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
};

export interface BandcampRelease {
  id: string; // slug (/album/x o /track/x)
  title: string;
  url: string; // URL absoluta canónica
  isAlbum: boolean; // álbum/EP vs track suelto
}

export function isBandcampUrl(url: string): boolean {
  return /(^|\.)bandcamp\.com/i.test(url);
}

function decodeEntities(text: string): string {
  return text
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

// Normaliza cualquier URL de Bandcamp del artista a su origen (https://xxx.bandcamp.com).
function artistOrigin(url: string): string | null {
  try {
    const u = new URL(url.startsWith('http') ? url : `https://${url}`);
    if (!u.hostname.includes('bandcamp.com')) return null;
    return `${u.protocol}//${u.hostname}`;
  } catch {
    return null;
  }
}

// ── Resolución de streams / descarga (API mobile de Bandcamp) ────────────────
// Cada página de release expone su band_id + el id del tralbum (vía el embed
// oficial og:video). Con eso, la API mobile `tralbum_details` devuelve, por
// track, la URL de stream mp3-128 firmada, y a nivel de release si es descarga
// gratis. Frágil (scraping + endpoint no documentado), misma decisión asumida.

export interface BandcampTrack {
  title: string;
  streamUrl: string | null; // mp3-128 firmado (expira → re-resolver)
  durationMs: number | null;
  trackUrl: string | null; // URL pública del track
}

export interface BandcampTralbum {
  title: string;
  artist: string;
  isAlbum: boolean;
  downloadable: boolean; // descarga gratis (free download o name-your-price mínimo 0)
  artwork: string | null; // carátula (og:image de la página)
  tracks: BandcampTrack[];
}

interface TralbumIds {
  bandId: string;
  tralbumId: string;
  type: 't' | 'a';
  artwork: string | null;
}

async function fetchTralbumIds(url: string): Promise<TralbumIds | null> {
  const type: 't' | 'a' = /\/album\//i.test(url) ? 'a' : 't';
  let html: string;
  try {
    const res = await fetch(url, { headers: BC_HEADERS });
    if (!res.ok) return null;
    html = await res.text();
  } catch {
    return null;
  }
  // band_id: puede venir como "band_id":N o band_id=N según el elemento.
  const band = html.match(/(?:"band_id"\s*:\s*|band_id=)(\d+)/);
  // tralbum id: del embed oficial og:video → EmbeddedPlayer/…/track=N o album=N.
  const embed = html.match(/EmbeddedPlayer\/[^"']*\b(?:track|album)=(\d+)/);
  if (!band || !embed) return null;
  const art = html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/i);
  return { bandId: band[1], tralbumId: embed[1], type, artwork: art ? art[1] : null };
}

function downloadableFromTralbum(d: Record<string, unknown>): boolean {
  if (d.free_download === true) return true;
  // name-your-price con mínimo 0 = descargable gratis.
  const min = d.minimum_price;
  if (typeof min === 'number' && min === 0 && d.is_purchasable === true) return true;
  return false;
}

export async function resolveBandcampTralbum(url: string): Promise<BandcampTralbum | null> {
  const ids = await fetchTralbumIds(url);
  if (!ids) return null;
  const api =
    `https://bandcamp.com/api/mobile/25/tralbum_details` +
    `?band_id=${ids.bandId}&tralbum_type=${ids.type}&tralbum_id=${ids.tralbumId}`;
  let d: Record<string, unknown>;
  try {
    const res = await fetch(api, { headers: BC_HEADERS });
    if (!res.ok) return null;
    d = (await res.json()) as Record<string, unknown>;
    if (d.error) return null;
  } catch {
    return null;
  }
  const rawTracks = Array.isArray(d.tracks) ? (d.tracks as Record<string, unknown>[]) : [];
  // El artista viene por track (band_name); el tralbum a veces no lo trae.
  const firstBand = rawTracks.find((t) => typeof t.band_name === 'string')?.band_name as string | undefined;
  const artist = (typeof d.band_name === 'string' && d.band_name) || firstBand || (typeof d.artist === 'string' ? d.artist : '') || '';
  const tracks: BandcampTrack[] = rawTracks.map((t) => {
    const su = (t.streaming_url as Record<string, string> | undefined) || {};
    const dur = typeof t.duration === 'number' ? Math.round(t.duration * 1000) : null;
    // track_url es la URL REAL y absoluta de cada track (incluso dentro de un álbum).
    return {
      title: typeof t.title === 'string' ? t.title : '',
      streamUrl: su['mp3-128'] || null,
      durationMs: dur,
      trackUrl: typeof t.track_url === 'string' ? t.track_url : null,
    };
  });
  return {
    title: typeof d.title === 'string' ? d.title : '',
    artist,
    isAlbum: ids.type === 'a',
    downloadable: downloadableFromTralbum(d),
    artwork: ids.artwork,
    tracks,
  };
}

export async function fetchBandcampDiscography(inputUrl: string): Promise<BandcampRelease[]> {
  const origin = artistOrigin(inputUrl);
  if (!origin) return [];

  let html: string;
  try {
    const res = await fetch(`${origin}/music`, { headers: BC_HEADERS });
    if (!res.ok) return [];
    html = await res.text();
  } catch {
    return [];
  }

  // Cada release es un <li class="music-grid-item …"> con un <a href="/album|/track/…">
  // y un <p class="title"> con el título (el nombre del artista va en un <span> aparte).
  const out: BandcampRelease[] = [];
  const seen = new Set<string>();
  const itemRe = /<li[^>]*class="[^"]*music-grid-item[^"]*"[^>]*>([\s\S]*?)<\/li>/g;
  let m: RegExpExecArray | null;
  while ((m = itemRe.exec(html)) !== null) {
    const block = m[1];
    const href = block.match(/href="(\/(?:album|track)\/[^"]+)"/);
    const titleBlock = block.match(/<p class="title">([\s\S]*?)<\/p>/);
    if (!href) continue;
    const slug = href[1];
    if (seen.has(slug)) continue;
    seen.add(slug);
    const rawTitle = titleBlock ? titleBlock[1].split('<span')[0] : slug;
    const title = decodeEntities(rawTitle.replace(/<[^>]+>/g, '')).trim();
    out.push({ id: slug, title: title || slug, url: `${origin}${slug}`, isAlbum: slug.startsWith('/album/') });
  }

  // Fallback si el markup del grid cambió: parear hrefs con títulos por orden.
  if (out.length === 0) {
    const pairRe = /href="(\/(?:album|track)\/[^"]+)"[^>]*>[\s\S]*?<p class="title">([\s\S]*?)<\/p>/g;
    let p: RegExpExecArray | null;
    while ((p = pairRe.exec(html)) !== null) {
      const slug = p[1];
      if (seen.has(slug)) continue;
      seen.add(slug);
      const title = decodeEntities(p[2].split('<span')[0].replace(/<[^>]+>/g, '')).trim();
      out.push({ id: slug, title: title || slug, url: `${origin}${slug}`, isAlbum: slug.startsWith('/album/') });
    }
  }

  return out;
}
