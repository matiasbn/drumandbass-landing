import { NextRequest, NextResponse } from 'next/server';
import { fetchSoundcloudTrackMeta, isSoundcloudUrl } from '@/src/lib/soundcloud';

// Estado de descarga EN VIVO de un track de SoundCloud (nativa o gate externo).
// La vista de releases lo consulta por track en vez de leerlo de la DB, así un
// download recién habilitado/inhabilitado por el artista se refleja al toque.
// Cacheado en el edge (s-maxage) para no scrapear en cada request.
export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url');
  if (!url || !isSoundcloudUrl(url)) {
    return NextResponse.json({ downloadable: false, downloadUrl: null }, { status: 400 });
  }
  const meta = await fetchSoundcloudTrackMeta(url);
  return NextResponse.json(
    {
      downloadable: meta.downloadable === true,
      downloadUrl: meta.downloadUrl ?? null,
      // URL canónica: el player la usa para reproducir aunque la DB tenga un link
      // corto (on.soundcloud.com), que el widget no sabe cargar.
      canonicalUrl: meta.canonicalUrl ?? null,
    },
    { headers: { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=600' } }
  );
}
