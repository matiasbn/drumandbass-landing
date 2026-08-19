import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { verifyAdmin } from '@/src/lib/authz';
import { enrichFeaturedReleaseDates } from '@/src/lib/soundcloud';
import { BASE_URL } from '@/src/constants';
import type { PendingPresskitData } from '@/src/types/pendingPresskit';
import type { PresskitMix } from '@/src/types/presskit';

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
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            /* ignored in Server Components */
          }
        },
      },
    }
  );
}

// Normaliza la data del presskit que manda el admin (defensivo + enriquece las
// fechas de los releases de SoundCloud, igual que /api/pk).
async function normalizeData(input: Partial<PendingPresskitData>): Promise<PendingPresskitData> {
  const arr = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
  const mixes = await enrichFeaturedReleaseDates(arr<PresskitMix>(input.mixes));
  return {
    artist_name: (input.artist_name || '').trim(),
    real_name: input.real_name?.trim() || null,
    city: input.city?.trim() || null,
    country: input.country?.trim() || null,
    genres: arr<string>(input.genres).map((g) => g.trim()).filter(Boolean),
    bio: input.bio?.trim() || null,
    custom_sections: arr<{ title: string; body: string }>(input.custom_sections)
      .map((s) => ({ title: (s.title || '').trim(), body: (s.body || '').trim() }))
      .filter((s) => s.title && s.body),
    rider: input.rider ?? null,
    photo_urls: arr<string>(input.photo_urls),
    logo_urls: arr<string>(input.logo_urls),
    socials: arr(input.socials),
    mixes,
    links: arr<{ title: string; url: string }>(input.links).filter((l) => l.title?.trim() && l.url?.trim()),
  };
}

export async function GET(req: NextRequest) {
  const supabase = createSupabaseServer(await cookies());
  const { isAdmin } = await verifyAdmin(supabase);
  if (!isAdmin) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const id = req.nextUrl.searchParams.get('id');
  if (id) {
    const { data, error } = await supabase.from('pending_presskits').select('*').eq('id', id).single();
    if (error) return NextResponse.json({ error: error.message }, { status: 404 });
    return NextResponse.json({ pending: data });
  }

  const { data, error } = await supabase
    .from('pending_presskits')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ pending: data || [] });
}

export async function POST(req: NextRequest) {
  const supabase = createSupabaseServer(await cookies());
  const { user, isAdmin } = await verifyAdmin(supabase);
  if (!isAdmin || !user) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const body = await req.json();

  // Acción "invite": manda (o reenvía) el correo de invitación al DJ.
  if (body.action === 'invite') {
    return sendInvite(supabase, body.id);
  }

  // Crear un nuevo pendiente.
  const email = (body.email || '').trim().toLowerCase();
  const slug = (body.slug || '').trim().toLowerCase();
  if (!email || !slug) {
    return NextResponse.json({ error: 'Faltan email o slug' }, { status: 400 });
  }
  const data = await normalizeData(body.data || {});
  const { data: row, error } = await supabase
    .from('pending_presskits')
    .insert({ email, slug, data, created_by: user.id })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ pending: row });
}

export async function PUT(req: NextRequest) {
  const supabase = createSupabaseServer(await cookies());
  const { isAdmin } = await verifyAdmin(supabase);
  if (!isAdmin) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const body = await req.json();
  if (!body.id) return NextResponse.json({ error: 'Falta id' }, { status: 400 });

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body.email === 'string') patch.email = body.email.trim().toLowerCase();
  if (typeof body.slug === 'string') patch.slug = body.slug.trim().toLowerCase();
  if (body.data) patch.data = await normalizeData(body.data);

  const { data: row, error } = await supabase
    .from('pending_presskits')
    .update(patch)
    .eq('id', body.id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ pending: row });
}

export async function DELETE(req: NextRequest) {
  const supabase = createSupabaseServer(await cookies());
  const { isAdmin } = await verifyAdmin(supabase);
  if (!isAdmin) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Falta id' }, { status: 400 });
  const { error } = await supabase.from('pending_presskits').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

async function sendInvite(supabase: ReturnType<typeof createSupabaseServer>, id: string) {
  if (!id) return NextResponse.json({ error: 'Falta id' }, { status: 400 });
  const { data: row, error } = await supabase.from('pending_presskits').select('*').eq('id', id).single();
  if (error || !row) return NextResponse.json({ error: 'Pendiente no encontrado' }, { status: 404 });
  if (row.status !== 'pending') {
    return NextResponse.json({ error: 'Este presskit ya no está pendiente' }, { status: 409 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'Resend no configurado' }, { status: 500 });
  const resend = new Resend(apiKey);
  const fromEmail = process.env.RESEND_FROM_EMAIL || 'Drum and Bass Chile <info@drumandbasschile.cl>';
  const appOrigin = process.env.NODE_ENV === 'development' ? 'http://localhost:3600' : BASE_URL;
  const claimUrl = `${appOrigin}/pk/claim?token=${row.claim_token}`;
  const artist = row.data?.artist_name || 'tu proyecto';

  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#111">
      <div style="background:#000;color:#fff;padding:20px 24px;border:4px solid #000">
        <h1 style="margin:0;font-size:22px;text-transform:uppercase;letter-spacing:-.5px">Drum and Bass Chile</h1>
      </div>
      <div style="border:4px solid #000;border-top:0;padding:24px">
        <h2 style="margin:0 0 12px;font-size:20px;text-transform:uppercase">Tienes un presskit pendiente</h2>
        <p style="font-size:15px;line-height:1.6">Hola, en Drum and Bass Chile te preparamos un presskit para <strong>${artist}</strong>.
        Para publicarlo solo tienes que revisarlo y confirmarlo con tu cuenta de Google.</p>
        <p style="font-size:15px;line-height:1.6">Cuando hagas clic abajo e inicies sesión, verificamos que este correo sea tuyo y tu presskit queda publicado al instante — después puedes editarlo cuando quieras.</p>
        <p style="text-align:center;margin:28px 0">
          <a href="${claimUrl}" style="display:inline-block;background:#ff0055;color:#fff;text-decoration:none;font-weight:bold;text-transform:uppercase;padding:14px 28px;border:4px solid #000">Revisar y publicar mi presskit</a>
        </p>
        <p style="font-size:12px;color:#666;line-height:1.6">Si no esperabas este correo, puedes ignorarlo. El presskit no se publica hasta que tú lo confirmes con tu cuenta.</p>
      </div>
    </div>`;

  const { error: sendError } = await resend.emails.send({
    from: fromEmail,
    to: row.email,
    subject: 'Tienes un presskit pendiente de aprobación — Drum and Bass Chile',
    html,
  });
  if (sendError) return NextResponse.json({ error: sendError.message }, { status: 502 });

  await supabase.from('pending_presskits').update({ invited_at: new Date().toISOString() }).eq('id', id);
  return NextResponse.json({ ok: true });
}
