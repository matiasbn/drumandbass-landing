import { NextRequest, NextResponse } from 'next/server';
import { resolveBandcampTralbum, isBandcampUrl } from '@/src/lib/bandcamp';

// Resuelve la URL de audio mp3 de un track (o el primer track de un álbum) de
// Bandcamp, para reproducir con un <audio> propio (preview en el editor y, más
// adelante, el reproductor de Releases). La URL firmada expira → se re-resuelve.
export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url');
  if (!url || !isBandcampUrl(url)) {
    return NextResponse.json({ error: 'URL de Bandcamp inválida' }, { status: 400 });
  }
  const t = await resolveBandcampTralbum(url);
  const first = t?.tracks.find((x) => x.streamUrl);
  if (!t || !first?.streamUrl) {
    return NextResponse.json({ error: 'No se pudo resolver el stream' }, { status: 502 });
  }
  return NextResponse.json(
    {
      streamUrl: first.streamUrl,
      protocol: 'progressive',
      title: first.title || t.title,
      artist: t.artist,
      artwork: t.artwork,
      durationMs: first.durationMs,
      downloadable: t.downloadable,
    },
    { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' } }
  );
}
