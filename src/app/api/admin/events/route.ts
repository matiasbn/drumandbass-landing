import { revalidatePath } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';

import { createSupabaseServer } from '@/src/lib/supabase-server';
import type { CmsEventRow } from '@/src/lib/cms';
import { verifyAdmin as verifyAdminCore } from '@/src/lib/authz';

// CRUD de eventos del CMS propio (tabla cms_events). Solo admins: además del
// chequeo aquí, la RLS de la tabla exige profiles.is_admin para escribir.

async function verifyAdmin(supabase: Awaited<ReturnType<typeof createSupabaseServer>>) {
  return (await verifyAdminCore(supabase)).isAdmin;
}

// La home es ISR (1h): tras cualquier mutación se revalida al tiro para que
// el cambio se vea de inmediato en producción.
function revalidateSite() {
  revalidatePath('/', 'layout');
}

type EventPayload = Partial<Omit<CmsEventRow, 'id' | 'created_at' | 'updated_at'>>;

function eventFieldsFromBody(body: Record<string, unknown>): EventPayload {
  const str = (v: unknown) => (typeof v === 'string' && v.trim() !== '' ? v.trim() : null);
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

  const active = str(body.tickets);
  // ticket_links: lista de URLs (historial). Nunca se pierde ninguna; la activa
  // siempre queda incluida. Deduplicamos preservando el orden.
  const rawLinks = Array.isArray(body.ticket_links) ? body.ticket_links : [];
  const links: string[] = [];
  for (const v of rawLinks) {
    const s = str(v);
    if (s && !links.includes(s)) links.push(s);
  }
  if (active && !links.includes(active)) links.push(active);

  return {
    title: str(body.title) ?? undefined,
    venue: str(body.venue),
    address: str(body.address),
    date: str(body.date) ?? undefined,
    end_date: str(body.end_date),
    description_html: str(body.description_html),
    tickets: active,
    ticket_links: links,
    info: str(body.info),
    flyer_url: str(body.flyer_url),
    flyer_width: num(body.flyer_width),
    flyer_height: num(body.flyer_height),
  };
}

// GET — lista todos los eventos (incluidos pasados) para el admin.
export async function GET() {
  const supabase = await createSupabaseServer();
  if (!(await verifyAdmin(supabase))) {
    return NextResponse.json({ events: [], error: 'No autorizado' }, { status: 403 });
  }

  const { data, error } = await supabase
    .from('cms_events')
    .select('*')
    .order('date', { ascending: false });

  if (error) {
    return NextResponse.json({ events: [], error: error.message }, { status: 500 });
  }
  return NextResponse.json({ events: data || [] });
}

// POST — crea un evento. Requiere title y date.
export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServer();
  if (!(await verifyAdmin(supabase))) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });

  const fields = eventFieldsFromBody(body);
  if (!fields.title || !fields.date) {
    return NextResponse.json({ error: 'Título y fecha son obligatorios' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('cms_events')
    .insert(fields)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  revalidateSite();
  return NextResponse.json({ event: data });
}

// PUT — actualiza un evento por id.
export async function PUT(request: NextRequest) {
  const supabase = await createSupabaseServer();
  if (!(await verifyAdmin(supabase))) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (!body?.id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 });

  const fields = eventFieldsFromBody(body);
  if (!fields.title || !fields.date) {
    return NextResponse.json({ error: 'Título y fecha son obligatorios' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('cms_events')
    .update(fields)
    .eq('id', body.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  revalidateSite();
  return NextResponse.json({ event: data });
}

// DELETE — elimina un evento por id (el flyer del bucket se borra desde el client).
export async function DELETE(request: NextRequest) {
  const supabase = await createSupabaseServer();
  if (!(await verifyAdmin(supabase))) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 });

  const { error } = await supabase.from('cms_events').delete().eq('id', id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  revalidateSite();
  return NextResponse.json({ success: true });
}
