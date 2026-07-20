import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/src/lib/supabase-server';

// Revela el cupón Junglist de un evento SOLO al usuario autenticado que además
// es junglist (o DJ, que siempre es junglist). La función get_event_coupon
// decide todo en base a auth.uid(): elige el código de "junglist nuevo" o el de
// "ya registrado" comparando su fecha de registro con coupon_set_at, y devuelve
// NULL si no corresponde. Así el código nunca sale al HTML público ni al correo.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createSupabaseServer();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ status: 'anon' }, { status: 401 });

  const { data, error } = await supabase.rpc('get_event_coupon', { p_event_id: id });
  if (error) {
    return NextResponse.json({ status: 'error', error: error.message }, { status: 500 });
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.code) {
    // Está logueado pero no es junglist (o el evento no tiene cupón).
    return NextResponse.json({ status: 'not_junglist' });
  }

  return NextResponse.json({ status: 'ok', code: row.code, kind: row.kind });
}
