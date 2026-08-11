import { createSupabaseServer } from '@/src/lib/supabase-server';
import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { enrichFeaturedReleaseDates } from '@/src/lib/soundcloud';

// Revalida las vistas que dependen de los releases marcados (home + /releases),
// para que marcar/desmarcar se refleje al instante y no espere el ISR (1h).
function revalidateReleases() {
  revalidatePath('/');
  revalidatePath('/releases');
}

const enrichMixes = enrichFeaturedReleaseDates;

// Normaliza las secciones personalizadas: sólo las que tienen título Y contenido,
// recortadas, con un tope sano de secciones para no reventar la fila.
function sanitizeCustomSections(input: unknown): { title: string; body: string }[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((s) => ({
      title: typeof s?.title === 'string' ? s.title.trim() : '',
      body: typeof s?.body === 'string' ? s.body.trim() : '',
    }))
    .filter((s) => s.title && s.body)
    .slice(0, 20);
}

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
      custom_sections: sanitizeCustomSections(body.custom_sections),
      rider: body.rider || null,
      photo_url: body.photo_urls?.length ? body.photo_urls[0] : (body.photo_url || null),
      photo_urls: body.photo_urls || [],
      logo_urls: body.logo_urls || [],
      socials: body.socials || [],
      mixes: await enrichMixes(body.mixes || []),
      links: body.links || [],
      published: true,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  revalidateReleases();
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
      custom_sections: sanitizeCustomSections(body.custom_sections),
      rider: body.rider || null,
      photo_url: body.photo_urls?.length ? body.photo_urls[0] : (body.photo_url || null),
      photo_urls: body.photo_urls || [],
      logo_urls: body.logo_urls || [],
      socials: body.socials || [],
      mixes: await enrichMixes(body.mixes || []),
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

  revalidateReleases();
  return NextResponse.json({ presskit: data });
}
