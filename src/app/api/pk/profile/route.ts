import { createSupabaseServer } from '@/src/lib/supabase-server';
import { NextResponse } from 'next/server';

export async function GET() {
  const supabase = await createSupabaseServer();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ profile: null }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('pk_profiles')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (error && error.code !== 'PGRST116') {
    return NextResponse.json({ profile: null, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ profile: data });
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServer();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { slug } = await request.json();

  if (!slug || typeof slug !== 'string') {
    return NextResponse.json({ error: 'Slug requerido' }, { status: 400 });
  }

  const cleanSlug = slug.trim().toLowerCase();

  if (cleanSlug.length < 3 || cleanSlug.length > 30) {
    return NextResponse.json({ error: 'El slug debe tener entre 3 y 30 caracteres' }, { status: 400 });
  }

  if (!/^[a-z0-9-]+$/.test(cleanSlug)) {
    return NextResponse.json({ error: 'Solo letras minúsculas, números y guiones' }, { status: 400 });
  }

  // Check if user already has a pk_profile
  const { data: existing } = await supabase
    .from('pk_profiles')
    .select('id')
    .eq('user_id', user.id)
    .single();

  if (existing) {
    return NextResponse.json({ error: 'Ya tienes un perfil de presskit' }, { status: 409 });
  }

  // Check if slug is taken
  const { data: slugTaken } = await supabase
    .from('pk_profiles')
    .select('id')
    .eq('slug', cleanSlug)
    .single();

  if (slugTaken) {
    return NextResponse.json({ error: 'Este nombre ya está en uso' }, { status: 409 });
  }

  const { data: profile, error } = await supabase
    .from('pk_profiles')
    .insert({
      user_id: user.id,
      slug: cleanSlug,
      email: user.email || null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ profile });
}
