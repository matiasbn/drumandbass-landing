import { NextResponse } from 'next/server';
import { getNationalReleases } from '@/src/lib/nationalReleases';

// Siempre fresco: la sección de Releases Nacionales del home consume esta ruta
// client-side, así un release recién marcado se ve al instante sin depender del
// caché ISR del home (que sí queremos mantener por rendimiento).
export const dynamic = 'force-dynamic';

export async function GET() {
  const releases = await getNationalReleases();
  return NextResponse.json(
    { releases },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
