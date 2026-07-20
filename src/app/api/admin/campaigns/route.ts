import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { revalidatePath } from 'next/cache';
import { buildEmailHtml } from '@/src/lib/emailTemplate';
import { resolveCoupon, segmentBody, segmentSubject } from '@/src/lib/campaignCopy';
import { BASE_URL } from '@/src/constants';

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

async function getEmailsByAudiences(
  supabase: ReturnType<typeof createSupabaseServer>,
  audiences: string[]
) {
  const allEmails = new Set<string>();
  const counts: Record<string, number> = {};

  if (audiences.includes('ravers')) {
    const { data, error } = await supabase
      .from('newsletter_subscribers')
      .select('email');
    if (!error && data) {
      const emails = data.map(r => r.email?.toLowerCase()).filter(Boolean) as string[];
      counts.ravers = emails.length;
      emails.forEach(e => allEmails.add(e));
    }
  }

  if (audiences.includes('registered')) {
    const { data, error } = await supabase
      .from('profiles')
      .select('email');
    if (!error && data) {
      const emails = data.map(r => r.email?.toLowerCase()).filter(Boolean) as string[];
      counts.registered = emails.length;
      emails.forEach(e => allEmails.add(e));
    }
  }

  if (audiences.includes('pks')) {
    const { data, error } = await supabase
      .from('pk_profiles')
      .select('email');
    if (!error && data) {
      const emails = data.map(r => r.email?.toLowerCase()).filter(Boolean) as string[];
      counts.pks = emails.length;
      emails.forEach(e => allEmails.add(e));
    }
  }

  if (audiences.includes('junglists')) {
    const { data, error } = await supabase
      .from('junglists')
      .select('email');
    if (!error && data) {
      const emails = data.map(r => r.email?.toLowerCase()).filter(Boolean) as string[];
      counts.junglists = emails.length;
      emails.forEach(e => allEmails.add(e));
    }
  }

  return { emails: Array.from(allEmails), counts, totalUnique: allEmails.size };
}

// Quiénes YA son junglists, sin importar qué audiencias se hayan seleccionado:
// junglists ∪ DJs (un DJ es siempre junglist). Sirve para decidir, al enviar,
// qué copy le toca a cada correo.
async function getJunglistEmails(supabase: ReturnType<typeof createSupabaseServer>) {
  const [jungRes, pkRes] = await Promise.all([
    supabase.from('junglists').select('email'),
    supabase.from('pk_profiles').select('email'),
  ]);
  const set = new Set<string>();
  for (const res of [jungRes, pkRes]) {
    res.data?.forEach(r => {
      if (r.email) set.add(r.email.toLowerCase());
    });
  }
  return set;
}

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createSupabaseServer(cookieStore);

  const { isAdmin } = await verifyAdmin(supabase);
  if (!isAdmin) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);

  // Email search mode
  const search = searchParams.get('search');
  if (search && search.length >= 2) {
    const query = search.toLowerCase();
    const [subRes, profRes, pkRes, jungRes] = await Promise.all([
      supabase.from('newsletter_subscribers').select('email').ilike('email', `%${query}%`).limit(20),
      supabase.from('profiles').select('email').ilike('email', `%${query}%`).limit(20),
      supabase.from('pk_profiles').select('email').ilike('email', `%${query}%`).limit(20),
      supabase.from('junglists').select('email').ilike('email', `%${query}%`).limit(20),
    ]);

    const allEmails = new Set<string>();
    for (const res of [subRes, profRes, pkRes, jungRes]) {
      if (!res.error && res.data) {
        res.data.forEach(r => {
          if (r.email) allEmails.add(r.email.toLowerCase());
        });
      }
    }

    return NextResponse.json({ results: Array.from(allEmails).slice(0, 20) });
  }

  // Historial: lista de campañas enviadas.
  if (searchParams.get('list') === '1') {
    const { data, error } = await supabase
      .from('campaigns')
      .select('id, name, template, event_id, subject, coupon_mode, coupon_new_code, coupon_existing_code, audiences, recipients, sent_count, failed_count, status, sent_at, created_at')
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) return NextResponse.json({ campaigns: [], error: error.message }, { status: 500 });
    return NextResponse.json({ campaigns: data || [] });
  }

  // Detalle de una campaña + sus destinatarios.
  const campaignId = searchParams.get('campaign');
  if (campaignId) {
    const [{ data: campaign }, { data: recipients }] = await Promise.all([
      supabase.from('campaigns').select('*').eq('id', campaignId).maybeSingle(),
      supabase
        .from('campaign_recipients')
        .select('email, status, segment, opened_at, visited_at, visit_count')
        .eq('campaign_id', campaignId)
        .order('email'),
    ]);
    if (!campaign) return NextResponse.json({ error: 'Campaña no encontrada' }, { status: 404 });
    return NextResponse.json({ campaign, recipients: recipients || [] });
  }

  // Audience counts mode
  const audiences = searchParams.get('audiences')?.split(',').filter(Boolean) || [];

  const { counts, totalUnique } = await getEmailsByAudiences(supabase, audiences);

  return NextResponse.json({ counts, totalUnique });
}

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createSupabaseServer(cookieStore);

  const { isAdmin } = await verifyAdmin(supabase);
  if (!isAdmin) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'RESEND_API_KEY no configurada' }, { status: 500 });
  }

  const body = await request.json();
  const {
    audiences,
    extraEmails: extraEmailsList,
    name,
    template,
    eventId,
    subject,
    title,
    bodyHtml,
    imageBase64,
    buttonText,
    buttonUrl,
    coupon,
    segmentBodies,
    segmentSubjects,
  } = body as {
    audiences: string[];
    extraEmails?: string[];
    name?: string;
    template?: string;
    eventId?: string | null;
    subject: string;
    title: string;
    bodyHtml: string;
    imageBase64?: string;
    buttonText?: string;
    buttonUrl?: string;
    coupon?: {
      enabled: boolean;
      /** A quién le corresponde el descuento. */
      target?: 'both' | 'new_only' | 'existing_only';
      /** Solo aplica con target 'both': un mismo código o uno por segmento. */
      sameForAll?: boolean;
      newCode?: string;
      existingCode?: string;
    };
    /** Cuerpo/asunto editados a mano por segmento; si vienen, mandan sobre el copy por defecto. */
    segmentBodies?: Record<string, string>;
    segmentSubjects?: Record<string, string>;
  };

  if (!subject || !title) {
    return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 });
  }

  const { emails: audienceEmails } = await getEmailsByAudiences(supabase, audiences || []);

  // Merge audience emails with extra individual emails, deduplicated
  const allEmailsSet = new Set(audienceEmails);
  if (extraEmailsList?.length) {
    extraEmailsList.forEach(e => allEmailsSet.add(e.toLowerCase()));
  }
  const emails = Array.from(allEmailsSet);

  if (emails.length === 0) {
    return NextResponse.json({ error: 'No hay destinatarios' }, { status: 400 });
  }

  const fromEmail = process.env.RESEND_FROM_EMAIL || 'Drum and Bass Chile <info@drumandbasschile.cl>';
  const resend = new Resend(apiKey);

  // ── Cupones ──────────────────────────────────────────────────────────────
  // El admin elige explícitamente a quién va el descuento. Sin fallback entre
  // segmentos: una columna vacía significa "a este segmento no le corresponde",
  // y por eso su correo no menciona descuento alguno.
  const couponEnabled = Boolean(coupon?.enabled) && Boolean(eventId);
  const target = coupon?.target ?? 'both';
  const sameForAll = coupon?.sameForAll ?? true;
  const rawNew = coupon?.newCode?.trim() || '';
  const rawExisting = coupon?.existingCode?.trim() || '';

  const { newCode, existingCode } = resolveCoupon({
    enabled: couponEnabled,
    target,
    sameForAll,
    newCode: rawNew,
    existingCode: rawExisting,
  });

  const couponMode = !couponEnabled
    ? 'none'
    : target === 'both'
      ? sameForAll ? 'both_same' : 'both_split'
      : target;

  // Quién recibe la promesa de descuento en su correo: solo quien tiene código.
  const junglistGetsCoupon = Boolean(existingCode);
  const nonJunglistGetsCoupon = Boolean(newCode);

  // Los cupones viven en el EVENTO (la landing los sirve contra sesión).
  // coupon_set_at es el corte: quien se inscriba después cuenta como nuevo.
  if (couponEnabled && eventId) {
    await supabase
      .from('cms_events')
      .update({
        coupon_junglist_new: newCode || null,
        coupon_junglist: existingCode || null,
        coupon_set_at: new Date().toISOString(),
      })
      .eq('id', eventId);
    revalidatePath(`/evento/${eventId}`);
  }

  // 1) Persistimos la campaña (obtenemos su id, que sirve como campaign_id).
  const { data: campaign, error: campaignError } = await supabase
    .from('campaigns')
    .insert({
      name: name || null,
      template: template || null,
      event_id: eventId || null,
      subject,
      title: title || null,
      body_html: bodyHtml || null,
      image_url: imageBase64 || null,
      button_text: buttonText || null,
      button_url: buttonUrl || null,
      coupon_mode: couponMode,
      coupon_new_code: newCode || null,
      coupon_existing_code: existingCode || null,
      audiences: audiences || [],
      recipients: emails.length,
      status: 'sent',
      sent_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (campaignError || !campaign) {
    return NextResponse.json(
      { error: `No se pudo guardar la campaña: ${campaignError?.message ?? 'desconocido'}` },
      { status: 500 }
    );
  }
  const campaignId = campaign.id as string;

  // En dev las URLs del correo apuntan al server local (localhost:3600) para poder
  // probar el tracking; en prod, al dominio real. Reescribimos solo los links a
  // NUESTRO dominio (los externos, p. ej. una ticketera, quedan intactos).
  const appOrigin = process.env.NODE_ENV === 'development' ? 'http://localhost:3600' : BASE_URL;
  const localButtonUrl = (buttonUrl || '').replace(BASE_URL, appOrigin);

  // Cada destinatario tiene un id (uuid) que viaja en el link (?ct=<id>) y en el
  // pixel de apertura → medimos con NUESTRO tracking (no GA) quién abrió y quién
  // clickeó. El id es la PK de su fila: sin token ni columna extra.
  const withCt = (base: string, recId: string) => {
    if (!base) return '';
    const sep = base.includes('?') ? '&' : '?';
    return `${base}${sep}ct=${recId}&utm_source=email&utm_campaign=${campaignId}`;
  };
  const pixelUrl = (recId: string) => `${appOrigin}/api/campaign-open?ct=${recId}`;

  // 2) Segmentamos: el correo depende del estado de registro de cada destinatario.
  //    Quien ya es junglist y tiene cupón, recibe "tu descuento te espera"; quien
  //    no lo es, "inscríbete y accede al descuento". Si a un segmento no le
  //    corresponde descuento (p. ej. el cupón es solo para junglists nuevos),
  //    recibe el correo normal, sin prometer nada que no pueda canjear.
  const junglistSet = couponEnabled ? await getJunglistEmails(supabase) : new Set<string>();
  const segments = [
    {
      key: 'junglist' as const,
      emails: couponEnabled ? emails.filter(e => junglistSet.has(e)) : [],
      withCoupon: junglistGetsCoupon,
    },
    {
      key: 'no_junglist' as const,
      // Sin cupón no hay nada que segmentar: todos reciben el mismo correo.
      emails: couponEnabled ? emails.filter(e => !junglistSet.has(e)) : emails,
      withCoupon: nonJunglistGetsCoupon,
    },
  ];

  // 3) Enviamos por lotes (Resend: máx 100 por llamada), un html por destinatario
  //    (link + pixel con su id), y registramos el resend_id para los webhooks (Fase B).
  const BATCH_SIZE = 100;
  const results: { sent: number; failed: number; errors: string[] } = { sent: 0, failed: 0, errors: [] };
  const recipientRows: { id: string; campaign_id: string; email: string; resend_id: string | null; status: string; segment: string }[] = [];

  for (const segment of segments) {
    if (segment.emails.length === 0) continue;

    const useCoupon = couponEnabled && segment.withCoupon;
    // Si el admin editó el correo de este segmento, se usa tal cual.
    const bodyForSegment = segmentBodies?.[segment.key] ?? segmentBody(bodyHtml, segment.key, useCoupon);
    const subjectForSegment = segmentSubjects?.[segment.key] ?? segmentSubject(subject, title, useCoupon);

    for (let i = 0; i < segment.emails.length; i += BATCH_SIZE) {
      const batch = segment.emails.slice(i, i + BATCH_SIZE);
      const recIds = batch.map(() => crypto.randomUUID());
      const batchPayload = batch.map((to, j) => ({
        from: fromEmail,
        to,
        subject: subjectForSegment,
        html: buildEmailHtml({
          title,
          body: bodyForSegment,
          imageBase64,
          buttonText,
          buttonUrl: withCt(localButtonUrl, recIds[j]) || undefined,
          trackingPixelUrl: pixelUrl(recIds[j]),
        }),
      }));

      const push = (resendIds: { id: string }[] | null, status: string) =>
        batch.forEach((email, j) =>
          recipientRows.push({
            id: recIds[j],
            campaign_id: campaignId,
            email,
            resend_id: resendIds?.[j]?.id ?? null,
            status,
            segment: segment.key,
          })
        );

      try {
        const { data, error } = await resend.batch.send(batchPayload);
        if (error) {
          results.failed += batch.length;
          results.errors.push(error.message);
          push(null, 'failed');
        } else {
          const ids = data?.data ?? [];
          results.sent += ids.length || batch.length;
          push(ids, 'sent');
        }
      } catch (err) {
        results.failed += batch.length;
        results.errors.push(err instanceof Error ? err.message : 'Error desconocido');
        push(null, 'failed');
      }
    }
  }

  // 3) Guardamos los destinatarios (en trozos) y actualizamos los conteos.
  for (let i = 0; i < recipientRows.length; i += 500) {
    await supabase.from('campaign_recipients').insert(recipientRows.slice(i, i + 500));
  }
  await supabase
    .from('campaigns')
    .update({ sent_count: results.sent, failed_count: results.failed })
    .eq('id', campaignId);

  return NextResponse.json({
    success: results.failed === 0,
    campaignId,
    sent: results.sent,
    failed: results.failed,
    total: emails.length,
    errors: results.errors,
  });
}
