import { revalidatePath } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';

import { createSupabaseServer } from '@/src/lib/supabase-server';

// CRUD de streamings del CMS propio (tabla cms_streamings). Solo admins:
// además del chequeo aquí, la RLS de la tabla exige profiles.is_admin.

async function verifyAdmin(supabase: Awaited<ReturnType<typeof createSupabaseServer>>) {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return false;
  const { data: adminProfile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('user_id', user.id)
    .single();
  return adminProfile?.is_admin === true;
}

// /api/live (revalidate 60s) decide el banner EN VIVO a partir de streamings.
function revalidateSite() {
  revalidatePath('/api/live');
}

function streamingFieldsFromBody(body: Record<string, unknown>) {
  const str = (v: unknown) => (typeof v === 'string' && v.trim() !== '' ? v.trim() : null);
  return {
    name: str(body.name) ?? undefined,
    youtube_url: str(body.youtube_url) ?? undefined,
    date: str(body.date) ?? undefined,
    end_date: str(body.end_date),
  };
}

// GET — lista todos los streamings para el admin.
export async function GET() {
  const supabase = await createSupabaseServer();
  if (!(await verifyAdmin(supabase))) {
    return NextResponse.json({ streamings: [], error: 'No autorizado' }, { status: 403 });
  }

  const { data, error } = await supabase
    .from('cms_streamings')
    .select('*')
    .order('date', { ascending: false });

  if (error) {
    return NextResponse.json({ streamings: [], error: error.message }, { status: 500 });
  }
  return NextResponse.json({ streamings: data || [] });
}

// POST — crea un streaming. Requiere name, youtube_url y date.
export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServer();
  if (!(await verifyAdmin(supabase))) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });

  const fields = streamingFieldsFromBody(body);
  if (!fields.name || !fields.youtube_url || !fields.date) {
    return NextResponse.json(
      { error: 'Nombre, URL de YouTube y fecha son obligatorios' },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from('cms_streamings')
    .insert(fields)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  revalidateSite();
  return NextResponse.json({ streaming: data });
}

// PUT — actualiza un streaming por id.
export async function PUT(request: NextRequest) {
  const supabase = await createSupabaseServer();
  if (!(await verifyAdmin(supabase))) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (!body?.id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 });

  const fields = streamingFieldsFromBody(body);
  if (!fields.name || !fields.youtube_url || !fields.date) {
    return NextResponse.json(
      { error: 'Nombre, URL de YouTube y fecha son obligatorios' },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from('cms_streamings')
    .update(fields)
    .eq('id', body.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  revalidateSite();
  return NextResponse.json({ streaming: data });
}

// DELETE — elimina un streaming por id.
export async function DELETE(request: NextRequest) {
  const supabase = await createSupabaseServer();
  if (!(await verifyAdmin(supabase))) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 });

  const { error } = await supabase.from('cms_streamings').delete().eq('id', id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  revalidateSite();
  return NextResponse.json({ success: true });
}
