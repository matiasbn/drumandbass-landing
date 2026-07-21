'use client';

import React, { useEffect, useState } from 'react';
import { createClient } from '@/src/lib/supabase';

// Botón SOLO en desarrollo para forzar el cierre de sesión y limpiar el token de
// Supabase. Útil cuando la sesión (p. ej. iniciada en otro origin/prod) deja el
// cliente de auth colgado. Muestra con qué cuenta estás para no confundirte al
// probar con varias de Google. Nunca se renderiza en producción.
export default function DevLogout() {
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;
    let alive = true;
    (async () => {
      try {
        const { data: { user } } = await createClient().auth.getUser();
        if (alive) setEmail(user?.email ?? null);
      } catch {
        // sin sesión o auth deshabilitado: se muestra como "sin sesión"
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

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
      title={
        email
          ? `Sesión: ${email} — solo dev: cierra sesión y limpia el token`
          : 'Solo dev: cierra sesión y limpia el token de Supabase'
      }
      style={{ position: 'fixed', bottom: 12, right: 12, zIndex: 9999, maxWidth: 260 }}
      className="mono text-[10px] font-black uppercase bg-black text-white border-2 border-[#ff0000] px-3 py-2 text-left disabled:opacity-50"
    >
      {busy ? (
        '…'
      ) : (
        <>
          <span className="block truncate normal-case font-bold text-[#ff5577]">
            {email ?? 'sin sesión'}
          </span>
          <span className="block">DEV · forzar logout</span>
        </>
      )}
    </button>
  );
}
