import { revalidatePath } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';

import { createSupabaseServer } from '@/src/lib/supabase-server';
import { type CmsEventRow, CMS_EVENT_SELECT } from '@/src/lib/cms';
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

// Código de cupón normalizado a MAYÚSCULA (igual que en campañas); null si vacío.
const normalizeCode = (v: unknown) =>
  typeof v === 'string' && v.trim() !== '' ? v.trim().toUpperCase() : null;

// Campos de cupón para escribir en cms_events, con coupon_set_at SET-ONCE (el
// corte nuevo/antiguo se fija la 1ª vez y NO se mueve). Devuelve null si el body
// no trae campos de cupón (para no pisar los códigos al editar sin tocarlos).
async function couponFieldsFor(
  supabase: Awaited<ReturnType<typeof createSupabaseServer>>,
  eventId: string | null,
  body: Record<string, unknown>
) {
  if (!('coupon_junglist_new' in body) && !('coupon_junglist' in body)) return null;
  const newCode = normalizeCode(body.coupon_junglist_new);
  const existingCode = normalizeCode(body.coupon_junglist);
  const hasAny = Boolean(newCode || existingCode);
  let setAt: string | null = null;
  if (eventId) {
    const { data } = await supabase
      .from('cms_events')
      .select('coupon_set_at')
      .eq('id', eventId)
      .maybeSingle();
    setAt = (data?.coupon_set_at as string | null) ?? null;
  }
  return {
    coupon_junglist_new: newCode,
    coupon_junglist: existingCode,
    coupon_set_at: setAt ?? (hasAny ? new Date().toISOString() : null),
  };
}

// GET — lista todos los eventos, o (con ?couponFor=<id>) los CÓDIGOS de cupón de
// un evento (no vienen en la lista por seguridad; se leen vía función admin).
export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServer();
  if (!(await verifyAdmin(supabase))) {
    return NextResponse.json({ events: [], error: 'No autorizado' }, { status: 403 });
  }

  const couponFor = new URL(request.url).searchParams.get('couponFor');
  if (couponFor) {
    const { data, error } = await supabase.rpc('admin_event_coupons', { p_event_id: couponFor });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const row = Array.isArray(data) ? data[0] : data;
    return NextResponse.json({
      coupon: {
        coupon_junglist_new: row?.coupon_junglist_new ?? '',
        coupon_junglist: row?.coupon_junglist ?? '',
        coupon_set_at: row?.coupon_set_at ?? null,
      },
    });
  }

  const { data, error } = await supabase
    .from('cms_events')
    .select(CMS_EVENT_SELECT)
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

  const coupon = await couponFieldsFor(supabase, null, body);
  const { data, error } = await supabase
    .from('cms_events')
    .insert(coupon ? { ...fields, ...coupon } : fields)
    .select(CMS_EVENT_SELECT)
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

  const coupon = await couponFieldsFor(supabase, String(body.id), body);
  const { data, error } = await supabase
    .from('cms_events')
    .update(coupon ? { ...fields, ...coupon } : fields)
    .eq('id', body.id)
    .select(CMS_EVENT_SELECT)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  revalidateSite();
  if (coupon) revalidatePath(`/evento/${body.id}`);
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
