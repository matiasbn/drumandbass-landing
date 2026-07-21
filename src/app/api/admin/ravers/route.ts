import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin } from '@/src/lib/authz';

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


export async function GET() {
  const cookieStore = await cookies();
  const supabase = createSupabaseServer(cookieStore);

  const { isAdmin } = await verifyAdmin(supabase);
  if (!isAdmin) {
    return NextResponse.json({ subscribers: [], error: 'No autorizado' }, { status: 403 });
  }

  const [subscribersRes, profilesRes, pkProfilesRes] = await Promise.all([
    supabase.from('newsletter_subscribers').select('*').order('created_at', { ascending: false }),
    supabase.from('profiles').select('email'),
    supabase.from('pk_profiles').select('email'),
  ]);

  if (subscribersRes.error) {
    return NextResponse.json({ subscribers: [], error: subscribersRes.error.message }, { status: 500 });
  }

  const registeredEmails = new Set(
    (profilesRes.data || []).map((p) => p.email?.toLowerCase()).filter(Boolean)
  );
  const pkEmails = new Set(
    (pkProfilesRes.data || []).map((p) => p.email?.toLowerCase()).filter(Boolean)
  );

  const enriched = (subscribersRes.data || []).map((sub) => ({
    ...sub,
    is_registered: registeredEmails.has(sub.email?.toLowerCase()),
    is_pk: pkEmails.has(sub.email?.toLowerCase()),
  }));

  return NextResponse.json({ subscribers: enriched });
}

interface ImportRow {
  name?: string;
  last_name?: string;
  email: string;
  instagram?: string;
}

interface RowResult {
  email: string;
  status: 'inserted' | 'updated' | 'skipped' | 'error';
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

  // Listas disjuntas: los correos que ya son junglists o DJs (pk_profiles) no se
  // importan a la lista de correos — se ignoran y se reportan como ya registrados.
  const [junglistRows, pkRows] = await Promise.all([
    supabase.from('junglists').select('email'),
    supabase.from('pk_profiles').select('email'),
  ]);
  const junglistEmails = new Set(
    (junglistRows.data || []).map((j) => j.email?.toLowerCase()).filter(Boolean)
  );
  const djEmails = new Set(
    (pkRows.data || []).map((p) => p.email?.toLowerCase()).filter(Boolean)
  );

  for (const row of rows) {
    const email = row.email?.trim().toLowerCase();
    if (!email) {
      results.push({ email: row.email || '', status: 'error', error: 'Email vacio' });
      continue;
    }

    if (junglistEmails.has(email)) {
      results.push({ email, status: 'skipped', error: 'Ya es junglist' });
      continue;
    }
    if (djEmails.has(email)) {
      results.push({ email, status: 'skipped', error: 'Ya es DJ' });
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
  const skipped = results.filter(r => r.status === 'skipped').length;
  const errors = results.filter(r => r.status === 'error').length;

  return NextResponse.json({ results, summary: { inserted, updated, skipped, errors } });
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

  const allowed = ['name', 'last_name', 'email', 'instagram'];
  const updateData: Record<string, unknown> = {};
  for (const key of Object.keys(fields)) {
    if (allowed.includes(key)) {
      updateData[key] = fields[key]?.trim() || null;
    }
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: 'No hay campos para actualizar' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('newsletter_subscribers')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ subscriber: data });
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
  const consolidate = searchParams.get('consolidate');

  // Consolidar: borra de "correos" los que YA son junglists o DJs, para que la
  // lista quede solo con quienes no están en ninguna de esas categorías (las
  // listas son disjuntas). Las tres audiencias se cruzan por email.
  if (consolidate === '1') {
    const [jungRes, pkRes] = await Promise.all([
      supabase.from('junglists').select('email'),
      supabase.from('pk_profiles').select('email'),
    ]);
    const taken = new Set<string>();
    for (const r of [...(jungRes.data || []), ...(pkRes.data || [])]) {
      if (r.email) taken.add(r.email.toLowerCase());
    }

    const { data: subs, error: readErr } = await supabase
      .from('newsletter_subscribers')
      .select('id, email');
    if (readErr) return NextResponse.json({ error: readErr.message }, { status: 500 });

    const idsToRemove = (subs || [])
      .filter((s) => s.email && taken.has(s.email.toLowerCase()))
      .map((s) => s.id);

    if (idsToRemove.length > 0) {
      const { error } = await supabase
        .from('newsletter_subscribers')
        .delete()
        .in('id', idsToRemove);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, removed: idsToRemove.length });
  }

  if (!id) {
    return NextResponse.json({ error: 'ID requerido' }, { status: 400 });
  }

  const { error } = await supabase
    .from('newsletter_subscribers')
    .delete()
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
