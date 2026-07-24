import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { revalidatePath } from 'next/cache';
import { buildEmailHtml } from '@/src/lib/emailTemplate';
import { resolveCoupon, segmentBody, segmentSubject } from '@/src/lib/campaignCopy';
import { BASE_URL } from '@/src/constants';
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


async function getEmailsByAudiences(
  supabase: ReturnType<typeof createSupabaseServer>,
  audiences: string[]
) {
  const allEmails = new Set<string>();
  const counts: Record<string, number> = {};

  if (audiences.includes('ravers')) {
    // Se ignoran los que se dieron de baja (unsubscribed_at no nulo).
    const { data, error } = await supabase
      .from('newsletter_subscribers')
      .select('email')
      .is('unsubscribed_at', null);
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
      .select('email')
      .is('unsubscribed_at', null);
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
    supabase.from('junglists').select('email').is('unsubscribed_at', null),
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
      .select('id, name, template, event_id, subject, coupon_mode, coupon_new_code, coupon_existing_code, audiences, recipients, sent_count, failed_count, status, sent_at, created_at, parent_campaign_id')
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
        .select('id, email, status, segment, visited_at, visit_count')
        .eq('campaign_id', campaignId)
        .order('email'),
    ]);
    if (!campaign) return NextResponse.json({ error: 'Campaña no encontrada' }, { status: 404 });
    // Conteo real (línea completa) de a cuántos les reenviaría el botón "insistir".
    const t = await computeResendTargets(supabase, campaignId);
    const resendTarget = t.source ? t.targets.size : 0;
    // Acciones registradas (log genérico). Hoy: quién copió el cupón y cuándo.
    const { data: copyRows } = await supabase
      .from('campaign_actions')
      .select('recipient_id, at, campaign_recipients!inner(campaign_id)')
      .eq('action', 'coupon_copy')
      .eq('campaign_recipients.campaign_id', campaignId);
    const copyByRecipient = new Map<string, string>();
    for (const r of copyRows ?? []) copyByRecipient.set(r.recipient_id as string, r.at as string);
    const couponCopies = copyByRecipient.size;
    const firstCouponCopyAt = couponCopies
      ? [...copyByRecipient.values()].reduce((a, b) => (a < b ? a : b))
      : null;
    // Adjuntamos coupon_copy_at por destinatario (para verlo fila por fila).
    const recipientsOut = (recipients ?? []).map((r) => ({
      email: r.email,
      status: r.status,
      segment: r.segment,
      visited_at: r.visited_at,
      visit_count: r.visit_count,
      coupon_copy_at: copyByRecipient.get(r.id as string) ?? null,
    }));
    return NextResponse.json({
      campaign,
      recipients: recipientsOut,
      resendTarget,
      couponCopies,
      firstCouponCopyAt,
    });
  }

  // Audience counts mode
  const audiences = searchParams.get('audiences')?.split(',').filter(Boolean) || [];

  const { counts, totalUnique } = await getEmailsByAudiences(supabase, audiences);

  return NextResponse.json({ counts, totalUnique });
}

// Borra una campaña del historial. campaign_recipients cae por CASCADE (FK), así
// que se va también su tracking. Los cupones viven en el evento, no en la
// campaña, así que borrarla no toca el descuento vigente.
export async function DELETE(request: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createSupabaseServer(cookieStore);

  const { isAdmin } = await verifyAdmin(supabase);
  if (!isAdmin) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const id = new URL(request.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Falta id' }, { status: 400 });

  const { error } = await supabase.from('campaigns').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}

// Reenvía SOLO a los destinatarios que fallaron (típicamente por la cuota diaria
// de Resend: 100/día). Reconstruye el correo desde lo guardado en la campaña +
// el segmento de cada fila, reusa el mismo id (= ?ct de tracking), y manda por
// lotes de 100. Como la cuota es 100/día, un click manda hasta 100 y el resto
// queda 'failed' para el próximo día → así se cubre a todos en varios días.
async function resendFailedRecipients(
  supabase: ReturnType<typeof createSupabaseServer>,
  apiKey: string,
  campaignId: string
) {
  const { data: campaign } = await supabase
    .from('campaigns')
    .select('*')
    .eq('id', campaignId)
    .maybeSingle();
  if (!campaign) return NextResponse.json({ error: 'Campaña no encontrada' }, { status: 404 });

  const { data: failed } = await supabase
    .from('campaign_recipients')
    .select('id, email, segment')
    .eq('campaign_id', campaignId)
    .eq('status', 'failed');

  if (!failed || failed.length === 0) {
    return NextResponse.json({ success: true, resent: 0, stillFailed: 0 });
  }

  const resend = new Resend(apiKey);
  const fromEmail = process.env.RESEND_FROM_EMAIL || 'Drum and Bass Chile <info@drumandbasschile.cl>';
  const appOrigin = process.env.NODE_ENV === 'development' ? 'http://localhost:3600' : BASE_URL;
  const localButtonUrl = (campaign.button_url || '').replace(BASE_URL, appOrigin);

  const withCt = (base: string, recId: string) => {
    if (!base) return '';
    const sep = base.includes('?') ? '&' : '?';
    return `${base}${sep}ct=${recId}&utm_source=email&utm_campaign=${campaignId}`;
  };
  const unsubUrl = (email: string) => `${appOrigin}/api/unsubscribe?email=${encodeURIComponent(email)}`;

  const couponEnabled = !!campaign.coupon_mode && campaign.coupon_mode !== 'none';
  const newCode = campaign.coupon_new_code || '';
  const existingCode = campaign.coupon_existing_code || '';

  const BATCH_SIZE = 100;
  let resent = 0;
  const errors: string[] = [];

  for (let i = 0; i < failed.length; i += BATCH_SIZE) {
    const batch = failed.slice(i, i + BATCH_SIZE);
    const payload = batch.map((rec) => {
      const seg: 'junglist' | 'no_junglist' = rec.segment === 'junglist' ? 'junglist' : 'no_junglist';
      const hasCoupon = couponEnabled && (seg === 'junglist' ? !!existingCode : !!newCode);
      // Replicamos EXACTO lo que se envió (persistido por segmento). Fallback:
      // regenerar desde el template (campañas viejas sin segment_content).
      const saved = (campaign.segment_content as Record<string, { subject: string; body: string }> | null)?.[seg];
      return {
        from: fromEmail,
        to: rec.email,
        subject: saved?.subject ?? segmentSubject(campaign.subject, campaign.title || '', hasCoupon),
        html: buildEmailHtml({
          title: campaign.title || campaign.subject,
          body: saved?.body ?? segmentBody(campaign.body_html || '', seg, hasCoupon),
          imageBase64: campaign.image_url || undefined,
          buttonText: campaign.button_text || undefined,
          buttonUrl: withCt(localButtonUrl, rec.id) || undefined,
          unsubscribeUrl: unsubUrl(rec.email),
        }),
      };
    });

    try {
      const { data, error } = await resend.batch.send(payload);
      if (error) {
        errors.push(error.message);
      } else {
        // Los de este lote pasan de 'failed' a 'sent'.
        await supabase
          .from('campaign_recipients')
          .update({ status: 'sent' })
          .in('id', batch.map((r) => r.id));
        resent += data?.data?.length || batch.length;
      }
    } catch (err) {
      errors.push(err instanceof Error ? err.message : 'Error desconocido');
    }
  }

  // Recalcular los conteos de la campaña con el estado nuevo.
  const [{ count: okCount }, { count: failCount }] = await Promise.all([
    supabase.from('campaign_recipients').select('id', { count: 'exact', head: true }).eq('campaign_id', campaignId).neq('status', 'failed'),
    supabase.from('campaign_recipients').select('id', { count: 'exact', head: true }).eq('campaign_id', campaignId).eq('status', 'failed'),
  ]);
  await supabase
    .from('campaigns')
    .update({ sent_count: okCount ?? 0, failed_count: failCount ?? 0 })
    .eq('id', campaignId);

  return NextResponse.json({
    success: true,
    resent,
    stillFailed: (failCount ?? 0),
    errors: errors.slice(0, 3),
  });
}

// Lee el estado de entrega EN VIVO desde Resend (NO envía nada). Usa el endpoint
// de LISTA (/emails) paginado: trae `last_event` de a 100 por llamada y cruza por
// `resend_id`, así toda la campaña se resuelve en pocas requests (antes era una
// por destinatario → lento). Solo mueve los que están 'sent'/'opened' a
// 'delivered'/'bounced'/'complained'; nunca pisa 'clicked' (Visitó, nuestro
// token) ni 'failed'. 'delivery_delayed'/'queued' se dejan como 'sent' (en curso).
// La lista viene de más nueva a más vieja; se corta al pasar la fecha de la campaña.
async function syncFromResend(
  supabase: ReturnType<typeof createSupabaseServer>,
  apiKey: string,
  campaignId: string
) {
  const { data: recs } = await supabase
    .from('campaign_recipients')
    .select('id, resend_id')
    .eq('campaign_id', campaignId)
    .in('status', ['sent', 'opened'])
    .not('resend_id', 'is', null);

  if (!recs || recs.length === 0) {
    return NextResponse.json({ success: true, synced: 0, remaining: 0 });
  }

  const { data: camp } = await supabase
    .from('campaigns')
    .select('sent_at, created_at')
    .eq('id', campaignId)
    .maybeSingle();
  const floorMs =
    new Date(camp?.sent_at || camp?.created_at || 0).getTime() - 2 * 24 * 3600 * 1000;

  const wanted = new Map<string, string>(); // resend_id -> recipient id
  for (const r of recs) if (r.resend_id) wanted.set(r.resend_id as string, r.id);

  const eventById = new Map<string, string>(); // resend_id -> last_event
  let after = '';
  for (let page = 0; page < 60 && eventById.size < wanted.size; page++) {
    const url = new URL('https://api.resend.com/emails');
    url.searchParams.set('limit', '100');
    if (after) url.searchParams.set('after', after);
    let json: {
      data?: Array<{ id: string; last_event?: string; created_at?: string }>;
      has_more?: boolean;
    };
    try {
      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (!res.ok) break;
      json = await res.json();
    } catch {
      break;
    }
    const data = json.data ?? [];
    if (data.length === 0) break;
    let oldestMs = Infinity;
    for (const e of data) {
      if (wanted.has(e.id) && e.last_event) eventById.set(e.id, e.last_event);
      const t = e.created_at ? new Date(e.created_at.replace(' ', 'T')).getTime() : NaN;
      if (!Number.isNaN(t) && t < oldestMs) oldestMs = t;
    }
    after = data[data.length - 1].id;
    if (!json.has_more) break;
    if (oldestMs < floorMs) break;
  }

  const byStatus: Record<'delivered' | 'bounced' | 'complained', string[]> = {
    delivered: [],
    bounced: [],
    complained: [],
  };
  for (const [resendId, recId] of wanted) {
    const ev = eventById.get(resendId);
    if (!ev) continue;
    // 'opened'/'clicked' de Resend NO son interacción para nosotros (esa la da
    // nuestro token → 'Visitó'), pero implican que se entregó → cuentan como
    // 'delivered' (dato duro). Si no, subcontaríamos entregados.
    if (ev === 'bounced') byStatus.bounced.push(recId);
    else if (ev === 'complained') byStatus.complained.push(recId);
    else if (ev === 'delivered' || ev === 'opened' || ev === 'clicked') byStatus.delivered.push(recId);
  }

  for (const st of ['delivered', 'bounced', 'complained'] as const) {
    if (byStatus[st].length) {
      await supabase.from('campaign_recipients').update({ status: st }).in('id', byStatus[st]);
    }
  }

  const synced = byStatus.delivered.length + byStatus.bounced.length + byStatus.complained.length;
  const { count } = await supabase
    .from('campaign_recipients')
    .select('id', { count: 'exact', head: true })
    .eq('campaign_id', campaignId)
    .in('status', ['sent', 'opened'])
    .not('resend_id', 'is', null);

  return NextResponse.json({ success: true, synced, remaining: count ?? 0 });
}

// Calcula a quién reenviarle: los que recibieron la campaña RAÍZ pero NO
// interactuaron con NINGÚN correo de su línea (raíz + reenvíos). Una campaña
// "· Reenvío N" apunta a su raíz vía parent_campaign_id, así el conjunto se
// angosta correctamente en cada reenvío. "Abrir" por pixel no se mide (no es
// fiable): interacción = visita por token. Excluye a quien visitó cualquier
// correo de la línea, a rebotados/spam y a dados de baja.
async function computeResendTargets(
  supabase: ReturnType<typeof createSupabaseServer>,
  sourceId: string
) {
  const empty = {
    source: null as Record<string, unknown> | null,
    rootId: '',
    rootCampaign: null as Record<string, unknown> | null,
    childCount: 0,
    targets: new Map<string, 'junglist' | 'no_junglist'>(),
  };
  const { data: source } = await supabase.from('campaigns').select('*').eq('id', sourceId).maybeSingle();
  if (!source) return empty;

  const rootId = (source.parent_campaign_id as string | null) || (source.id as string);
  let rootCampaign = source;
  if (rootId !== source.id) {
    const { data: root } = await supabase.from('campaigns').select('*').eq('id', rootId).maybeSingle();
    if (root) rootCampaign = root;
  }

  // Línea completa: raíz + hijas.
  const { data: children } = await supabase
    .from('campaigns')
    .select('id')
    .eq('parent_campaign_id', rootId);
  const lineageIds = [rootId, ...(children ?? []).map((c) => c.id as string)];

  const { data: lineageRecs } = await supabase
    .from('campaign_recipients')
    .select('email, status, visited_at, segment, campaign_id')
    .in('campaign_id', lineageIds);

  const engaged = new Set<string>(); // visitó CUALQUIER correo de la línea
  const dead = new Set<string>(); // rebotó/spam en cualquier correo → no reintentar
  for (const r of lineageRecs ?? []) {
    const e = String(r.email).toLowerCase();
    if (r.visited_at) engaged.add(e);
    if (r.status === 'bounced' || r.status === 'complained') dead.add(e);
  }

  const [{ data: jUnsub }, { data: nUnsub }] = await Promise.all([
    supabase.from('junglists').select('email').not('unsubscribed_at', 'is', null),
    supabase.from('newsletter_subscribers').select('email').not('unsubscribed_at', 'is', null),
  ]);
  const unsub = new Set<string>();
  for (const r of jUnsub ?? []) if (r.email) unsub.add(String(r.email).toLowerCase());
  for (const r of nUnsub ?? []) if (r.email) unsub.add(String(r.email).toLowerCase());

  // Base = destinatarios de la RAÍZ que recibieron (sent/delivered/opened), sin
  // los que ya interactuaron / rebotaron / se dieron de baja. Conserva su segmento.
  const targets = new Map<string, 'junglist' | 'no_junglist'>();
  for (const r of lineageRecs ?? []) {
    if (r.campaign_id !== rootId) continue;
    if (!['sent', 'delivered', 'opened'].includes(String(r.status))) continue;
    const e = String(r.email).toLowerCase();
    if (engaged.has(e) || dead.has(e) || unsub.has(e) || targets.has(e)) continue;
    targets.set(e, r.segment === 'junglist' ? 'junglist' : 'no_junglist');
  }

  return { source, rootId, rootCampaign, childCount: children?.length ?? 0, targets };
}

// Crea una campaña HIJA que reenvía el correo de la RAÍZ a quienes no interactuaron
// con la línea (ver computeResendTargets). Se llama "<raíz> · Reenvío N" (N =
// cantidad de hijas + 1) y apunta a la raíz por parent_campaign_id. El correo se
// replica verbatim desde el segment_content de la raíz (o se regenera de fallback).
async function resendToUnopened(
  supabase: ReturnType<typeof createSupabaseServer>,
  apiKey: string,
  sourceId: string
) {
  const t = await computeResendTargets(supabase, sourceId);
  if (!t.source) return NextResponse.json({ error: 'Campaña no encontrada' }, { status: 404 });
  const { rootId, rootCampaign, childCount, targets } = t;

  if (targets.size === 0) {
    return NextResponse.json({ success: true, created: false, reason: 'no-unopened', count: 0 });
  }

  const base = String(rootCampaign.name || rootCampaign.subject || 'Campaña').replace(/ · Reenvío \d+$/i, '');
  const newName = `${base} · Reenvío ${childCount + 1}`;

  // Nueva campaña hija: contenido = RAÍZ, parent = raíz.
  const { data: created, error: createErr } = await supabase
    .from('campaigns')
    .insert({
      name: newName,
      parent_campaign_id: rootId,
      template: rootCampaign.template,
      event_id: rootCampaign.event_id,
      subject: rootCampaign.subject,
      title: rootCampaign.title,
      body_html: rootCampaign.body_html,
      image_url: rootCampaign.image_url,
      button_text: rootCampaign.button_text,
      button_url: rootCampaign.button_url,
      coupon_mode: rootCampaign.coupon_mode,
      coupon_new_code: rootCampaign.coupon_new_code,
      coupon_existing_code: rootCampaign.coupon_existing_code,
      audiences: rootCampaign.audiences,
      segment_content: rootCampaign.segment_content,
      recipients: targets.size,
      status: 'sent',
      sent_at: new Date().toISOString(),
    })
    .select('id')
    .single();
  if (createErr || !created) {
    return NextResponse.json(
      { error: `No se pudo crear la campaña: ${createErr?.message ?? 'desconocido'}` },
      { status: 500 }
    );
  }
  const newId = created.id as string;

  const resend = new Resend(apiKey);
  const fromEmail = process.env.RESEND_FROM_EMAIL || 'Drum and Bass Chile <info@drumandbasschile.cl>';
  const appOrigin = process.env.NODE_ENV === 'development' ? 'http://localhost:3600' : BASE_URL;
  const localButtonUrl = (rootCampaign.button_url || '').replace(BASE_URL, appOrigin);
  const withCt = (b: string, recId: string) => {
    if (!b) return '';
    const sep = b.includes('?') ? '&' : '?';
    return `${b}${sep}ct=${recId}&utm_source=email&utm_campaign=${newId}`;
  };
  const unsubUrl = (email: string) => `${appOrigin}/api/unsubscribe?email=${encodeURIComponent(email)}`;
  const couponEnabled = !!rootCampaign.coupon_mode && rootCampaign.coupon_mode !== 'none';
  const newCode = rootCampaign.coupon_new_code || '';
  const existingCode = rootCampaign.coupon_existing_code || '';
  const savedContent = rootCampaign.segment_content as Record<string, { subject: string; body: string }> | null;
  const source = rootCampaign;

  const list = Array.from(targets.entries()); // [email, segment]
  const BATCH_SIZE = 100;
  const rows: {
    id: string;
    campaign_id: string;
    email: string;
    resend_id: string | null;
    status: string;
    segment: string;
  }[] = [];
  let sent = 0;
  let failed = 0;

  for (let i = 0; i < list.length; i += BATCH_SIZE) {
    const batch = list.slice(i, i + BATCH_SIZE);
    const ids = batch.map(() => crypto.randomUUID());
    const payload = batch.map(([email, seg], j) => {
      const hasCoupon = couponEnabled && (seg === 'junglist' ? !!existingCode : !!newCode);
      const saved = savedContent?.[seg];
      return {
        from: fromEmail,
        to: email,
        subject: saved?.subject ?? segmentSubject(source.subject, source.title || '', hasCoupon),
        html: buildEmailHtml({
          title: source.title || source.subject,
          body: saved?.body ?? segmentBody(source.body_html || '', seg, hasCoupon),
          imageBase64: source.image_url || undefined,
          buttonText: source.button_text || undefined,
          buttonUrl: withCt(localButtonUrl, ids[j]) || undefined,
          unsubscribeUrl: unsubUrl(email),
        }),
      };
    });
    const pushRows = (status: string, resendIds: { id: string }[] | null) =>
      batch.forEach(([email, seg], j) =>
        rows.push({
          id: ids[j],
          campaign_id: newId,
          email,
          resend_id: resendIds?.[j]?.id ?? null,
          status,
          segment: seg,
        })
      );
    try {
      const { data, error } = await resend.batch.send(payload);
      if (error) {
        failed += batch.length;
        pushRows('failed', null);
      } else {
        sent += data?.data?.length || batch.length;
        pushRows('sent', data?.data ?? []);
      }
    } catch {
      failed += batch.length;
      pushRows('failed', null);
    }
  }

  for (let i = 0; i < rows.length; i += 500) {
    await supabase.from('campaign_recipients').insert(rows.slice(i, i + 500));
  }
  await supabase
    .from('campaigns')
    .update({ sent_count: sent, failed_count: failed })
    .eq('id', newId);

  return NextResponse.json({
    success: true,
    created: true,
    campaignId: newId,
    name: newName,
    count: targets.size,
    sent,
    failed,
  });
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

  // Reenvío a los que fallaron (no es una campaña nueva).
  if (body.resendCampaignId) {
    return resendFailedRecipients(supabase, apiKey, String(body.resendCampaignId));
  }

  // Sincronizar estados de entrega desde Resend (no envía nada).
  if (body.syncCampaignId) {
    return syncFromResend(supabase, apiKey, String(body.syncCampaignId));
  }

  // Reenviar el mismo correo a quienes no interactuaron → nueva campaña "· Reenvío N".
  if (body.resendUnopenedCampaignId) {
    return resendToUnopened(supabase, apiKey, String(body.resendUnopenedCampaignId));
  }

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
  // Los códigos se normalizan a MAYÚSCULA al guardar/enviar (así se ven en el
  // correo, la landing y el historial siempre igual, sin importar cómo se tipeó).
  const rawNew = (coupon?.newCode?.trim() || '').toUpperCase();
  const rawExisting = (coupon?.existingCode?.trim() || '').toUpperCase();

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
    // Puede haber varias campañas para el mismo evento. El corte nuevo/antiguo se
    // fija en la PRIMERA con cupón y no se mueve: si lo pisáramos, quien se
    // inscribió por una campaña anterior de este mismo evento pasaría a contar
    // como "ya registrado" y perdería su código de bienvenida.
    const { data: current } = await supabase
      .from('cms_events')
      .select('coupon_set_at')
      .eq('id', eventId)
      .maybeSingle();

    await supabase
      .from('cms_events')
      .update({
        coupon_junglist_new: newCode || null,
        coupon_junglist: existingCode || null,
        coupon_set_at: current?.coupon_set_at ?? new Date().toISOString(),
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
  // Medimos con NUESTRO tracking (no GA) quién ENTRÓ a la landing (click en el
  // botón del correo, ?ct=<id de la fila>). Sin pixel de apertura: el open por
  // imagen no es dato duro, así que no se usa. La entrega la da Resend (sync).
  const withCt = (base: string, recId: string) => {
    if (!base) return '';
    const sep = base.includes('?') ? '&' : '?';
    return `${base}${sep}ct=${recId}&utm_source=email&utm_campaign=${campaignId}`;
  };
  // Link de baja: por correo. Marca ese email como dado de baja (no se borra;
  // conserva su fecha).
  const unsubUrl = (email: string) => `${appOrigin}/api/unsubscribe?email=${encodeURIComponent(email)}`;

  // 2) Segmentamos: el correo depende del estado de registro de cada destinatario.
  //    Quien ya es junglist y tiene cupón, recibe "tu descuento te espera"; quien
  //    no lo es, "inscríbete y accede al descuento". Si a un segmento no le
  //    corresponde descuento (p. ej. el cupón es solo para junglists nuevos),
  //    recibe el correo normal, sin prometer nada que no pueda canjear.
  // Se segmenta SIEMPRE, aunque no haya cupón: si no, todos quedarían guardados
  // como 'no_junglist' y el desglose del historial mentiría. Sin cupón ambos
  // segmentos reciben exactamente el mismo correo.
  const junglistSet = await getJunglistEmails(supabase);
  const segments = [
    {
      key: 'junglist' as const,
      emails: emails.filter(e => junglistSet.has(e)),
      withCoupon: junglistGetsCoupon,
    },
    {
      key: 'no_junglist' as const,
      emails: emails.filter(e => !junglistSet.has(e)),
      withCoupon: nonJunglistGetsCoupon,
    },
  ];

  // 3) Enviamos por lotes (Resend: máx 100 por llamada), un html por destinatario
  //    (link + pixel con su id), y registramos el resend_id para los webhooks (Fase B).
  const BATCH_SIZE = 100;
  const results: { sent: number; failed: number; errors: string[] } = { sent: 0, failed: 0, errors: [] };
  const recipientRows: { id: string; campaign_id: string; email: string; resend_id: string | null; status: string; segment: string }[] = [];

  // Lo que REALMENTE se envió por segmento (asunto + cuerpo ya resueltos, sea el
  // generado o el editado a mano). Se persiste para que el reenvío replique
  // verbatim, sin depender de localStorage ni de regenerar desde el template.
  const segmentContent: Record<string, { subject: string; body: string }> = {};

  for (const segment of segments) {
    if (segment.emails.length === 0) continue;

    const useCoupon = couponEnabled && segment.withCoupon;
    // Si el admin editó el correo de este segmento, se usa tal cual.
    const bodyForSegment = segmentBodies?.[segment.key] ?? segmentBody(bodyHtml, segment.key, useCoupon);
    const subjectForSegment = segmentSubjects?.[segment.key] ?? segmentSubject(subject, title, useCoupon);
    segmentContent[segment.key] = { subject: subjectForSegment, body: bodyForSegment };

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
          unsubscribeUrl: unsubUrl(to),
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
    .update({ sent_count: results.sent, failed_count: results.failed, segment_content: segmentContent })
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
