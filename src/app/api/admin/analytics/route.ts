import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { getAnalyticsOverview } from '@/src/lib/ga';
import { getEvents } from '@/src/lib/cms';
import dayjs from '@/src/lib/date';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function createSupabaseServer(cookieStore: Awaited<ReturnType<typeof cookies>>) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {
          // no-op en route handler de solo lectura
        },
      },
    }
  );
}

async function isAdmin(supabase: ReturnType<typeof createSupabaseServer>): Promise<boolean> {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return false;
  const { data } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('user_id', user.id)
    .single();
  return data?.is_admin === true;
}

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createSupabaseServer(cookieStore);

  if (!(await isAdmin(supabase))) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const daysParam = Number(request.nextUrl.searchParams.get('days'));
  const days = [7, 30, 90].includes(daysParam) ? daysParam : 30;

  // Un día específico (?date=YYYYMMDD) o un mes (?month=YYYYMM) sobre-escriben el rango.
  const dateStr = request.nextUrl.searchParams.get('date');
  const monthStr = request.nextUrl.searchParams.get('month');
  let range: { startDate: string; endDate: string } | undefined;
  if (dateStr && /^\d{8}$/.test(dateStr)) {
    const d = `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
    range = { startDate: d, endDate: d };
  } else if (monthStr && /^\d{6}$/.test(monthStr)) {
    const y = Number(monthStr.slice(0, 4));
    const m = Number(monthStr.slice(4, 6));
    const last = new Date(y, m, 0).getDate();
    const mm = String(m).padStart(2, '0');
    range = { startDate: `${y}-${mm}-01`, endDate: `${y}-${mm}-${String(last).padStart(2, '0')}` };
  }

  try {
    const data = await getAnalyticsOverview(days, range);

    // Atribuimos cada clic a "Tickets" al EVENTO correcto usando solo el título
    // (event_title) + el DÍA del clic. La gente clickea tickets ANTES del evento,
    // así que cada clic pertenece a la PRÓXIMA ocurrencia de ese título a partir de
    // ese día. Como dos eventos homónimos siempre tienen fechas distintas, esto los
    // separa sin ambigüedad. Solo mostramos eventos vigentes → los pasados nunca
    // aparecen y sus clics (de una ventana anterior) no cuentan para el actual.
    try {
      const events = await getEvents(); // pasados + futuros, orden asc por fecha
      const now = dayjs();

      // Ocurrencias por título (ordenadas asc), para encontrar la próxima tras el clic.
      const occByTitle = new Map<string, { id: string; dateKey: string }[]>();
      for (const e of events) {
        const list = occByTitle.get(e.title) ?? [];
        list.push({ id: e.id, dateKey: dayjs(e.date).format('YYYY-MM-DD') });
        occByTitle.set(e.title, list);
      }

      // Tally por evento: cada clic → primera ocurrencia con fecha >= día del clic.
      const tally = new Map<string, number>();
      for (const row of data.ticketClickRows ?? []) {
        if (!/^\d{8}$/.test(row.day)) continue;
        const clickKey = `${row.day.slice(0, 4)}-${row.day.slice(4, 6)}-${row.day.slice(6, 8)}`;
        const occ = (occByTitle.get(row.title) ?? []).find((o) => o.dateKey >= clickKey);
        if (occ) tally.set(occ.id, (tally.get(occ.id) ?? 0) + row.value);
      }

      // La lista muestra los eventos vigentes hoy (aunque tengan 0 clics).
      const upcoming = events.filter((e) => {
        const start = dayjs(e.date);
        const end = e.endDate ? dayjs(e.endDate) : start;
        const effectiveEnd = end.isAfter(start) ? end : start;
        return effectiveEnd.isAfter(now);
      });
      data.ticketClicks = upcoming
        .map((e) => ({
          title: e.title,
          date: dayjs(e.date).format('YYYY-MM-DD'),
          value: tally.get(e.id) ?? 0,
        }))
        .sort((a, b) => b.value - a.value);
    } catch {
      // si el CMS falla, dejamos ticketClicks vacío
    }

    return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json(
      { error: 'No se pudieron obtener los datos de Google Analytics.' },
      { status: 502 }
    );
  }
}
