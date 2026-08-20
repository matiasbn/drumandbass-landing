import { NextRequest, NextResponse } from 'next/server';
import { fetchBandcampDiscography, fetchBandcampTracks, resolveBandcampItem, isBandcampUrl } from '@/src/lib/bandcamp';

// Lista la discografía de un artista de Bandcamp (álbumes/EPs + tracks) para
// importarla al presskit, igual que /api/pk/soundcloud. Público (solo lee datos
// públicos). Cacheado un poco en edge: la discografía cambia poco.
export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url');
  if (!url || !isBandcampUrl(url)) {
    return NextResponse.json({ error: 'URL de Bandcamp inválida' }, { status: 400 });
  }

  // Si pegan una URL directa de /track/ o /album/, traemos SOLO ese ítem (en vez
  // de la discografía completa del artista).
  if (/\/(track|album)\//i.test(url)) {
    const item = await resolveBandcampItem(url);
    return NextResponse.json(
      { tracks: item ? [{ id: item.id, title: item.title, url: item.url, isAlbum: item.isAlbum }] : [] },
      { headers: { 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=3600' } }
    );
  }

  // tracks=1 → expande los álbumes en tracks individuales (para encontrar un
  // track que vive dentro de un álbum). Más lento (resuelve cada álbum).
  const flat = req.nextUrl.searchParams.get('tracks') === '1';
  const releases = flat ? await fetchBandcampTracks(url) : await fetchBandcampDiscography(url);
  return NextResponse.json(
    { tracks: releases.map((r) => ({ id: r.id, title: r.title, url: r.url, isAlbum: r.isAlbum })) },
    { headers: { 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=3600' } }
  );
}
