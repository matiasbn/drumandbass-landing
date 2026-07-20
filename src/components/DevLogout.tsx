'use client';

import React, { useEffect, useState } from 'react';
import { createClient } from '@/src/lib/supabase';
import { MOCK_COOKIE, MOCK_PERSONAS, readMockCookie, SOCIAL } from '@/src/lib/devAuth';
import { DEV_TOOLS_ENABLED } from '@/src/lib/devFlags';

// Panel de identidad SOLO para desarrollo. Reúne las dos cosas que hacen falta
// para probar los flujos que dependen de quién mira:
//
//   1. Cambiar de perfil simulado, para recorrer los estados del descuento
//      Junglist sin crear cuentas de Google reales.
//   2. Forzar el cierre de sesión, cuando el cliente de auth queda colgado
//      (p. ej. con una sesión iniciada en otro origin).
//
// Nunca se renderiza en producción: ahí la identidad sale siempre de la sesión
// real de Supabase, sin atajos.
export default function DevLogout() {
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  // Con varias cuentas de Google es fácil probar con la equivocada y culpar al
  // código: el panel dice siempre quién eres para la app.
  const [email, setEmail] = useState<string | null>(null);
  const [persona, setPersona] = useState<string | null>(null);

  useEffect(() => {
    if (!DEV_TOOLS_ENABLED) return;
    // Cookie cruda: 'social', una key de perfil, o vacío (⇒ Anónimo por default).
    setPersona(readMockCookie() ?? 'anon');
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

  if (!DEV_TOOLS_ENABLED) return null;

  const choosePersona = (key: string | null) => {
    if (key) {
      document.cookie = `${MOCK_COOKIE}=${key}; path=/; max-age=86400; SameSite=Lax`;
    } else {
      document.cookie = `${MOCK_COOKIE}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
    }
    window.location.reload();
  };

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

  const isSocial = persona === SOCIAL;
  const activeLabel = isSocial
    ? (email ?? 'sesión real (sin login)')
    : MOCK_PERSONAS.find((p) => p.key === persona)?.label ?? 'Anónimo';

  return (
    <div style={{ position: 'fixed', bottom: 12, right: 12, zIndex: 9999, maxWidth: 300 }}>
      {open && (
        <div className="mono text-[10px] bg-black text-white border-2 border-[#ff0000] mb-2">
          <p className="px-3 py-2 border-b border-gray-700 opacity-60 uppercase">
            Ver la app como… (dev)
          </p>

          {MOCK_PERSONAS.map((p) => (
            <button
              key={p.key}
              onClick={() => choosePersona(p.key)}
              className={`block w-full text-left px-3 py-2 border-b border-gray-700 hover:bg-gray-800 cursor-pointer ${
                persona === p.key ? 'bg-[#ff0055]' : ''
              }`}
            >
              <span className="block font-black uppercase">{p.label}</span>
              <span className="block opacity-70 normal-case">{p.desc}</span>
            </button>
          ))}

          {/* Sesión real de Google = lógica de prod. Es donde funciona admin
              (RLS exige un auth.uid() admin real). */}
          <button
            onClick={() => choosePersona(SOCIAL)}
            className={`block w-full text-left px-3 py-2 border-b border-gray-700 hover:bg-gray-800 cursor-pointer ${
              isSocial ? 'bg-[#0000ff]' : ''
            }`}
          >
            <span className="block font-black uppercase">Social login (sesión real)</span>
            <span className="block opacity-70 normal-case">
              {email ? `Google · ${email}` : 'Lógica de prod. Necesario para admin/campañas.'}
            </span>
          </button>

          <button
            onClick={forceLogout}
            disabled={busy}
            className="block w-full text-left px-3 py-2 font-black uppercase hover:bg-gray-800 cursor-pointer disabled:opacity-50"
          >
            {busy ? '…' : 'Forzar logout (limpia el token)'}
          </button>
        </div>
      )}

      <button
        onClick={() => setOpen((o) => !o)}
        title={`Solo dev · identidad actual: ${activeLabel}`}
        className="mono text-[10px] font-black uppercase bg-black text-white border-2 border-[#ff0000] px-3 py-2 text-left w-full"
      >
        <span className="block truncate normal-case text-[#ff5577]">{activeLabel}</span>
        <span className="block">
          DEV · {isSocial ? 'sesión real' : 'perfil simulado'} {open ? '▾' : '▸'}
        </span>
      </button>
    </div>
  );
}
