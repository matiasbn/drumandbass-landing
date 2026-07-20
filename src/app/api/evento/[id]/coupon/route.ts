import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createSupabaseServer } from '@/src/lib/supabase-server';
import {
  MOCK_AUTH_ENABLED,
  MOCK_COOKIE,
  SOCIAL,
  resolveIdentity,
  mockCouponFor,
} from '@/src/lib/devAuth';

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

  // Modo mock (solo dev): responde según el perfil simulado, usando los códigos
  // REALES del evento para que la matriz se pruebe contra datos de verdad. El
  // default es Anónimo; 'social' cae a la sesión real de más abajo.
  if (MOCK_AUTH_ENABLED) {
    const identity = resolveIdentity((await cookies()).get(MOCK_COOKIE)?.value);
    if (identity !== SOCIAL) {
      if (identity.key === 'anon') {
        return NextResponse.json({ status: 'anon', mock: true }, { status: 401 });
      }
      const { data: ev } = await supabase
        .from('cms_events')
        .select('coupon_junglist_new, coupon_junglist')
        .eq('id', id)
        .maybeSingle();
      const coupon = mockCouponFor(
        identity,
        ev?.coupon_junglist_new ?? null,
        ev?.coupon_junglist ?? null
      );
      return coupon
        ? NextResponse.json({ status: 'ok', ...coupon, mock: true })
        : NextResponse.json({ status: 'no_coupon', isJunglist: identity.isJunglist, mock: true });
    }
  }

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
