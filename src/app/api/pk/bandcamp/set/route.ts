import { NextRequest, NextResponse } from 'next/server';
import { resolveBandcampTralbum, isBandcampUrl } from '@/src/lib/bandcamp';

// Tracklist de un álbum/EP de Bandcamp para la vista anidada del reproductor.
// Los tracks de Bandcamp traen su stream DIRECTO (no tienen URL de página propia),
// así que devolvemos el streamUrl embebido + un `url` sintético (álbum#i) único
// para keys/dedup; el player pre-cachea el stream y no re-resuelve.
export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url');
  if (!url || !isBandcampUrl(url)) {
    return NextResponse.json({ error: 'URL de Bandcamp inválida' }, { status: 400 });
  }
  const t = await resolveBandcampTralbum(url);
  if (!t) return NextResponse.json({ error: 'No se pudo leer el álbum' }, { status: 502 });

  const tracks = t.tracks
    .filter((tr) => tr.streamUrl)
    .map((tr, i) => ({
      title: tr.title,
      // URL REAL del track (track_url); fallback sintético solo si faltara.
      url: tr.trackUrl || `${url}#${i}`,
      streamUrl: tr.streamUrl,
      artwork: t.artwork,
      downloadable: t.downloadable,
      downloadUrl: t.downloadable ? (tr.trackUrl || url) : null,
      durationMs: tr.durationMs,
    }));

  return NextResponse.json(
    { title: t.title, isAlbum: true, tracks },
    { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=1800' } }
  );
}
