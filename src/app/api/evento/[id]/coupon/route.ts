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
  if (row?.code) {
    return NextResponse.json({ status: 'ok', code: row.code, kind: row.kind });
  }

  // Sin código hay dos razones distintas, y la UI reacciona distinto a cada una:
  // si no es junglist, inscribirse podría darle el cupón; si YA es junglist, es
  // que a su perfil no le corresponde y no hay nada que ofrecerle.
  const [{ data: junglist }, { data: dj }] = await Promise.all([
    supabase.from('junglists').select('id').eq('user_id', user.id).maybeSingle(),
    supabase.from('pk_profiles').select('id').eq('user_id', user.id).maybeSingle(),
  ]);

  return NextResponse.json({
    status: 'no_coupon',
    isJunglist: Boolean(junglist || dj),
  });
}
