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
    return NextResponse.json({ subscribers: [], error: 'No autorizado' }, { status: 403 });
  }

  const { data, error } = await supabase
    .from('newsletter_subscribers')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ subscribers: [], error: error.message }, { status: 500 });
  }

  return NextResponse.json({ subscribers: data });
}

interface ImportRow {
  name?: string;
  last_name?: string;
  email: string;
  instagram?: string;
}

interface RowResult {
  email: string;
  status: 'inserted' | 'updated' | 'error';
  error?: string;
}

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createSupabaseServer(cookieStore);

  const { isAdmin } = await verifyAdmin(supabase);
  if (!isAdmin) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const body = await request.json();
  const rows: ImportRow[] = body.rows;

  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: 'No se proporcionaron filas' }, { status: 400 });
  }

  const results: RowResult[] = [];

  for (const row of rows) {
    const email = row.email?.trim().toLowerCase();
    if (!email) {
      results.push({ email: row.email || '', status: 'error', error: 'Email vacio' });
      continue;
    }

    // Check if exists
    const { data: existing } = await supabase
      .from('newsletter_subscribers')
      .select('id')
      .eq('email', email)
      .single();

    if (existing) {
      // Update
      const { error } = await supabase
        .from('newsletter_subscribers')
        .update({
          name: row.name?.trim() || null,
          last_name: row.last_name?.trim() || null,
          instagram: row.instagram?.trim() || null,
        })
        .eq('id', existing.id);

      if (error) {
        results.push({ email, status: 'error', error: error.message });
      } else {
        results.push({ email, status: 'updated' });
      }
    } else {
      // Insert
      const { error } = await supabase
        .from('newsletter_subscribers')
        .insert({
          name: row.name?.trim() || null,
          last_name: row.last_name?.trim() || null,
          email,
          instagram: row.instagram?.trim() || null,
        });

      if (error) {
        results.push({ email, status: 'error', error: error.message });
      } else {
        results.push({ email, status: 'inserted' });
      }
    }
  }

  const inserted = results.filter(r => r.status === 'inserted').length;
  const updated = results.filter(r => r.status === 'updated').length;
  const errors = results.filter(r => r.status === 'error').length;

  return NextResponse.json({ results, summary: { inserted, updated, errors } });
}
