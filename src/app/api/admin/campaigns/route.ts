import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { buildEmailHtml } from '@/src/lib/emailTemplate';
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
      .select('id, name, template, event_id, subject, coupon_code, audiences, recipients, sent_count, failed_count, status, sent_at, created_at')
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
        .select('email, status, opened_at, visited_at, visit_count')
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
    couponCode,
    couponDescription,
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
    couponCode?: string;
    couponDescription?: string;
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
      coupon_code: couponCode || null,
      coupon_description: couponDescription || null,
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

  // 2) Enviamos por lotes (Resend: máx 100 por llamada), un html por destinatario
  //    (link + pixel con su id), y registramos el resend_id para los webhooks (Fase B).
  const BATCH_SIZE = 100;
  const results: { sent: number; failed: number; errors: string[] } = { sent: 0, failed: 0, errors: [] };
  const recipientRows: { id: string; campaign_id: string; email: string; resend_id: string | null; status: string }[] = [];

  for (let i = 0; i < emails.length; i += BATCH_SIZE) {
    const batch = emails.slice(i, i + BATCH_SIZE);
    const recIds = batch.map(() => crypto.randomUUID());
    const batchPayload = batch.map((to, j) => ({
      from: fromEmail,
      to,
      subject,
      html: buildEmailHtml({
        title,
        body: bodyHtml,
        imageBase64,
        buttonText,
        buttonUrl: withCt(localButtonUrl, recIds[j]) || undefined,
        trackingPixelUrl: pixelUrl(recIds[j]),
      }),
    }));

    try {
      const { data, error } = await resend.batch.send(batchPayload);
      if (error) {
        results.failed += batch.length;
        results.errors.push(error.message);
        batch.forEach((email, j) =>
          recipientRows.push({ id: recIds[j], campaign_id: campaignId, email, resend_id: null, status: 'failed' })
        );
      } else {
        const ids = data?.data ?? [];
        results.sent += ids.length || batch.length;
        batch.forEach((email, j) =>
          recipientRows.push({ id: recIds[j], campaign_id: campaignId, email, resend_id: ids[j]?.id ?? null, status: 'sent' })
        );
      }
    } catch (err) {
      results.failed += batch.length;
      results.errors.push(err instanceof Error ? err.message : 'Error desconocido');
      batch.forEach((email, j) =>
        recipientRows.push({ id: recIds[j], campaign_id: campaignId, email, resend_id: null, status: 'failed' })
      );
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
