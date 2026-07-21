import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

// Cliente anónimo: la función mark_campaign_visit es SECURITY DEFINER y solo puede
// setear visited_at/visit_count de la fila cuyo id coincide, así que no hace falta
// service-role. Público a propósito (lo llama la landing con el id del destinatario).
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 'placeholder',
  { auth: { persistSession: false, autoRefreshToken: false } }
);

const isUuid = (v: unknown): v is string =>
  typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

// Marca la VISITA de un destinatario (clic al botón del correo → llegó a la landing).
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const id = (body as { id?: unknown }).id;
  if (!isUuid(id)) return NextResponse.json({ ok: false }, { status: 400 });
  await supabase.rpc('mark_campaign_visit', { p_id: id });
  return NextResponse.json({ ok: true });
}
