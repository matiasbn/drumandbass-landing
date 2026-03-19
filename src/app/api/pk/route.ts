import { createSupabaseServer } from '@/src/lib/supabase-server';
import { NextResponse } from 'next/server';

export async function GET() {
  const supabase = await createSupabaseServer();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ presskit: null }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('presskits')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (error && error.code !== 'PGRST116') {
    return NextResponse.json({ presskit: null, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ presskit: data });
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServer();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const body = await request.json();

  const { data, error } = await supabase
    .from('presskits')
    .insert({
      user_id: user.id,
      artist_name: body.artist_name,
      real_name: body.real_name || null,
      city: body.city || null,
      country: body.country || null,
      genres: body.genres || [],
      bio: body.bio || null,
      photo_url: body.photo_urls?.length ? body.photo_urls[0] : (body.photo_url || null),
      photo_urls: body.photo_urls || [],
      socials: body.socials || [],
      mixes: body.mixes || [],
      links: body.links || [],
      published: body.published || false,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ presskit: data });
}

export async function PUT(request: Request) {
  const supabase = await createSupabaseServer();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const body = await request.json();

  const { data, error } = await supabase
    .from('presskits')
    .update({
      artist_name: body.artist_name,
      real_name: body.real_name || null,
      city: body.city || null,
      country: body.country || null,
      genres: body.genres || [],
      bio: body.bio || null,
      photo_url: body.photo_urls?.length ? body.photo_urls[0] : (body.photo_url || null),
      photo_urls: body.photo_urls || [],
      socials: body.socials || [],
      mixes: body.mixes || [],
      links: body.links || [],
      published: body.published ?? false,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', user.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ presskit: data });
}
