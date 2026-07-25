// SoundCloud helpers. SoundCloud closed its public API years ago, so — like the
// presskit track import — we scrape. A track page embeds a `window.__sc_hydration`
// JSON array; the entry with `hydratable: "sound"` is THE track, and its
// `display_date` is the publication date SoundCloud shows. This is brittle by
// nature (depends on SoundCloud's HTML), so callers must tolerate a null return.

import { PresskitMix } from '@/src/types/presskit';

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
      const isFeaturedScRelease =
        !!m.featured && m.type === 'release' && isSoundcloudUrl(m.url);
      if (!isFeaturedScRelease) {
        return { ...m, featured: false };
      }
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
