import { NextRequest, NextResponse } from 'next/server';
import { beatportTracksFromUrl } from '@/src/lib/beatport';

// Lista los tracks de una URL de Beatport (artist/release/track) con su preview
// MP3 (sample_url), para importarlos a Sets & Releases y reproducirlos en el
// player propio. Usa las credenciales del embed oficial (ver lib/beatport.ts).
export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url');
  if (!url) return NextResponse.json({ error: 'Falta el parámetro url' }, { status: 400 });
  try {
    const tracks = await beatportTracksFromUrl(url);
    return NextResponse.json(
      { tracks },
      { headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' } }
    );
  } catch {
    return NextResponse.json({ error: 'Error al leer Beatport' }, { status: 500 });
  }
}
