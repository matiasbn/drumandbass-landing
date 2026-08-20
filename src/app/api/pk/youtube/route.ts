import { NextRequest, NextResponse } from 'next/server';

// Import de YouTube para el presskit: acepta URL de video, playlist o canal
// (@handle / channel/ID / c/nombre / user/nombre) y devuelve ítems {id,title,url}
// con el título traído de la API de YouTube (YOUTUBE_API_KEY). Los sets de
// YouTube se muestran EMBEBIDOS en el presskit (no en el reproductor de audio).
const API = 'https://www.googleapis.com/youtube/v3';

type YtItem = { id: string; title: string; url: string };

type Parsed =
  | { kind: 'video'; id: string }
  | { kind: 'playlist'; id: string }
  | { kind: 'handle'; handle: string }
  | { kind: 'channelId'; id: string }
  | { kind: 'customName'; name: string }
  | null;

function parseYt(raw: string): Parsed {
  try {
    const u = new URL(raw.startsWith('http') ? raw : `https://${raw}`);
    const host = u.hostname.replace(/^www\./, '');
    if (host === 'youtu.be') {
      const id = u.pathname.slice(1).split('/')[0];
      return id ? { kind: 'video', id } : null;
    }
    if (!host.endsWith('youtube.com')) return null;
    if (u.pathname === '/watch') {
      const id = u.searchParams.get('v');
      return id ? { kind: 'video', id } : null;
    }
    if (u.pathname === '/playlist') {
      const id = u.searchParams.get('list');
      return id ? { kind: 'playlist', id } : null;
    }
    const seg = u.pathname.split('/').filter(Boolean);
    if ((seg[0] === 'embed' || seg[0] === 'shorts' || seg[0] === 'live') && seg[1]) return { kind: 'video', id: seg[1] };
    if (seg[0]?.startsWith('@')) return { kind: 'handle', handle: seg[0] };
    if (seg[0] === 'channel' && seg[1]) return { kind: 'channelId', id: seg[1] };
    if ((seg[0] === 'c' || seg[0] === 'user') && seg[1]) return { kind: 'customName', name: seg[1] };
    return null;
  } catch {
    return null;
  }
}

async function j(url: string): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(url, { next: { revalidate: 300 } });
    if (!res.ok) return null;
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function videoUrl(id: string) {
  return `https://www.youtube.com/watch?v=${id}`;
}

// Lista los videos de una uploads-playlist (hasta 50).
async function listUploads(uploadsId: string, key: string): Promise<YtItem[]> {
  const data = await j(`${API}/playlistItems?part=snippet&maxResults=50&playlistId=${uploadsId}&key=${key}`);
  const items = Array.isArray(data?.items) ? (data!.items as Record<string, unknown>[]) : [];
  const out: YtItem[] = [];
  for (const it of items) {
    const sn = it.snippet as Record<string, unknown> | undefined;
    const vid = (sn?.resourceId as Record<string, unknown> | undefined)?.videoId as string | undefined;
    const title = (sn?.title as string) || '';
    if (vid && title && title !== 'Private video' && title !== 'Deleted video') {
      out.push({ id: videoUrl(vid), title, url: videoUrl(vid) });
    }
  }
  return out;
}

async function uploadsFromChannel(params: string, key: string): Promise<YtItem[]> {
  const data = await j(`${API}/channels?part=contentDetails&${params}&key=${key}`);
  const items = Array.isArray(data?.items) ? (data!.items as Record<string, unknown>[]) : [];
  const uploads = (((items[0]?.contentDetails as Record<string, unknown> | undefined)?.relatedPlaylists as Record<string, unknown> | undefined)?.uploads) as string | undefined;
  if (!uploads) return [];
  return listUploads(uploads, key);
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url');
  const key = process.env.YOUTUBE_API_KEY;
  if (!url) return NextResponse.json({ error: 'Falta el parámetro url' }, { status: 400 });
  if (!key) return NextResponse.json({ error: 'YouTube no está configurado' }, { status: 500 });

  const p = parseYt(url);
  if (!p) return NextResponse.json({ error: 'URL de YouTube inválida' }, { status: 400 });

  let tracks: YtItem[] = [];
  if (p.kind === 'video') {
    const data = await j(`${API}/videos?part=snippet&id=${p.id}&key=${key}`);
    const it = (Array.isArray(data?.items) ? (data!.items as Record<string, unknown>[]) : [])[0];
    const title = ((it?.snippet as Record<string, unknown> | undefined)?.title as string) || 'Video de YouTube';
    tracks = [{ id: videoUrl(p.id), title, url: videoUrl(p.id) }];
  } else if (p.kind === 'playlist') {
    const data = await j(`${API}/playlists?part=snippet&id=${p.id}&key=${key}`);
    const it = (Array.isArray(data?.items) ? (data!.items as Record<string, unknown>[]) : [])[0];
    const title = ((it?.snippet as Record<string, unknown> | undefined)?.title as string) || 'Playlist de YouTube';
    const purl = `https://www.youtube.com/playlist?list=${p.id}`;
    tracks = [{ id: purl, title, url: purl }];
  } else if (p.kind === 'channelId') {
    tracks = await uploadsFromChannel(`id=${p.id}`, key);
  } else if (p.kind === 'handle') {
    tracks = await uploadsFromChannel(`forHandle=${encodeURIComponent(p.handle)}`, key);
  } else if (p.kind === 'customName') {
    // Sin API directa para /c/ o /user/: buscar el canal y usar su uploads.
    const search = await j(`${API}/search?part=snippet&type=channel&maxResults=1&q=${encodeURIComponent(p.name)}&key=${key}`);
    const cid = (((Array.isArray(search?.items) ? (search!.items as Record<string, unknown>[]) : [])[0]?.snippet as Record<string, unknown> | undefined)?.channelId) as string | undefined;
    if (cid) tracks = await uploadsFromChannel(`id=${cid}`, key);
  }

  if (!tracks.length) {
    return NextResponse.json({ error: 'No se encontraron videos en esa URL de YouTube' }, { status: 502 });
  }
  return NextResponse.json(
    { tracks },
    { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600' } }
  );
}
