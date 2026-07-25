import { createClient } from '@supabase/supabase-js';

import { CmsEvent, CmsStreaming } from '@/src/types/types';

// CMS propio: eventos y streamings viven en Supabase (tablas cms_events y
// cms_streamings, lectura pública vía RLS) y se administran en /admin/eventos
// y /admin/streamings. Reemplaza a Contentful.
//
// Cliente anónimo sin sesión: estas lecturas son de contenido público y corren
// en server components ISR (la home cachea 1h) o route handlers, donde no debe
// usarse el cliente con cookies. NO usar este cliente para nada autenticado.
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 'placeholder',
  { auth: { persistSession: false, autoRefreshToken: false } }
);

// Columnas legibles de cms_events. NO se puede usar `select('*')`: los CÓDIGOS de
// cupón (coupon_junglist_new / coupon_junglist) están revocados por columna a
// anon/authenticated (seguridad), y `*` intenta leerlos → "permission denied for
// table". Por eso se listan explícitamente las columnas permitidas.
// ⚠️ Al agregar una columna nueva a cms_events, sumala acá Y al GRANT de la
// migración 20260730 (si no, no la verá el front).
export const CMS_EVENT_SELECT =
  'id, title, venue, address, date, end_date, description_html, tickets, info, flyer_url, flyer_width, flyer_height, created_at, updated_at, ticket_links, coupon_set_at, has_coupon_new, has_coupon_existing';

// Filas tal como están en la DB (snake_case). Los mappers de abajo las
// convierten a los tipos camelCase que consume la UI.
export interface CmsEventRow {
  id: string;
  title: string;
  venue: string | null;
  address: string | null;
  date: string;
  end_date: string | null;
  description_html: string | null;
  tickets: string | null;
  ticket_links: string[] | null;
  info: string | null;
  flyer_url: string | null;
  flyer_width: number | null;
  flyer_height: number | null;
  // Los CÓDIGOS ya no llegan al front público (grants por columna en Supabase):
  // solo llegan estos booleanos derivados. El código real se sirve vía
  // get_event_coupon (SECURITY DEFINER, contra sesión). Los `coupon_*` quedan como
  // opcionales por compatibilidad (p. ej. lectura admin) pero no vienen en la lectura anon.
  has_coupon_new?: boolean | null;
  has_coupon_existing?: boolean | null;
  coupon_junglist_new?: string | null;
  coupon_junglist?: string | null;
  coupon_set_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CmsStreamingRow {
  id: string;
  name: string;
  youtube_url: string;
  date: string;
  end_date: string | null;
  created_at: string;
  updated_at: string;
}

export function mapEventRow(row: CmsEventRow): CmsEvent {
  return {
    id: row.id,
    title: row.title,
    venue: row.venue ?? undefined,
    address: row.address ?? undefined,
    date: row.date,
    endDate: row.end_date ?? undefined,
    description: row.description_html ?? undefined,
    tickets: row.tickets ?? undefined,
    ticketLinks: row.ticket_links ?? undefined,
    info: row.info ?? undefined,
    flyer: row.flyer_url
      ? {
          url: row.flyer_url,
          width: row.flyer_width ?? 0,
          height: row.flyer_height ?? 0,
        }
      : undefined,
    // Solo booleanos — el código se sirve aparte, contra sesión. Se lee de las
    // columnas derivadas (públicas); fallback al código por si aún no se aplicó la
    // migración que oculta los códigos.
    couponForNew: Boolean(row.has_coupon_new ?? row.coupon_junglist_new),
    couponForExisting: Boolean(row.has_coupon_existing ?? row.coupon_junglist),
  };
}

export function mapStreamingRow(row: CmsStreamingRow): CmsStreaming {
  return {
    id: row.id,
    name: row.name,
    youtubeUrl: row.youtube_url,
    date: row.date,
    endDate: row.end_date ?? undefined,
  };
}

export async function getEvents(): Promise<CmsEvent[]> {
  const { data, error } = await supabase
    .from('cms_events')
    .select(CMS_EVENT_SELECT)
    .order('date', { ascending: true });

  if (error) {
    console.error('Error fetching cms_events:', error.message);
    return [];
  }
  return (data as CmsEventRow[]).map(mapEventRow);
}

// Un evento por id (para la landing /evento/[id]). Devuelve null si no existe o
// el id no es válido.
export async function getEventById(id: string): Promise<CmsEvent | null> {
  const { data, error } = await supabase
    .from('cms_events')
    .select(CMS_EVENT_SELECT)
    .eq('id', id)
    .maybeSingle();

  if (error || !data) return null;
  return mapEventRow(data as CmsEventRow);
}

export async function getStreamings(): Promise<CmsStreaming[]> {
  const { data, error } = await supabase
    .from('cms_streamings')
    .select('*')
    .order('date', { ascending: true });

  if (error) {
    console.error('Error fetching cms_streamings:', error.message);
    return [];
  }
  return (data as CmsStreamingRow[]).map(mapStreamingRow);
}
