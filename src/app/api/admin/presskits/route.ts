import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

function createSupabaseServer(cookieStore: Awaited<ReturnType<typeof cookies>>) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // ignored in Server Components
          }
        },
      },
    }
  );
}

async function verifyAdmin(supabase: ReturnType<typeof createSupabaseServer>) {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { user: null, isAdmin: false };

  const { data: adminProfile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('user_id', user.id)
    .single();

  return { user, isAdmin: adminProfile?.is_admin === true };
}

export async function GET() {
  const cookieStore = await cookies();
  const supabase = createSupabaseServer(cookieStore);

  const { isAdmin } = await verifyAdmin(supabase);
  if (!isAdmin) {
    return NextResponse.json({ presskits: [], error: 'No autorizado' }, { status: 403 });
  }

  // Get presskits joined with pk_profiles for slug
  const { data: presskits, error: pkError } = await supabase
    .from('presskits')
    .select('*')
    .order('created_at', { ascending: false });

  if (pkError) {
    return NextResponse.json({ presskits: [], error: pkError.message }, { status: 500 });
  }

  // Get all pk_profiles to map user_id -> slug
  const { data: profiles } = await supabase
    .from('pk_profiles')
    .select('user_id, slug');

  const slugMap = new Map((profiles || []).map((p) => [p.user_id, p.slug]));

  const enriched = (presskits || []).map((pk) => ({
    ...pk,
    slug: slugMap.get(pk.user_id) || null,
  }));

  return NextResponse.json({ presskits: enriched });
}

export async function PATCH(request: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createSupabaseServer(cookieStore);

  const { isAdmin } = await verifyAdmin(supabase);
  if (!isAdmin) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const body = await request.json();
  const { id, ...fields } = body;

  if (!id || typeof id !== 'string') {
    return NextResponse.json({ error: 'ID requerido' }, { status: 400 });
  }

  const allowed = ['artist_name', 'real_name', 'city', 'country', 'bio', 'published'];
  const updateData: Record<string, unknown> = {};
  for (const key of Object.keys(fields)) {
    if (allowed.includes(key)) {
      updateData[key] = fields[key];
    }
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: 'No hay campos para actualizar' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('presskits')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ presskit: data });
}

export async function DELETE(request: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createSupabaseServer(cookieStore);

  const { isAdmin } = await verifyAdmin(supabase);
  if (!isAdmin) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  const userId = searchParams.get('user_id');

  if (!id) {
    return NextResponse.json({ error: 'ID requerido' }, { status: 400 });
  }

  // Delete presskit
  const { error: pkError } = await supabase
    .from('presskits')
    .delete()
    .eq('id', id);

  if (pkError) {
    return NextResponse.json({ error: pkError.message }, { status: 500 });
  }

  // Also delete the pk_profile if user_id provided
  if (userId) {
    await supabase
      .from('pk_profiles')
      .delete()
      .eq('user_id', userId);
  }

  return NextResponse.json({ success: true });
}
