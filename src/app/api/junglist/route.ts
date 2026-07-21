import { createSupabaseServer } from '@/src/lib/supabase-server';
import { NextResponse } from 'next/server';

// PRIVACIDAD (invariante): el junglist NUNCA debe enterarse de que su correo ya
// estaba en la base (p. ej. importado a la lista de ravers por un admin). Por eso:
//   - Este endpoint NO lee `newsletter_subscribers` ni prellena el form con datos
//     previos: solo usa el email de Google; nombre/apellido/instagram los ingresa el usuario.
//   - La deduplicación con ravers ocurre en un trigger silencioso en la DB
//     (junglists_dedupe_ravers, AFTER INSERT), sin señal alguna hacia el usuario.
//   - Ninguna respuesta menciona la lista de ravers ni una "presencia previa".
// Al construir la UI, mantener esta regla: no prellenar con datos que el usuario no dio.

// Normaliza el handle de Instagram: sin espacios, sin @ inicial, sin URL.
function cleanInstagram(raw: string): string {
  return raw
    .trim()
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, '')
    .replace(/^@+/, '')
    .replace(/\/+$/, '')
    .trim();
}

function validate(body: unknown): { name: string; last_name: string; instagram: string } | { error: string } {
  const { name, last_name, instagram } = (body ?? {}) as Record<string, unknown>;
  const n = typeof name === 'string' ? name.trim() : '';
  const l = typeof last_name === 'string' ? last_name.trim() : '';
  const ig = typeof instagram === 'string' ? cleanInstagram(instagram) : '';

  if (!n) return { error: 'El nombre es obligatorio' };
  if (!l) return { error: 'El apellido es obligatorio' };
  if (!ig) return { error: 'El Instagram es obligatorio' };
  return { name: n, last_name: l, instagram: ig };
}

// GET — devuelve la fila de junglist del usuario actual (o null si no está registrado).
export async function GET() {
  const supabase = await createSupabaseServer();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ junglist: null }, { status: 401 });
  }

  // Una baja se trata como "no registrado": devuelve null para que pueda volver a
  // inscribirse (y ahí el POST reactiva conservando la fecha original).
  const { data, error } = await supabase
    .from('junglists')
    .select('*')
    .eq('user_id', user.id)
    .is('unsubscribed_at', null)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ junglist: null, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ junglist: data ?? null });
}

// POST — registra al usuario actual como junglist (una fila por cuenta).
export async function POST(request: Request) {
  const supabase = await createSupabaseServer();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
  if (!user.email) {
    return NextResponse.json({ error: 'La cuenta no tiene email' }, { status: 400 });
  }

  const parsed = validate(await request.json().catch(() => ({})));
  if ('error' in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  // ¿Ya existe una fila para este usuario? Si está activa, ya es junglist. Si se
  // había dado de baja, se REACTIVA conservando created_at (la fecha original),
  // en vez de crear una nueva.
  const { data: existing } = await supabase
    .from('junglists')
    .select('id, unsubscribed_at')
    .eq('user_id', user.id)
    .maybeSingle();

  if (existing) {
    if (!existing.unsubscribed_at) {
      return NextResponse.json({ error: 'Ya estás registrado como junglist' }, { status: 409 });
    }
    const { data: reactivated, error: reErr } = await supabase
      .from('junglists')
      .update({
        unsubscribed_at: null,
        name: parsed.name,
        last_name: parsed.last_name,
        instagram: parsed.instagram,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)
      .select()
      .single();
    if (reErr) return NextResponse.json({ error: reErr.message }, { status: 500 });
    return NextResponse.json({ junglist: reactivated });
  }

  const { data: junglist, error } = await supabase
    .from('junglists')
    .insert({
      user_id: user.id,
      email: user.email.toLowerCase(),
      name: parsed.name,
      last_name: parsed.last_name,
      instagram: parsed.instagram,
    })
    .select()
    .single();

  if (error) {
    // 23505 = unique_violation (email ya usado por otra cuenta)
    const status = error.code === '23505' ? 409 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }

  return NextResponse.json({ junglist });
}

// PUT — actualiza los datos del junglist del usuario actual (email no cambia).
export async function PUT(request: Request) {
  const supabase = await createSupabaseServer();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const parsed = validate(await request.json().catch(() => ({})));
  if ('error' in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const { data: junglist, error } = await supabase
    .from('junglists')
    .update({
      name: parsed.name,
      last_name: parsed.last_name,
      instagram: parsed.instagram,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', user.id)
    .select()
    .single();

  if (error) {
    const status = error.code === 'PGRST116' ? 404 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }

  return NextResponse.json({ junglist });
}

// DELETE — baja voluntaria: NO se borra la fila, se marca como dada de baja. Así
// se conserva created_at (la fecha importa para el corte de descuento) y nadie
// puede darse de baja y re-registrarse para resetearla. El borrado definitivo
// queda solo para el admin.
export async function DELETE() {
  const supabase = await createSupabaseServer();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const now = new Date().toISOString();
  const { error } = await supabase
    .from('junglists')
    .update({ unsubscribed_at: now, updated_at: now })
    .eq('user_id', user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
