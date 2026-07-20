import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

// Pixel de apertura del correo: devuelve un GIF 1×1 transparente y marca opened_at
// del destinatario cuyo id (uuid) viene en ?ct=. La función mark_campaign_open es
// SECURITY DEFINER (no requiere service-role). Ojo: las aperturas son poco fiables
// (Apple Mail/Gmail pre-cargan las imágenes).
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 'placeholder',
  { auth: { persistSession: false, autoRefreshToken: false } }
);

const PIXEL = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
);

const isUuid = (v: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('ct');
  if (id && isUuid(id)) {
    try {
      await supabase.rpc('mark_campaign_open', { p_id: id });
    } catch {
      // el pixel siempre debe devolver la imagen, aunque falle el registro
    }
  }
  return new Response(new Uint8Array(PIXEL), {
    status: 200,
    headers: {
      'Content-Type': 'image/gif',
      'Content-Length': String(PIXEL.length),
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
    },
  });
}
