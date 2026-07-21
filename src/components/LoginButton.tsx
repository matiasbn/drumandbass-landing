'use client';

import { useEffect, useState } from 'react';
import { RiGoogleFill } from '@remixicon/react';

import { createClient } from '@/src/lib/supabase';
import { event } from '@/src/lib/gtag';

/**
 * "Iniciar sesión" del header, complementario a SessionMenu: uno se muestra
 * cuando NO hay sesión, el otro cuando sí. Entra con Google y vuelve a la página
 * donde estabas (no a una fija), porque el login del sitio es contextual.
 *
 * Producción: lee la sesión real de Supabase. Se oculta apenas hay sesión.
 */
export default function LoginButton({ variant = 'desktop' }: { variant?: 'desktop' | 'mobile' }) {
  const [state, setState] = useState<'loading' | 'anon' | 'in'>('loading');

  useEffect(() => {
    const supabase = createClient();
    let alive = true;
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (alive) setState(user ? 'in' : 'anon');
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (alive) setState(session?.user ? 'in' : 'anon');
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const login = async () => {
    event('login', { source: 'header', method: 'google' });
    const next = window.location.pathname + window.location.search;
    await createClient().auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
    });
  };

  // Nada hasta saber, y nada si ya hay sesión (ahí manda SessionMenu).
  if (state !== 'anon') return null;

  if (variant === 'mobile') {
    return (
      <button
        onClick={login}
        className="py-3 px-4 w-full brutalist-border bg-black text-white font-bold uppercase mono text-sm flex items-center justify-center gap-2 hover:bg-[#0000ff] transition-colors cursor-pointer"
      >
        <RiGoogleFill size={16} /> Iniciar sesión
      </button>
    );
  }

  return (
    <button
      onClick={login}
      className="px-4 py-3 font-bold uppercase mono text-xs border-t-2 border-black hover:bg-[#0000ff] hover:text-white transition-colors flex items-center gap-2 cursor-pointer w-full text-left"
    >
      <RiGoogleFill size={16} /> Iniciar sesión
    </button>
  );
}
