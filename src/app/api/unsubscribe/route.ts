import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

// Baja de correos de campaña. El link del correo trae ?email=<correo>; marcamos
// newsletter_subscribers.unsubscribed_at de ese correo (no se borra — conserva
// su fecha). La función mark_unsubscribe es SECURITY DEFINER, así se puede hacer
// sin sesión y sin service-role.
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 'placeholder',
  { auth: { persistSession: false, autoRefreshToken: false } }
);

function page(title: string, body: string) {
  return new Response(
    `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8">
     <meta name="viewport" content="width=device-width, initial-scale=1">
     <title>${title}</title>
     <style>body{font-family:'Space Mono',monospace;background:#000;color:#fff;display:flex;
     min-height:100vh;align-items:center;justify-content:center;margin:0;padding:24px;text-align:center}
     .box{border:4px solid #fff;padding:32px;max-width:420px}
     h1{text-transform:uppercase;font-style:italic;margin:0 0 12px}
     a{color:#ff0055}</style></head>
     <body><div class="box"><h1>${title}</h1><p>${body}</p>
     <p><a href="https://www.drumandbasschile.cl">Volver al sitio</a></p></div></body></html>`,
    { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  );
}

export async function GET(request: NextRequest) {
  const email = request.nextUrl.searchParams.get('email')?.trim().toLowerCase();
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return page('Link inválido', 'No pudimos procesar esta baja.');
  }

  await supabase.rpc('mark_unsubscribe', { p_email: email });

  return page(
    'Listo, te diste de baja',
    'No recibirás más correos de campaña. Si fue un error, escríbenos y te reactivamos.'
  );
}
