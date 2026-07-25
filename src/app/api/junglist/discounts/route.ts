import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/src/lib/supabase-server';
import dayjs from '@/src/lib/date';

// Descuentos junglist vigentes. Devuelve:
//  - `activeCount`: cuántos eventos vigentes tienen ALGÚN descuento junglist. Es
//    dato PÚBLICO (los booleanos has_coupon_* lo son) → sirve para el anon, para
//    llamarlo a inscribirse ("hay descuento activo").
//  - `discounts`: los eventos donde el USUARIO logueado califica (resuelto con
//    get_event_coupon, misma lógica que la landing). Vacío si no hay sesión.
// El código nunca sale acá — se copia en la landing (contra sesión).
export async function GET() {
  const supabase = await createSupabaseServer();

  // Público: eventos vigentes con algún cupón (booleanos, sin exponer el código).
  const { data: events } = await supabase
    .from('cms_events')
    .select('id, title, date, end_date')
    .or('has_coupon_new.is.true,has_coupon_existing.is.true')
    .order('date', { ascending: true });

  const now = dayjs();
  const upcoming = (events ?? []).filter((e) => {
    const ends = e.end_date || e.date;
    return dayjs(ends).isAfter(now.subtract(6, 'hour')); // 6 h de gracia post-inicio
  });
  const activeCount = upcoming.length;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ discounts: [], activeCount });

  const discounts: { id: string; title: string; date: string }[] = [];
  for (const e of upcoming) {
    const { data } = await supabase.rpc('get_event_coupon', { p_event_id: e.id });
    const row = Array.isArray(data) ? data[0] : data;
    if (row?.code) discounts.push({ id: e.id, title: e.title, date: e.date });
  }

  return NextResponse.json({ discounts, activeCount });
}
