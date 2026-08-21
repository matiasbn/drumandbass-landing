// SoundCloud helpers. SoundCloud closed its public API years ago, so — like the
// presskit track import — we scrape. A track page embeds a `window.__sc_hydration`
// JSON array; the entry with `hydratable: "sound"` is THE track, and its
// `display_date` is the publication date SoundCloud shows. This is brittle by
// nature (depends on SoundCloud's HTML), so callers must tolerate a null return.

import { PresskitMix } from '@/src/types/presskit';
import { isBandcampUrl } from '@/src/lib/bandcamp';
import { isSpotifyUrl } from '@/src/lib/spotifyUrl';

const SC_DESKTOP_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

export function isSoundcloudUrl(url: string): boolean {
  try {
    return new URL(url).hostname.includes('soundcloud.com');
  } catch {
    return false;
  }
}

export interface SoundcloudTrackMeta {
  releasedAt: string | null;
  downloadable: boolean | null; // null = no se pudo determinar
  downloadUrl: string | null; // gate externo (Hypeddit, etc.) si la descarga no es nativa
  isEp: boolean | null; // true = es un EP/álbum (playlist), no un track suelto
  canonicalUrl: string | null; // URL canónica soundcloud.com/user/slug (normaliza links cortos)
}

// SoundCloud tiene DOS formas de descarga: la nativa (`downloadable`, botón de
// descarga propio) y el "buy/download" que enlaza a un gate externo
// (`purchase_url`, típico de Hypeddit — la mayoría de los DnB usan este). El
// título del botón ("download!", "free download") distingue una descarga de una
// compra ("Buy on Beatport").
function isDownloadTitle(title?: string | null): boolean {
  return !!title && /download|descarga|free|gratis|\bdl\b|bajar/i.test(title);
}

function computeDownload(d: {
  downloadable?: boolean;
  purchase_url?: string | null;
  purchase_title?: string | null;
}): { downloadable: boolean; downloadUrl: string | null } {
  if (d.downloadable === true) return { downloadable: true, downloadUrl: null }; // nativa → página de SC
  if (d.purchase_url && isDownloadTitle(d.purchase_title)) {
    return { downloadable: true, downloadUrl: d.purchase_url };
  }
  return { downloadable: false, downloadUrl: null };
}

/**
 * Scrapea la página de un track/EP de SoundCloud y devuelve su fecha de
 * publicación (display_date) y si es descargable (flag nativo `downloadable`).
 * Ambos pueden venir null si el fetch falla o no se puede parsear la hydration.
 */
export async function fetchSoundcloudTrackMeta(url: string): Promise<SoundcloudTrackMeta> {
  const empty: SoundcloudTrackMeta = {
    releasedAt: null, downloadable: null, downloadUrl: null, isEp: null, canonicalUrl: null,
  };
  if (!isSoundcloudUrl(url)) return empty;

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': SC_DESKTOP_UA, Accept: 'text/html' },
    });
    if (!res.ok) return empty;
    const html = await res.text();

    const match = html.match(/window\.__sc_hydration\s*=\s*(\[[\s\S]*?\]);/);
    if (!match) return empty;

    const hydration = JSON.parse(match[1]) as Array<{
      hydratable?: string;
      data?: {
        display_date?: string;
        created_at?: string;
        downloadable?: boolean;
        purchase_url?: string | null;
        purchase_title?: string | null;
        permalink_url?: string;
      };
    }>;

    // Un track es `hydratable: "sound"`; un EP/álbum es `"playlist"`. Ambos
    // traen display_date/created_at, así que aceptamos cualquiera de los dos.
    const sound = hydration.find((h) => h.hydratable === 'sound');
    const playlist = hydration.find((h) => h.hydratable === 'playlist');
    const item = sound || playlist;
    if (!item?.data) return empty;
    // La descarga (nativa o vía gate) solo tiene sentido para un track suelto;
    // un EP/playlist no expone estos campos → queda no descargable.
    const dl = sound ? computeDownload(item.data) : { downloadable: false, downloadUrl: null };
    return {
      releasedAt: item.data.display_date || item.data.created_at || null,
      downloadable: dl.downloadable,
      downloadUrl: dl.downloadUrl,
      isEp: !sound && !!playlist,
      // permalink_url es la URL canónica; normaliza links cortos (on.soundcloud.com).
      canonicalUrl: item.data.permalink_url || null,
    };
  } catch {
    return empty;
  }
}

/**
 * Solo la fecha de publicación (compat). Ver fetchSoundcloudTrackMeta.
 */
export async function fetchSoundcloudDisplayDate(url: string): Promise<string | null> {
  return (await fetchSoundcloudTrackMeta(url)).releasedAt;
}

export interface SoundcloudSetTrack {
  title: string;
  url: string;
  downloadable: boolean;
  downloadUrl: string | null;
  durationMs: number | null;
}

export interface SoundcloudSet {
  title: string;
  setType: string | null; // "album" | "ep" | "playlist" | "" — pista, no confiable
  isAlbum: boolean;
  tracks: SoundcloudSetTrack[];
}

/**
 * Lista los tracks de un EP/set de SoundCloud (para la vista anidada del
 * reproductor). Devuelve null si la URL no es de SoundCloud, no es un set, o no
 * se pudo parsear.
 */
export async function fetchSoundcloudSetTracks(url: string): Promise<SoundcloudSet | null> {
  if (!isSoundcloudUrl(url)) return null;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': SC_DESKTOP_UA, Accept: 'text/html' },
    });
    if (!res.ok) return null;
    const html = await res.text();
    const match = html.match(/window\.__sc_hydration\s*=\s*(\[[\s\S]*?\]);/);
    if (!match) return null;

    const hydration = JSON.parse(match[1]) as Array<{
      hydratable?: string;
      data?: {
        title?: string;
        set_type?: string;
        is_album?: boolean;
        tracks?: Array<{
          title?: string;
          permalink_url?: string;
          downloadable?: boolean;
          purchase_url?: string | null;
          purchase_title?: string | null;
          duration?: number;
        }>;
      };
    }>;

    const pl = hydration.find((h) => h.hydratable === 'playlist');
    if (!pl?.data) return null;

    const tracks: SoundcloudSetTrack[] = (pl.data.tracks || [])
      .filter((t) => t.permalink_url && t.title)
      .map((t) => {
        const dl = computeDownload(t);
        return {
          title: t.title as string,
          url: t.permalink_url as string,
          downloadable: dl.downloadable,
          downloadUrl: dl.downloadUrl,
          durationMs: typeof t.duration === 'number' ? t.duration : null,
        };
      });

    return {
      title: pl.data.title || '',
      setType: pl.data.set_type ?? null,
      isAlbum: pl.data.is_album === true,
      tracks,
    };
  } catch {
    return null;
  }
}

/**
 * Captura desde SoundCloud la fecha de publicación (display_date) y si el
 * release es descargable, para los releases marcados como "featured". Solo
 * aplica a releases de SoundCloud; el resto se fuerza a `featured: false` (no
 * deben figurar en Releases Nacionales).
 *
 * `force`: si es true, re-scrapea aunque ya tenga los datos (para corregir
 * fechas viejas o completar `downloadable`). Por defecto solo scrapea cuando
 * falta la fecha o el flag de descarga.
 */
export async function enrichFeaturedReleaseDates(
  mixes: PresskitMix[],
  force = false
): Promise<PresskitMix[]> {
  return Promise.all(
    mixes.map(async (m) => {
      // Un release puede publicarse en Releases Nacionales si es de SoundCloud,
      // Bandcamp o Spotify (el reproductor de /releases soporta los tres).
      const isFeaturedRelease =
        !!m.featured && m.type === 'release' &&
        (isSoundcloudUrl(m.url) || isBandcampUrl(m.url) || isSpotifyUrl(m.url));
      if (!isFeaturedRelease) {
        return { ...m, featured: false };
      }
      // La fecha se scrapea solo de SoundCloud; para Bandcamp/Spotify conservamos
      // el featured tal cual (Spotify reproduce el preview de 30s en /releases).
      if (!isSoundcloudUrl(m.url)) return m;
      const isShortLink = /on\.soundcloud\.com/i.test(m.url);
      const needs =
        !m.released_at ||
        typeof m.is_ep !== 'boolean' ||
        isShortLink; // link corto → resolver a la canónica
      if (!needs && !force) return m; // ya tiene fecha y tipo
      const meta = await fetchSoundcloudTrackMeta(m.url);
      // La descarga NO se guarda en DB (se lee en vivo); solo fecha, tipo y URL.
      // Si el scrapeo falla, conserva lo que hubiera (no pisar con null).
      return {
        ...m,
        // Normaliza a la URL canónica (soundcloud.com/user/slug) cuando se pudo leer.
        url: meta.canonicalUrl || m.url,
        released_at: meta.releasedAt ?? m.released_at ?? null,
        is_ep: meta.isEp ?? m.is_ep ?? false,
      };
    })
  );
}

// ── Stream propio (reproductor nativo) ───────────────────────────────────────
// Reproducimos con un <audio> nuestro en vez del widget de SoundCloud, para
// tener la mejor UX (controles nativos del celular, auto-avance, sin gate). Esto
// resuelve la URL de audio real de un track: saca el `client_id` del JS de
// SoundCloud (cacheado, se refresca si expira) y resuelve el transcoding
// progresivo (MP3). Es frágil por naturaleza (depende de la web de SoundCloud);
// si cambia, se reimplementa. Solo devuelve datos públicos.

let cachedClientId: string | null = null;

async function scrapeClientId(): Promise<string | null> {
  try {
    const res = await fetch('https://soundcloud.com/discover', {
      headers: { 'User-Agent': SC_DESKTOP_UA, Accept: 'text/html' },
    });
    if (!res.ok) return null;
    const html = await res.text();
    const scripts = [...html.matchAll(/src="(https:\/\/[^"']*sndcdn[^"']*\.js)"/g)].map((m) => m[1]);
    // El client_id suele estar en uno de los últimos bundles.
    for (const src of scripts.reverse()) {
      try {
        const jt = await (await fetch(src, { headers: { 'User-Agent': SC_DESKTOP_UA } })).text();
        const m = jt.match(/client_id\s*[:=]\s*"([a-zA-Z0-9]{20,})"/);
        if (m) return m[1];
      } catch {
        // siguiente script
      }
    }
    return null;
  } catch {
    return null;
  }
}

async function getClientId(force = false): Promise<string | null> {
  if (cachedClientId && !force) return cachedClientId;
  cachedClientId = await scrapeClientId();
  return cachedClientId;
}

// Lista TODA la discografía de un usuario vía la API de SoundCloud (api-v2) con el
// client_id scrapeado. El HTML móvil solo embebe ~10 tracks (los recientes); la
// API pagina y trae todos. Devuelve tracks sueltos + playlists (EPs/sets). null si
// no se pudo (client_id/rotación) → el caller cae al scrape del HTML.
export interface SoundcloudUserTrack {
  id: string;
  title: string;
  url: string;
}

const SC_API = 'https://api-v2.soundcloud.com';

async function resolveScUserId(profileUrl: string, cid: string): Promise<number | 'refresh' | null> {
  const r = await fetch(`${SC_API}/resolve?url=${encodeURIComponent(profileUrl)}&client_id=${cid}`, {
    headers: { 'User-Agent': SC_DESKTOP_UA },
  });
  if (r.status === 401 || r.status === 403) return 'refresh';
  if (!r.ok) return null;
  const u = (await r.json()) as { id?: number; kind?: string };
  return u?.kind === 'user' && typeof u.id === 'number' ? u.id : null;
}

async function fetchScCollection(
  path: string,
  cid: string
): Promise<{ title?: string; permalink_url?: string }[]> {
  const out: { title?: string; permalink_url?: string }[] = [];
  let next: string | null = `${SC_API}${path}?client_id=${cid}&limit=200&linked_partitioning=1`;
  let guard = 0;
  while (next && guard++ < 12) {
    const r: Response = await fetch(next, { headers: { 'User-Agent': SC_DESKTOP_UA } });
    if (!r.ok) break;
    const data = (await r.json()) as {
      collection?: { title?: string; permalink_url?: string }[];
      next_href?: string | null;
    };
    if (data.collection) out.push(...data.collection);
    next = data.next_href
      ? data.next_href.includes('client_id=')
        ? data.next_href
        : `${data.next_href}&client_id=${cid}`
      : null;
  }
  return out;
}

export async function fetchSoundcloudUserTracks(profileUrl: string): Promise<SoundcloudUserTrack[] | null> {
  let cid = await getClientId();
  if (!cid) return null;
  let userId = await resolveScUserId(profileUrl, cid);
  if (userId === 'refresh') {
    cid = await getClientId(true);
    if (!cid) return null;
    userId = await resolveScUserId(profileUrl, cid);
  }
  if (typeof userId !== 'number') return null;

  try {
    const [tracks, playlists] = await Promise.all([
      fetchScCollection(`/users/${userId}/tracks`, cid),
      fetchScCollection(`/users/${userId}/playlists`, cid),
    ]);
    const out: SoundcloudUserTrack[] = [];
    const seen = new Set<string>();
    for (const t of [...tracks, ...playlists]) {
      const url = t.permalink_url;
      if (!url || !t.title || seen.has(url)) continue;
      seen.add(url);
      out.push({ id: url.split('/').filter(Boolean).slice(-1)[0] || url, title: t.title, url });
    }
    return out;
  } catch {
    return null;
  }
}

export interface SoundcloudStream {
  streamUrl: string;
  protocol: 'progressive' | 'hls';
  title: string;
  artist: string;
  artwork: string | null;
  durationMs: number | null;
  permalinkUrl: string | null;
}

interface Transcoding {
  url?: string;
  format?: { protocol?: string; mime_type?: string };
}

/**
 * Resuelve la URL de audio real de un track de SoundCloud para reproducir con un
 * <audio> propio. Prefiere MP3 progresivo (funciona en todos lados); si solo hay
 * HLS, lo devuelve igual (Safari/iOS lo reproduce nativo). Null si falla.
 */
export async function resolveSoundcloudStream(url: string): Promise<SoundcloudStream | null> {
  if (!isSoundcloudUrl(url)) return null;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': SC_DESKTOP_UA, Accept: 'text/html' } });
    if (!res.ok) return null;
    const html = await res.text();
    const match = html.match(/window\.__sc_hydration\s*=\s*(\[[\s\S]*?\]);/);
    if (!match) return null;
    const hydration = JSON.parse(match[1]) as Array<{
      hydratable?: string;
      data?: {
        title?: string;
        permalink_url?: string;
        artwork_url?: string | null;
        duration?: number;
        user?: { username?: string; avatar_url?: string | null };
        media?: { transcodings?: Transcoding[] };
      };
    }>;
    const sound = hydration.find((h) => h.hydratable === 'sound');
    const d = sound?.data;
    const transcodings = d?.media?.transcodings || [];
    const chosen =
      transcodings.find((t) => t.format?.protocol === 'progressive') ||
      transcodings.find((t) => t.format?.protocol === 'hls');
    if (!d || !chosen?.url) return null;

    const resolveWith = async (cid: string) => {
      const r = await fetch(`${chosen.url}?client_id=${cid}`, { headers: { 'User-Agent': SC_DESKTOP_UA } });
      return r;
    };
    let cid = await getClientId();
    if (!cid) return null;
    let r = await resolveWith(cid);
    if (r.status === 401 || r.status === 403) {
      // client_id expirado/rotado → refrescar y reintentar una vez.
      cid = await getClientId(true);
      if (!cid) return null;
      r = await resolveWith(cid);
    }
    if (!r.ok) return null;
    const j = (await r.json()) as { url?: string };
    if (!j.url) return null;

    return {
      streamUrl: j.url,
      protocol: chosen.format?.protocol === 'hls' ? 'hls' : 'progressive',
      title: d.title || '',
      artist: d.user?.username || '',
      artwork: d.artwork_url || d.user?.avatar_url || null,
      durationMs: typeof d.duration === 'number' ? d.duration : null,
      permalinkUrl: d.permalink_url || null,
    };
  } catch {
    return null;
  }
}
