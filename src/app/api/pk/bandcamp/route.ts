import { NextRequest, NextResponse } from 'next/server';
import { fetchBandcampDiscography, isBandcampUrl } from '@/src/lib/bandcamp';

// Lista la discografía de un artista de Bandcamp (álbumes/EPs + tracks) para
// importarla al presskit, igual que /api/pk/soundcloud. Público (solo lee datos
// públicos). Cacheado un poco en edge: la discografía cambia poco.
export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url');
  if (!url || !isBandcampUrl(url)) {
    return NextResponse.json({ error: 'URL de Bandcamp inválida' }, { status: 400 });
  }

  const releases = await fetchBandcampDiscography(url);
  return NextResponse.json(
    { tracks: releases.map((r) => ({ id: r.id, title: r.title, url: r.url, isAlbum: r.isAlbum })) },
    { headers: { 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=3600' } }
  );
}
