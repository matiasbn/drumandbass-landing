import { NextResponse } from 'next/server';
import { getSotanoVideos } from '@/src/lib/youtube';

// El Sótano se carga client-side desde acá (desacoplado del ISR del home) para
// que un capítulo nuevo aparezca casi al instante. La ruta no se cachea; la
// CUOTA de YouTube la protege el fetch interno de getSotanoVideos (revalidate
// corto), así nunca se llama a la API más de ~1 vez cada esos segundos por más
// tráfico que haya.
export const dynamic = 'force-dynamic';

export async function GET() {
  const videos = await getSotanoVideos(2);
  return NextResponse.json({ videos }, { headers: { 'Cache-Control': 'no-store' } });
}
