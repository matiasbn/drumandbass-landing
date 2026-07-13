'use client';

import React, { useState } from 'react';
import { createClient } from '@/src/lib/supabase';

// Botón SOLO en desarrollo para forzar el cierre de sesión y limpiar el token de
// Supabase. Útil cuando la sesión (p. ej. iniciada en otro origin/prod) deja el
// cliente de auth colgado en local. Nunca se renderiza en producción.
export default function DevLogout() {
  const [busy, setBusy] = useState(false);

  if (process.env.NODE_ENV !== 'development') return null;

  const forceLogout = async () => {
    setBusy(true);
    // signOut puede colgarse: lo corremos con timeout y luego limpiamos a mano.
    try {
      const supabase = createClient();
      await Promise.race([
        supabase.auth.signOut({ scope: 'local' }),
        new Promise((r) => setTimeout(r, 1500)),
      ]);
    } catch {
      // ignorado
    }
    try {
      Object.keys(localStorage)
        .filter((k) => k.startsWith('sb-'))
        .forEach((k) => localStorage.removeItem(k));
      document.cookie.split(';').forEach((c) => {
        const name = c.split('=')[0].trim();
        if (name.startsWith('sb-')) {
          document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
        }
      });
    } catch {
      // ignorado
    }
    window.location.reload();
  };

  return (
    <button
      onClick={forceLogout}
      disabled={busy}
      title="Solo dev: cierra sesión y limpia el token de Supabase"
      style={{ position: 'fixed', bottom: 12, right: 12, zIndex: 9999 }}
      className="mono text-[10px] font-black uppercase bg-black text-white border-2 border-[#ff0000] px-3 py-2 disabled:opacity-50"
    >
      {busy ? '…' : 'DEV · forzar logout'}
    </button>
  );
}
