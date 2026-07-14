'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/src/lib/supabase';
import { User } from '@supabase/supabase-js';
import {
  RiMicLine,
  RiArrowRightLine,
  RiLogoutBoxLine,
  RiLoader4Line,
  RiGoogleFill,
} from '@remixicon/react';

export default function PkHero() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [signingIn, setSigningIn] = useState(false);
  const [supabase] = useState(() => createClient());

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        setUser(session?.user ?? null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, [supabase]);

  const handleSignOut = async () => {
    await supabase.auth.signOut({ scope: 'global' });
    setUser(null);
  };

  // Same flow as PkAuthContext.signInWithGoogle: drop the post-login redirect
  // cookie and go straight to Google — no intermediate /pk/edit auth screen.
  const handleGoogleLogin = async () => {
    setSigningIn(true);
    document.cookie = 'pk_auth_redirect=/pk/edit; path=/; max-age=600; SameSite=Lax';
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: { prompt: 'select_account' },
      },
    });
    if (error) setSigningIn(false);
  };

  return (
    <section className="border-b-4 border-black p-6 lg:p-12 flex flex-col items-center text-center">
      <div className="mb-8">
        <RiMicLine className="w-16 h-16 mx-auto mb-4" />
        <h1 className="text-6xl lg:text-8xl font-black uppercase italic tracking-tighter leading-none mb-4">
          PRESSKIT
        </h1>
        <p className="mono text-lg font-bold uppercase opacity-60 max-w-xl mx-auto">
          Tu presskit digital como DJ. Bio, mixes, redes sociales — todo en un solo lugar.
        </p>
      </div>

      {loading ? (
        <RiLoader4Line className="w-8 h-8 animate-spin opacity-30" />
      ) : user ? (
        <div className="flex flex-col items-center gap-4">
          <p className="mono text-sm opacity-60">{user.email}</p>
          <div className="flex gap-3 flex-wrap justify-center">
            <Link
              href="/pk/edit"
              className="inline-flex items-center gap-3 bg-black text-white px-8 py-4 text-xl font-black uppercase tracking-wider brutalist-border hover:translate-x-[-4px] hover:translate-y-[-4px] hover:shadow-[8px_8px_0px_0px_rgba(255,0,85,1)] transition-all"
            >
              EDITAR PRESSKIT
              <RiArrowRightLine className="w-6 h-6" />
            </Link>
            <button
              onClick={handleSignOut}
              className="inline-flex items-center gap-2 px-6 py-4 mono text-sm font-bold uppercase brutalist-border hover:bg-black hover:text-white transition-colors"
            >
              <RiLogoutBoxLine className="w-5 h-5" />
              CERRAR SESIÓN
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={handleGoogleLogin}
          disabled={signingIn}
          className="inline-flex items-center gap-3 bg-black text-white px-8 py-4 text-xl font-black uppercase tracking-wider brutalist-border hover:translate-x-[-4px] hover:translate-y-[-4px] hover:shadow-[8px_8px_0px_0px_rgba(255,0,85,1)] transition-all disabled:opacity-50 disabled:pointer-events-none"
        >
          {signingIn ? (
            <RiLoader4Line className="w-6 h-6 animate-spin" />
          ) : (
            <RiGoogleFill className="w-6 h-6" />
          )}
          CREA O EDITA TU PRESSKIT
        </button>
      )}
    </section>
  );
}
