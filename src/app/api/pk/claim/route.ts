import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createSupabaseServer } from '@/src/lib/supabase-server';
import type { PendingPresskitData } from '@/src/types/pendingPresskit';

// El DJ reclama un presskit que le armó un admin. Corre con la SESIÓN del DJ
// (login con Google), así puede insertar sus propias filas por RLS. Verifica que
// su email calce con el que puso el admin, rechaza si ya tiene un presskit, crea
// pk_profiles + presskits (publicado) con la data del admin y marca el pendiente
// como reclamado (vía RPC SECURITY DEFINER, porque la tabla es admin-only).
export async function POST(request: Request) {
  const supabase = await createSupabaseServer();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Necesitas iniciar sesión', code: 'no_auth' }, { status: 401 });
  }

  const { token } = await request.json();
  if (!token) return NextResponse.json({ error: 'Falta el token' }, { status: 400 });

  // Leer el pendiente por token (RPC SECURITY DEFINER; la tabla es admin-only).
  const { data: rows, error: readError } = await supabase.rpc('get_pending_presskit', { p_token: token });
  const pending = Array.isArray(rows) ? rows[0] : rows;
  if (readError || !pending) {
    return NextResponse.json({ error: 'Este enlace no es válido', code: 'not_found' }, { status: 404 });
  }
  if (pending.status !== 'pending') {
    return NextResponse.json({ error: 'Este presskit ya fue reclamado', code: 'already_claimed' }, { status: 409 });
  }

  // El email de Google debe calzar con el que puso el admin.
  const userEmail = (user.email || '').trim().toLowerCase();
  if (!userEmail || userEmail !== String(pending.email).trim().toLowerCase()) {
    return NextResponse.json(
      { error: 'Iniciaste sesión con otro correo. Debes usar el correo al que llegó la invitación.', code: 'email_mismatch' },
      { status: 403 }
    );
  }

  // Rechazar si el DJ ya tiene un presskit (decisión: no pisar data existente).
  const { data: existingProfile } = await supabase
    .from('pk_profiles')
    .select('slug')
    .eq('user_id', user.id)
    .maybeSingle();
  const { data: existingPk } = await supabase
    .from('presskits')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (existingProfile || existingPk) {
    return NextResponse.json(
      { error: 'Ya tienes un presskit en tu cuenta. Escríbenos si necesitas ayuda.', code: 'has_presskit' },
      { status: 409 }
    );
  }

  // Resolver colisión de slug (otro usuario ya lo usa) agregando sufijo.
  const baseSlug = String(pending.slug || 'dj').trim().toLowerCase();
  let slug = baseSlug;
  for (let i = 2; i < 100; i++) {
    const { data: taken } = await supabase.from('pk_profiles').select('id').eq('slug', slug).maybeSingle();
    if (!taken) break;
    slug = `${baseSlug}-${i}`;
  }

  const data = (pending.data || {}) as PendingPresskitData;

  // Crear el perfil (slug) del DJ.
  const { error: profileError } = await supabase
    .from('pk_profiles')
    .insert({ user_id: user.id, slug, email: user.email || null });
  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  // Crear el presskit real, publicado, con la data del admin.
  const { error: pkError } = await supabase.from('presskits').insert({
    user_id: user.id,
    artist_name: data.artist_name || '',
    real_name: data.real_name || null,
    city: data.city || null,
    country: data.country || null,
    genres: data.genres || [],
    bio: data.bio || null,
    custom_sections: data.custom_sections || [],
    rider: data.rider || null,
    photo_url: data.photo_urls?.length ? data.photo_urls[0] : null,
    photo_urls: data.photo_urls || [],
    logo_urls: data.logo_urls || [],
    socials: data.socials || [],
    mixes: data.mixes || [],
    links: data.links || [],
    published: true,
  });
  if (pkError) {
    // Rollback del perfil para no dejar un slug huérfano.
    await supabase.from('pk_profiles').delete().eq('user_id', user.id);
    return NextResponse.json({ error: pkError.message }, { status: 500 });
  }

  // Marcar el pendiente como reclamado (RPC SECURITY DEFINER).
  await supabase.rpc('mark_pending_presskit_claimed', { p_token: token });

  // Refrescar vistas que dependen de releases (home + /releases).
  revalidatePath('/');
  revalidatePath('/releases');

  return NextResponse.json({ ok: true, slug });
}
