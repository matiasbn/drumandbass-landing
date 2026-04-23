import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

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
    const [subRes, profRes, pkRes] = await Promise.all([
      supabase.from('newsletter_subscribers').select('email').ilike('email', `%${query}%`).limit(20),
      supabase.from('profiles').select('email').ilike('email', `%${query}%`).limit(20),
      supabase.from('pk_profiles').select('email').ilike('email', `%${query}%`).limit(20),
    ]);

    const allEmails = new Set<string>();
    for (const res of [subRes, profRes, pkRes]) {
      if (!res.error && res.data) {
        res.data.forEach(r => {
          if (r.email) allEmails.add(r.email.toLowerCase());
        });
      }
    }

    return NextResponse.json({ results: Array.from(allEmails).slice(0, 20) });
  }

  // Audience counts mode
  const audiences = searchParams.get('audiences')?.split(',').filter(Boolean) || [];

  const { counts, totalUnique } = await getEmailsByAudiences(supabase, audiences);

  return NextResponse.json({ counts, totalUnique });
}

function buildEmailHtml({
  title,
  body,
  imageBase64,
  buttonText,
  buttonUrl,
}: {
  title: string;
  body: string;
  imageBase64?: string;
  buttonText?: string;
  buttonUrl?: string;
}) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { margin: 0; padding: 0; background-color: #000; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; }
    .container { max-width: 600px; margin: 0 auto; background-color: #111; }
    .header { background-color: #000; padding: 24px; text-align: center; border-bottom: 4px solid #ff0055; }
    .header h1 { color: #fff; font-size: 20px; font-weight: 900; text-transform: uppercase; letter-spacing: 2px; margin: 0; }
    .content { padding: 32px 24px; }
    .email-image { text-align: center; margin-bottom: 24px; }
    .email-image img { max-width: 100%; height: auto; }
    .email-title { color: #fff; font-size: 24px; font-weight: 900; line-height: 1.2; margin: 0 0 16px 0; }
    .email-body { color: #ccc; font-size: 15px; line-height: 1.6; }
    .email-body a { color: #ff0055; }
    .cta { text-align: center; padding: 24px 0; }
    .cta a { display: inline-block; background-color: #ff0055; color: #fff; font-weight: 700; text-transform: uppercase; font-size: 14px; padding: 14px 32px; text-decoration: none; letter-spacing: 1px; }
    .footer { background-color: #000; padding: 20px 24px; text-align: center; border-top: 4px solid #333; }
    .footer p { color: #666; font-size: 11px; margin: 4px 0; }
    .footer a { color: #ff0055; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Drum and Bass Chile</h1>
    </div>
    <div class="content">
      ${imageBase64 ? `<div class="email-image"><img src="${imageBase64}" alt="" width="180" /></div>` : ''}
      <h2 class="email-title">${title}</h2>
      <div class="email-body">${body}</div>
      ${buttonText && buttonUrl ? `<div class="cta"><a href="${buttonUrl}">${buttonText}</a></div>` : ''}
    </div>
    <div class="footer">
      <p>Drum and Bass Chile</p>
      <p><a href="https://drumandbasschile.cl">drumandbasschile.cl</a></p>
    </div>
  </div>
</body>
</html>`;
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
    subject,
    title,
    bodyHtml,
    imageBase64,
    buttonText,
    buttonUrl,
  } = body as {
    audiences: string[];
    extraEmails?: string[];
    subject: string;
    title: string;
    bodyHtml: string;
    imageBase64?: string;
    buttonText?: string;
    buttonUrl?: string;
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

  const html = buildEmailHtml({ title, body: bodyHtml, imageBase64, buttonText, buttonUrl });
  const fromEmail = process.env.RESEND_FROM_EMAIL || 'Drum and Bass Chile <info@drumandbasschile.cl>';
  const resend = new Resend(apiKey);

  // Resend batch: max 100 per call
  const BATCH_SIZE = 100;
  const results: { sent: number; failed: number; errors: string[] } = { sent: 0, failed: 0, errors: [] };

  for (let i = 0; i < emails.length; i += BATCH_SIZE) {
    const batch = emails.slice(i, i + BATCH_SIZE);
    const batchPayload = batch.map(to => ({
      from: fromEmail,
      to,
      subject,
      html,
    }));

    try {
      const { data, error } = await resend.batch.send(batchPayload);
      if (error) {
        results.failed += batch.length;
        results.errors.push(error.message);
      } else {
        results.sent += data?.data?.length ?? batch.length;
      }
    } catch (err) {
      results.failed += batch.length;
      results.errors.push(err instanceof Error ? err.message : 'Error desconocido');
    }
  }

  return NextResponse.json({
    success: results.failed === 0,
    sent: results.sent,
    failed: results.failed,
    total: emails.length,
    errors: results.errors,
  });
}
