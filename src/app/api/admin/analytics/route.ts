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

    // Cruza los clics de GA con los eventos ACTUALES de Contentful: así la lista
    // muestra cada evento vigente hoy (aunque tenga 0 clics), no solo los que
    // GA registró. Se matchea por título (mismo `event_title` que envía TicketButton).
    try {
      const events = await getEvents();
      const now = dayjs();
      const upcoming = events.filter((e) => {
        const start = dayjs(e.date);
        const end = e.endDate ? dayjs(e.endDate) : start;
        const effectiveEnd = end.isAfter(start) ? end : start;
        return effectiveEnd.isAfter(now);
      });
      // Identificamos el evento por TÍTULO + FECHA (la URL puede cambiar).
      const clickByKey = new Map(data.ticketClicks.map((t) => [`${t.title}||${t.date}`, t.value]));
      data.ticketClicks = upcoming
        .map((e) => {
          const dateKey = dayjs(e.date).format('YYYY-MM-DD');
          return { title: e.title, date: dateKey, value: clickByKey.get(`${e.title}||${dateKey}`) ?? 0 };
        })
        .sort((a, b) => b.value - a.value);
    } catch {
      // si Contentful falla, dejamos los clics tal cual vienen de GA
    }

    return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json(
      { error: 'No se pudieron obtener los datos de Google Analytics.' },
      { status: 502 }
    );
  }
}
