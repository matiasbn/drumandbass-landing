import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { getAnalyticsOverview } from '@/src/lib/ga';
import { getEvents } from '@/src/lib/cms';
import dayjs from '@/src/lib/date';
import { verifyAdmin } from '@/src/lib/authz';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// dnbt=<id>: marcador que agrega el botón de tickets para identificar el evento
// aunque la URL de destino se comparta o cambie.
function dnbtOf(url: string): string | null {
  try {
    return new URL(url).searchParams.get('dnbt');
  } catch {
    return null;
  }
}

// Normaliza para el fallback histórico (clics viejos sin marcador): host + path,
// sin query ni slash final.
function normUrl(url: string): string {
  try {
    const u = new URL(url);
    return (u.host + u.pathname).toLowerCase().replace(/\/$/, '');
  } catch {
    return url.toLowerCase().replace(/[?#].*$/, '').replace(/\/$/, '');
  }
}

// id de video de YouTube desde watch?v= o youtu.be/.
function youtubeVideoId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtu.be')) return u.pathname.slice(1).split('/')[0] || null;
    if (u.hostname.includes('youtube.com') && u.pathname === '/watch') return u.searchParams.get('v');
    return null;
  } catch {
    return null;
  }
}

// Cuenta clics a videos cuyo título contiene "El Sótano" (identificación robusta,
// independiente de la página donde esté la sección). Usa la API de YouTube.
async function sotanoClicksFromYouTube(videoClicks: Map<string, number>): Promise<number> {
  const ids = [...videoClicks.keys()];
  const key = process.env.YOUTUBE_API_KEY;
  if (!ids.length || !key) return 0;
  const titles = new Map<string, string>();
  try {
    for (let i = 0; i < ids.length; i += 50) {
      const chunk = ids.slice(i, i + 50);
      const res = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${chunk.join(',')}&key=${key}`
      );
      const j = await res.json();
      for (const it of j.items ?? []) titles.set(it.id, it.snippet?.title ?? '');
    }
  } catch {
    return 0;
  }
  let total = 0;
  for (const [vid, count] of videoClicks) {
    const t = (titles.get(vid) ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '');
    if (/el\s*sotano/i.test(t)) total += count;
  }
  return total;
}

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

async function isAdmin(supabase: Awaited<ReturnType<typeof createSupabaseServer>>): Promise<boolean> {
  return (await verifyAdmin(supabase)).isAdmin;
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

    // Cruzamos los clics SALIENTES de GA (medición automática, confiable) con el CMS:
    // - Tickets por evento: marcador dnbt=<id> (exacto) con fallback por URL base.
    // - WhatsApp / redes: por dominio. El Sótano: por título del video (API YouTube).
    // Además sobre-escribimos los eventos propios (que se pierden en la navegación)
    // con estos números confiables.
    try {
      const events = await getEvents(); // pasados + futuros
      const now = dayjs();
      const eventIds = new Set(events.map((e) => e.id));

      // Índice URL-base → eventId, para atribuir clics viejos sin marcador.
      const linkToEvent = new Map<string, string>();
      for (const e of events) {
        const links = e.ticketLinks?.length ? e.ticketLinks : e.tickets ? [e.tickets] : [];
        for (const l of links) linkToEvent.set(normUrl(l), e.id);
      }

      // Recorremos los clics salientes por URL: tickets (marcador/fallback) y videos.
      const ticketTally = new Map<string, number>();
      let ticketTotal = 0;
      const videoClicks = new Map<string, number>();
      for (const row of data.outboundByUrl ?? []) {
        const marker = dnbtOf(row.label);
        const eid = marker && eventIds.has(marker) ? marker : linkToEvent.get(normUrl(row.label));
        if (eid) {
          ticketTally.set(eid, (ticketTally.get(eid) ?? 0) + row.value);
          ticketTotal += row.value;
        }
        const vid = youtubeVideoId(row.label);
        if (vid) videoClicks.set(vid, (videoClicks.get(vid) ?? 0) + row.value);
      }

      // Panel por evento: solo los vigentes (aunque tengan 0).
      const upcoming = events.filter((e) => {
        const start = dayjs(e.date);
        const end = e.endDate ? dayjs(e.endDate) : start;
        return (end.isAfter(start) ? end : start).isAfter(now);
      });
      data.ticketClicks = upcoming
        .map((e) => ({
          title: e.title,
          date: dayjs(e.date).format('YYYY-MM-DD'),
          value: ticketTally.get(e.id) ?? 0,
        }))
        .sort((a, b) => b.value - a.value);

      // Totales por dominio + El Sótano por título de video.
      const domTotal = (pred: (d: string) => boolean) =>
        (data.outboundByDomain ?? [])
          .filter((d) => pred(d.label.toLowerCase()))
          .reduce((s, d) => s + d.value, 0);
      const whatsapp = domTotal((d) => d.includes('whatsapp'));
      const youtubeTotal = domTotal((d) => d.includes('youtube.com') || d.includes('youtu.be'));
      const socialDomains = ['instagram.com', 'soundcloud.com', 'spotify.com', 'tiktok.com', 'x.com', 'twitter.com', 'facebook.com'];
      const socialBase = domTotal((d) => socialDomains.some((s) => d.includes(s)));
      const sotano = await sotanoClicksFromYouTube(videoClicks);
      // Redes = redes sociales + todo YouTube que NO sea El Sótano (canal, etc.).
      const redes = socialBase + Math.max(0, youtubeTotal - sotano);

      const setEvent = (name: string, value: number) => {
        const i = data.topEvents.findIndex((e) => e.label === name);
        if (i >= 0) data.topEvents[i].value = value;
        else data.topEvents.push({ label: name, value });
      };
      setEvent('event_link_click', ticketTotal);
      setEvent('whatsapp_click', whatsapp);
      setEvent('social_click', redes);
      setEvent('sotano_video_click', sotano);
    } catch {
      // si el CMS/GA falla, dejamos los datos tal cual vienen
    }

    return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json(
      { error: 'No se pudieron obtener los datos de Google Analytics.' },
      { status: 502 }
    );
  }
}
