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
    .select('*')
    .order('date', { ascending: true });

  if (error) {
    console.error('Error fetching cms_events:', error.message);
    return [];
  }
  return (data as CmsEventRow[]).map(mapEventRow);
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
