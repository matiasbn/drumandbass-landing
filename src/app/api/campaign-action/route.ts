import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

// Registra una acción genérica de un destinatario de campaña (p.ej. copiar el
// cupón). El id (?ct del correo) identifica la fila; la función record_campaign_action
// es SECURITY DEFINER y guarda solo la primera ocurrencia. No requiere sesión.
// Best-effort: nunca rompe la UX (si falla, se ignora).
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 'placeholder',
  { auth: { persistSession: false, autoRefreshToken: false } }
);

const isUuid = (v: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

export async function POST(request: NextRequest) {
  try {
    const { ct, action, meta } = await request.json();
    if (ct && isUuid(String(ct))) {
      const act = String(action || '').trim().slice(0, 60);
      if (act) {
        await supabase.rpc('record_campaign_action', {
          p_recipient_id: ct,
          p_action: act,
          p_meta: meta ?? null,
        });
      }
    }
  } catch {
    // tracking best-effort
  }
  return NextResponse.json({ ok: true });
}
