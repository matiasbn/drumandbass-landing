import 'server-only';
import { cookies } from 'next/headers';
import type { SupabaseClient } from '@supabase/supabase-js';

import { MOCK_AUTH_ENABLED, MOCK_COOKIE, SOCIAL } from './devAuth';

// ─────────────────────────────────────────────────────────────────────────────
// AUTORIZACIÓN — fuente única de verdad para "¿es admin?"
//
// Todas las rutas /api/admin/* delegan aquí, así que hay UN solo lugar que
// auditar. `import 'server-only'` garantiza que nada de esto llega al cliente.
//
// GARANTÍA DE PRODUCCIÓN (la pregunta clave):
//   - En prod `MOCK_AUTH_ENABLED` es false (cuelga de NODE_ENV, ver devFlags),
//     así que la rama mock ni se mira: la identidad sale SIEMPRE de la sesión
//     real de Supabase (el JWT que emite Google).
//   - Aunque el candado fallara, la rama mock solo puede NEGAR admin, nunca
//     concederlo: crear campañas exige sesión real porque la RLS de Supabase
//     valida `auth.uid()` contra `profiles.is_admin`. No hay atajo que otorgue
//     privilegios — el peor caso de un bug sería negar acceso, no abrirlo.
//   - `assertNeverProd()` es un fusible: si la rama mock se alcanzara con
//     NODE_ENV=production, revienta en vez de seguir. Es inalcanzable en
//     operación normal; existe para que un refactor futuro falle ruidoso.
//
// En dev, la identidad la decide el perfil simulado (cookie dnb_mock_persona):
//   - un perfil PÚBLICO activo (anon/user/junglist/dj) ⇒ no admin (estás viendo
//     la app como ese visitante).
//   - sin perfil, o perfil 'social' ⇒ se usa la sesión real de Google. Ahí es
//     donde pruebas admin: entras con tu cuenta real (que es admin) y la RLS te
//     deja escribir. Es "la lógica de prod", en local.
// ─────────────────────────────────────────────────────────────────────────────

function assertNeverProd() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('[authz] la rama mock se alcanzó en producción — nunca debe pasar');
  }
}

export interface AdminCheck {
  user: { id: string; email?: string } | null;
  isAdmin: boolean;
}

export async function verifyAdmin(supabase: SupabaseClient): Promise<AdminCheck> {
  if (MOCK_AUTH_ENABLED) {
    assertNeverProd();
    const raw = (await cookies()).get(MOCK_COOKIE)?.value;
    // Solo 'social' (sesión real de Google) puede ser admin. Cualquier otra cosa
    // —un perfil público, o el default Anónimo— NO es admin: en dev la identidad
    // es ficticia salvo que pidas explícitamente la sesión real.
    if (raw !== SOCIAL) {
      return { user: null, isAdmin: false };
    }
  }

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { user: null, isAdmin: false };

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('user_id', user.id)
    .single();

  return { user, isAdmin: profile?.is_admin === true };
}
