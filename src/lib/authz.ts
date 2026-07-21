import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

// Autorización — fuente única de verdad para "¿es admin?". Todas las rutas
// /api/admin/* delegan aquí, así que hay UN solo lugar que auditar.
// `import 'server-only'` garantiza que nada de esto llega al cliente.
//
// La identidad sale siempre de la sesión real de Supabase (el JWT que emite
// Google). El acceso lo decide `profiles.is_admin`, la misma condición que
// exige la RLS de las tablas admin.

export interface AdminCheck {
  user: { id: string; email?: string } | null;
  isAdmin: boolean;
}

export async function verifyAdmin(supabase: SupabaseClient): Promise<AdminCheck> {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { user: null, isAdmin: false };

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('user_id', user.id)
    .single();

  return { user, isAdmin: profile?.is_admin === true };
}
