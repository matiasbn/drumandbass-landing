import { NextRequest, NextResponse } from 'next/server';
import { spotifyEmbed } from '@/src/lib/spotifyUrl';

// Lista los tracks de una URL de Spotify (artista/álbum/playlist) para armar una
// lista de reproductores embebidos por track.
//  - Con credenciales (SPOTIFY_CLIENT_ID/SECRET) usa la Web API → TODA la
//    discografía del artista (álbumes + singles).
//  - Sin credenciales, cae a parsear el __NEXT_DATA__ del embed → 10 top tracks.
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
  Accept: 'text/html',
};
const MAX_TRACKS = 60;

type Track = { id: string; title: string; subtitle: string; durationMs: number | null; previewUrl?: string | null; artwork?: string | null };

// Scrapea el preview MP3 de 30s de un track desde su página de embed (la API ya
// no entrega preview_url). Devuelve la URL o null.
async function scrapeTrackPreview(trackId: string): Promise<string | null> {
  try {
    const res = await fetch(`https://open.spotify.com/embed/track/${trackId}`, { headers: HEADERS, next: { revalidate: 86400 } });
    if (!res.ok) return null;
    const html = await res.text();
    const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
    if (!m) return null;
    const ap = findKey(JSON.parse(m[1]) as unknown, 'audioPreview') as { url?: string } | null;
    return ap && typeof ap.url === 'string' ? ap.url : null;
  } catch {
    return null;
  }
}

// Enriquece los tracks con su preview MP3 (scrape por track, concurrencia limitada).
async function enrichPreviews(tracks: Track[]): Promise<Track[]> {
  const queue = [...tracks];
  const out: Track[] = [];
  const worker = async () => {
    while (queue.length) {
      const t = queue.shift();
      if (!t) break;
      const preview = await scrapeTrackPreview(t.id);
      out.push({ ...t, previewUrl: preview });
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));
  // Mantener el orden original (por id).
  const order = new Map(tracks.map((t, i) => [t.id, i]));
  out.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  return out;
}

function findTrackList(o: unknown): Record<string, unknown>[] | null {
  if (!o || typeof o !== 'object') return null;
  const obj = o as Record<string, unknown>;
  if (Array.isArray(obj.trackList)) return obj.trackList as Record<string, unknown>[];
  for (const k of Object.keys(obj)) {
    const r = findTrackList(obj[k]);
    if (r) return r;
  }
  return null;
}

// Scrapea un track individual (título, artista, artwork y preview MP3) desde su
// embed. Lo usa el import masivo (fila por track) y el player para reproducir
// una URL de track suelta.
async function scrapeSingleTrack(trackId: string): Promise<Track | null> {
  try {
    const res = await fetch(`https://open.spotify.com/embed/track/${trackId}`, { headers: HEADERS, next: { revalidate: 86400 } });
    if (!res.ok) return null;
    const html = await res.text();
    const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
    if (!m) return null;
    const json = JSON.parse(m[1]) as unknown;
    const ap = findKey(json, 'audioPreview') as { url?: string } | null;
    const title = findKey(json, 'title');
    const subtitle = findKey(json, 'subtitle');
    const cover = findKey(json, 'coverArt') as { sources?: { url?: string }[] } | null;
    const artwork = cover?.sources?.[0]?.url || null;
    return {
      id: trackId,
      title: typeof title === 'string' ? title : '',
      subtitle: typeof subtitle === 'string' ? subtitle : '',
      durationMs: null,
      previewUrl: ap && typeof ap.url === 'string' ? ap.url : null,
      artwork,
    };
  } catch {
    return null;
  }
}

// Busca en profundidad la primera propiedad `key` del JSON.
function findKey(o: unknown, key: string): unknown {
  if (!o || typeof o !== 'object') return null;
  const obj = o as Record<string, unknown>;
  if (obj[key] !== undefined && obj[key] !== null) return obj[key];
  for (const k of Object.keys(obj)) {
    const r = findKey(obj[k], key);
    if (r !== null && r !== undefined) return r;
  }
  return null;
}

// ── Web API (Client Credentials) ─────────────────────────────────────────────
async function getToken(): Promise<string | null> {
  const id = process.env.SPOTIFY_CLIENT_ID;
  const secret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!id || !secret) return null;
  try {
    const res = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + Buffer.from(`${id}:${secret}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
      next: { revalidate: 3000 }, // el token dura 1h
    });
    if (!res.ok) return null;
    return (await res.json()).access_token || null;
  } catch {
    return null;
  }
}

async function allArtistTracksApi(artistId: string, token: string): Promise<Track[]> {
  const auth = { Authorization: `Bearer ${token}` };
  const albumIds: string[] = [];
  let next: string | null =
    `https://api.spotify.com/v1/artists/${artistId}/albums?include_groups=album,single&market=CL&limit=50`;
  while (next && albumIds.length < 80) {
    const r: Response = await fetch(next, { headers: auth });
    if (!r.ok) break;
    const d = await r.json();
    for (const a of d.items || []) if (a?.id) albumIds.push(a.id);
    next = d.next || null;
  }
  const uniq = [...new Set(albumIds)];
  const tracks: Track[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < uniq.length && tracks.length < MAX_TRACKS; i += 20) {
    const batch = uniq.slice(i, i + 20);
    const r = await fetch(`https://api.spotify.com/v1/albums?ids=${batch.join(',')}&market=CL`, { headers: auth });
    if (!r.ok) continue;
    const d = await r.json();
    for (const alb of d.albums || []) {
      const art = (alb?.images || [])[0]?.url || null;
      for (const t of alb?.tracks?.items || []) {
        const isHis = (t.artists || []).some((ar: { id: string }) => ar.id === artistId);
        if (isHis && t.id && !seen.has(t.id)) {
          seen.add(t.id);
          tracks.push({
            id: t.id,
            title: t.name || '',
            subtitle: (t.artists || []).map((a: { name: string }) => a.name).join(', '),
            durationMs: typeof t.duration_ms === 'number' ? t.duration_ms : null,
            artwork: art,
          });
        }
      }
    }
  }
  return tracks;
}

// ── Scrape del embed (fallback sin credenciales) ─────────────────────────────
async function scrapeTracks(embedSrc: string): Promise<Track[]> {
  const res = await fetch(embedSrc, { headers: HEADERS, next: { revalidate: 3600 } });
  if (!res.ok) return [];
  const html = await res.text();
  const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) return [];
  const tl = findTrackList(JSON.parse(m[1]) as unknown) || [];
  return tl
    .map((t) => {
      const uri = typeof t.uri === 'string' ? t.uri : '';
      const id = uri.startsWith('spotify:track:') ? uri.slice('spotify:track:'.length) : '';
      const ap = t.audioPreview as { url?: string } | undefined;
      return {
        id,
        title: typeof t.title === 'string' ? t.title : '',
        subtitle: typeof t.subtitle === 'string' ? t.subtitle : '',
        durationMs: typeof t.duration === 'number' ? t.duration : null,
        previewUrl: ap && typeof ap.url === 'string' ? ap.url : null,
      };
    })
    .filter((t) => t.id);
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url');
  if (!url) return NextResponse.json({ error: 'Falta el parámetro url' }, { status: 400 });
  const emb = spotifyEmbed(url);
  if (!emb) return NextResponse.json({ error: 'URL de Spotify inválida' }, { status: 400 });
  const id = emb.src.split('/').pop() || '';
  // preview=1 → fuerza el scrape (trae el MP3 de preview de 30s, que la API ya no
  // entrega) para reproducir en nuestro player propio.
  const forcePreview = req.nextUrl.searchParams.get('preview') === '1';

  try {
    // URL de un track suelto → devolver ese único track (con preview MP3).
    if (emb.type === 'track' && id) {
      const t = await scrapeSingleTrack(id);
      return NextResponse.json(
        { tracks: t ? [t] : [], source: 'track' },
        { headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800' } }
      );
    }
    if (emb.type === 'artist' && id) {
      const token = await getToken();
      if (token) {
        const apiTracks = await allArtistTracksApi(id, token);
        if (apiTracks.length) {
          // preview=1 → combinar: ids de la API + preview MP3 por scrape de cada
          // track → TODA la discografía, reproducible en nuestro player.
          if (forcePreview) {
            const enriched = (await enrichPreviews(apiTracks)).filter((t) => t.previewUrl);
            return NextResponse.json(
              { tracks: enriched, source: 'api+preview' },
              { headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800' } }
            );
          }
          return NextResponse.json(
            { tracks: apiTracks, source: 'api' },
            { headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' } }
          );
        }
      }
    }
    // Fallback: scrape del embed (10 top tracks, con preview).
    const tracks = await scrapeTracks(emb.src);
    return NextResponse.json(
      { tracks, source: 'scrape' },
      { headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' } }
    );
  } catch {
    return NextResponse.json({ error: 'Error al leer Spotify' }, { status: 500 });
  }
}
