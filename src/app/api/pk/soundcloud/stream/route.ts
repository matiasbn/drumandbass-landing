import { NextRequest, NextResponse } from 'next/server';
import { resolveSoundcloudStream, isSoundcloudUrl } from '@/src/lib/soundcloud';

// Resuelve la URL de audio real de un track de SoundCloud para reproducir con el
// <audio> propio del reproductor (mejor UX que el widget: controles nativos del
// celular, auto-avance, sin gate). La URL firmada expira, así que se cachea poco.
export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url');
  if (!url || !isSoundcloudUrl(url)) {
    return NextResponse.json({ error: 'URL de SoundCloud inválida' }, { status: 400 });
  }
  const stream = await resolveSoundcloudStream(url);
  if (!stream) {
    return NextResponse.json({ error: 'No se pudo resolver el stream' }, { status: 502 });
  }
  return NextResponse.json(stream, {
    // Corta: la URL firmada expira. Un poco de caché en edge para clicks seguidos.
    headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' },
  });
}
