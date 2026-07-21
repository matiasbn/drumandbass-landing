'use client';

import { useEffect, useRef, useState } from 'react';
import { RiUserLine, RiLogoutBoxRLine } from '@remixicon/react';

import { createClient } from '@/src/lib/supabase';
import { event } from '@/src/lib/gtag';

/**
 * Indicador de sesión del header. Muestra con qué cuenta estás conectado —el
 * sitio permite entrar desde varios lugares (junglist, presskit, club), así que
 * sin esto es fácil no saber cuál es tu sesión— y da salir en un lugar fijo.
 *
 * Lee la sesión real de Supabase, así que vale en producción. Cuando no hay
 * sesión no renderiza nada: el login sigue siendo contextual (no hay un "entrar"
 * genérico), y un header con "sin sesión" sería ruido.
 */
export default function SessionMenu({ variant = 'desktop' }: { variant?: 'desktop' | 'mobile' }) {
  const [email, setEmail] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = createClient();
    let alive = true;

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (alive) {
        setEmail(user?.email ?? null);
        setReady(true);
      }
    });

    // Reacciona a login/logout ocurridos en otra vista sin recargar.
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (alive) setEmail(session?.user?.email ?? null);
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // Cerrar el dropdown al hacer clic fuera.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const signOut = async () => {
    event('logout', { source: 'header' });
    await createClient().auth.signOut();
    window.location.href = '/';
  };

  // Nada que mostrar hasta saber, y nada si no hay sesión.
  if (!ready || !email) return null;

  const initial = email[0]?.toUpperCase() ?? '?';

  // Móvil: bloque a lo ancho dentro del popover.
  if (variant === 'mobile') {
    return (
      <div className="brutalist-border bg-white">
        <div className="flex items-center gap-3 px-4 py-3 border-b-2 border-black">
          <span className="w-8 h-8 shrink-0 bg-black text-white font-black flex items-center justify-center mono">
            {initial}
          </span>
          <div className="min-w-0">
            <p className="mono text-[10px] uppercase text-gray-500 leading-none mb-1">Tu sesión</p>
            <p className="mono text-xs font-bold truncate">{email}</p>
          </div>
        </div>
        <a
          href="/junglist"
          className="block px-4 py-3 font-bold uppercase mono text-xs border-b-2 border-black hover:bg-[#0000ff] hover:text-white transition-colors"
        >
          <RiUserLine size={16} className="inline mr-2 align-text-bottom" /> Mi perfil
        </a>
        <button
          onClick={signOut}
          className="block w-full text-left px-4 py-3 font-bold uppercase mono text-xs hover:bg-[#ff0000] hover:text-white transition-colors cursor-pointer"
        >
          <RiLogoutBoxRLine size={16} className="inline mr-2 align-text-bottom" /> Cerrar sesión
        </button>
      </div>
    );
  }

  // Escritorio: chip cuadrado + dropdown.
  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        title={`Sesión: ${email}`}
        aria-label={`Sesión de ${email}`}
        className="h-12 px-3 brutalist-border brutalist-shadow-blue bg-white font-bold uppercase mono text-xs flex items-center gap-2 hover:bg-black hover:text-white transition-colors cursor-pointer max-w-[200px]"
      >
        <span className="w-6 h-6 shrink-0 bg-[#0000ff] text-white font-black flex items-center justify-center">
          {initial}
        </span>
        <span className="truncate hidden xl:inline">{email}</span>
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-2 bg-white border-4 border-black z-50 flex flex-col min-w-[240px]">
          <div className="px-4 py-3 border-b-2 border-black">
            <p className="mono text-[10px] uppercase text-gray-500 leading-none mb-1">Tu sesión</p>
            <p className="mono text-xs font-bold break-all">{email}</p>
          </div>
          <a
            href="/junglist"
            className="px-4 py-3 font-bold uppercase mono text-xs border-b-2 border-black hover:bg-[#0000ff] hover:text-white transition-colors flex items-center gap-2"
          >
            <RiUserLine size={16} /> Mi perfil
          </a>
          <button
            onClick={signOut}
            className="px-4 py-3 font-bold uppercase mono text-xs text-left hover:bg-[#ff0000] hover:text-white transition-colors cursor-pointer flex items-center gap-2"
          >
            <RiLogoutBoxRLine size={16} /> Cerrar sesión
          </button>
        </div>
      )}
    </div>
  );
}
