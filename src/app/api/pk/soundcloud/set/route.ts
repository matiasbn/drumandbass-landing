import { NextRequest, NextResponse } from 'next/server';
import { fetchSoundcloudSetTracks, isSoundcloudUrl } from '@/src/lib/soundcloud';

// Lista de tracks de un EP/set de SoundCloud, para la vista anidada del
// reproductor de Releases Nacionales. Público (solo lee datos públicos de SC).
export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url');
  if (!url || !isSoundcloudUrl(url)) {
    return NextResponse.json({ error: 'URL de SoundCloud inválida' }, { status: 400 });
  }

  const set = await fetchSoundcloudSetTracks(url);
  if (!set) {
    return NextResponse.json({ error: 'No se pudo leer el set' }, { status: 502 });
  }

  return NextResponse.json(set, {
    // El contenido de un EP cambia rara vez: cacheamos 1h en el edge.
    headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' },
  });
}
