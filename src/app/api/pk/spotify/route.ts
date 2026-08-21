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

type Track = { id: string; title: string; subtitle: string; durationMs: number | null };

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
      for (const t of alb?.tracks?.items || []) {
        const isHis = (t.artists || []).some((ar: { id: string }) => ar.id === artistId);
        if (isHis && t.id && !seen.has(t.id)) {
          seen.add(t.id);
          tracks.push({
            id: t.id,
            title: t.name || '',
            subtitle: (t.artists || []).map((a: { name: string }) => a.name).join(', '),
            durationMs: typeof t.duration_ms === 'number' ? t.duration_ms : null,
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
      return {
        id,
        title: typeof t.title === 'string' ? t.title : '',
        subtitle: typeof t.subtitle === 'string' ? t.subtitle : '',
        durationMs: typeof t.duration === 'number' ? t.duration : null,
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

  try {
    // Artista + credenciales → discografía completa vía API.
    if (emb.type === 'artist' && id) {
      const token = await getToken();
      if (token) {
        const tracks = await allArtistTracksApi(id, token);
        if (tracks.length) {
          return NextResponse.json(
            { tracks, source: 'api' },
            { headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' } }
          );
        }
      }
    }
    // Fallback: scrape del embed (10 top tracks).
    const tracks = await scrapeTracks(emb.src);
    return NextResponse.json(
      { tracks, source: 'scrape' },
      { headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' } }
    );
  } catch {
    return NextResponse.json({ error: 'Error al leer Spotify' }, { status: 500 });
  }
}
