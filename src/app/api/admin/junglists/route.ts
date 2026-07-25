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


// GET — lista TODOS los junglists (solo admin). Un DJ SIEMPRE es junglist
// (DJ ⊃ junglist), pero vive en pk_profiles, no en la tabla junglists. Así que la
// lista = junglists ∪ pk_profiles, deduplicada por email. Si un email está en las
// dos, es DJ (el DJ manda). Cada fila trae `isDj` para diferenciarlos en la UI.
export async function GET() {
  const cookieStore = await cookies();
  const supabase = createSupabaseServer(cookieStore);

  const { isAdmin } = await verifyAdmin(supabase);
  if (!isAdmin) {
    return NextResponse.json({ junglists: [], error: 'No autorizado' }, { status: 403 });
  }

  const [{ data: junglists, error }, { data: pkProfiles }, { data: presskits }] = await Promise.all([
    supabase.from('junglists').select('*'),
    supabase.from('pk_profiles').select('user_id, email, created_at, slug'),
    supabase.from('presskits').select('user_id, artist_name, real_name, socials'),
  ]);

  if (error) {
    return NextResponse.json({ junglists: [], error: error.message }, { status: 500 });
  }

  // presskit por user_id (para nombre/instagram del DJ).
  const pkByUser = new Map(
    (presskits || []).map((p) => [p.user_id as string, p as Record<string, unknown>])
  );

  // Merge por email en minúscula. El junglist trae datos ricos (nombre/instagram
  // que el usuario cargó); el DJ, los del presskit.
  const byEmail = new Map<string, Record<string, unknown>>();
  for (const j of junglists || []) {
    byEmail.set(String(j.email).toLowerCase(), { ...j, isDj: false });
  }
  for (const pk of pkProfiles || []) {
    const email = String(pk.email || '').toLowerCase();
    if (!email) continue;
    const presskit = pkByUser.get(pk.user_id as string);
    const djName = (presskit?.artist_name as string)?.trim() || ''; // AKA (artístico)
    const djRealName = (presskit?.real_name as string)?.trim() || ''; // nombre real
    // Un DJ solo cuenta como tal si tiene un presskit REAL con lo mínimo (AKA +
    // nombre real). Tener sólo la cuenta pk_profiles sin presskit no lo hace DJ:
    // en ese caso queda como junglist (si tiene fila) o simplemente no aparece.
    const isDj = Boolean(presskit && djName && djRealName);
    const existing = byEmail.get(email);
    if (existing) {
      if (isDj) {
        // Es junglist Y dj → dj. Sube los datos del presskit (AKA, nombre real,
        // slug) por sobre lo que cargó como junglist, así "Editar presskit"
        // tiene slug y la columna "Nombre de DJ" muestra el AKA, no el nombre.
        const socials = (presskit?.socials as { platform?: string; url?: string }[]) || [];
        const ig = socials.find((s) => /instagram/i.test(s.platform || ''));
        existing.isDj = true;
        existing.slug = pk.slug || null;
        existing.name = djName;
        existing.last_name = djRealName;
        if (ig?.url) existing.instagram = ig.url;
      }
      continue; // sin presskit válido → se queda como junglist
    }
    if (!isDj) continue; // cuenta pk_profiles incompleta y sin fila junglist → no se lista
    const socials = (presskit?.socials as { platform?: string; url?: string }[]) || [];
    const ig = socials.find((s) => /instagram/i.test(s.platform || ''));
    byEmail.set(email, {
      id: pk.user_id, // sin fila en junglists → no borrable acá
      user_id: pk.user_id,
      name: djName,
      last_name: djRealName,
      email: pk.email,
      instagram: ig?.url || '',
      slug: pk.slug || null,
      created_at: pk.created_at,
      isDj: true,
    });
  }

  const merged = [...byEmail.values()].sort((a, b) =>
    String(a.created_at) < String(b.created_at) ? 1 : -1
  );

  return NextResponse.json({ junglists: merged });
}

// DELETE — un admin elimina un junglist por id.
export async function DELETE(request: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createSupabaseServer(cookieStore);

  const { isAdmin } = await verifyAdmin(supabase);
  if (!isAdmin) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'ID requerido' }, { status: 400 });
  }

  const { error } = await supabase.from('junglists').delete().eq('id', id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
