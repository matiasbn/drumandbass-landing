import { NextRequest, NextResponse } from 'next/server';
import { resolveBandcampTralbum, isBandcampUrl } from '@/src/lib/bandcamp';

// ¿El release de Bandcamp es descargable gratis? (free download o name-your-price
// mínimo 0). La descarga se completa en la propia página del release.
export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url');
  if (!url || !isBandcampUrl(url)) {
    return NextResponse.json({ error: 'URL de Bandcamp inválida' }, { status: 400 });
  }
  const t = await resolveBandcampTralbum(url);
  const downloadable = t?.downloadable === true;
  return NextResponse.json(
    { downloadable, downloadUrl: downloadable ? url : null, canonicalUrl: url },
    { headers: { 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=3600' } }
  );
}
