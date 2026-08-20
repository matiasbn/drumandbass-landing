'use client';

import React, { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/src/lib/supabase';
import { RiGoogleFill, RiCheckLine, RiLoader4Line } from '@remixicon/react';
import { event } from '@/src/lib/gtag';
import PresskitView from '@/src/components/pk/PresskitView';
import { pendingToPresskit } from '@/src/types/pendingPresskit';
import type { PendingPresskitData } from '@/src/types/pendingPresskit';

interface PendingPreview {
  email: string;
  slug: string;
  artist_name: string | null;
  status: string;
  data: Partial<PendingPresskitData>;
}

function ClaimInner() {
  const params = useSearchParams();
  const token = params.get('token') || '';
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<PendingPreview | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [done, setDone] = useState<{ slug: string } | null>(null);
  const [error, setError] = useState<string>('');

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: rows }, { data: { user } }] = await Promise.all([
      supabase.rpc('get_pending_presskit', { p_token: token }),
      supabase.auth.getUser(),
    ]);
    const row = Array.isArray(rows) ? rows[0] : rows;
    setPending(row || null);
    setUserEmail(user?.email?.toLowerCase() || null);
    setLoading(false);
  }, [supabase, token]);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    void load();
  }, [token, load]);

  const signIn = async () => {
    const origin = window.location.origin;
    const next = `/pk/claim?token=${encodeURIComponent(token)}`;
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}` },
    });
  };

  const claim = async () => {
    setClaiming(true);
    setError('');
    try {
      const res = await fetch('/api/pk/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'No se pudo publicar el presskit');
        return;
      }
      event('presskit_claim', { slug: data.slug });
      setDone({ slug: data.slug });
    } catch {
      setError('Error de conexión. Intenta de nuevo.');
    } finally {
      setClaiming(false);
    }
  };

  if (!token) {
    return <Centered title="Enlace inválido" body="Falta el token de la invitación. Revisa el enlace del correo." />;
  }
  if (loading) {
    return (
      <Centered title="Cargando…" body="">
        <RiLoader4Line className="w-8 h-8 animate-spin mx-auto" />
      </Centered>
    );
  }
  if (!pending) {
    return <Centered title="Enlace inválido" body="No encontramos este presskit. Puede que el enlace haya expirado." />;
  }
  if (done) {
    return (
      <Centered title="¡Presskit publicado!" body="Ya está en línea. Puedes editarlo cuando quieras desde tu perfil.">
        <div className="w-16 h-16 mx-auto mb-6 flex items-center justify-center bg-[#00b341] text-white brutalist-border">
          <RiCheckLine className="w-9 h-9" />
        </div>
        <a
          href={`/artistas/${done.slug}`}
          className="inline-block brutalist-border bg-black text-white px-6 py-3 mono text-sm font-black uppercase hover:bg-[#ff0055]"
        >
          Ver mi presskit
        </a>
      </Centered>
    );
  }
  if (pending.status !== 'pending') {
    return <Centered title="Ya fue reclamado" body="Este presskit ya se publicó anteriormente." />;
  }

  const data = (pending.data || {}) as Partial<PendingPresskitData>;
  const artist = data.artist_name || pending.artist_name || 'Tu presskit';
  const emailMatches = userEmail && userEmail === pending.email.toLowerCase();
  const presskit = pendingToPresskit(data);

  return (
    <main className="flex-1">
      {/* Barra fija: estado + acción de publicar. Debajo, el presskit COMPLETO
          tal como quedará publicado. */}
      <div className="sticky top-0 z-50 bg-[#ff0055] text-white border-b-4 border-black px-4 py-3">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row md:items-center gap-3 md:justify-between">
          <div className="min-w-0">
            <p className="mono text-xs font-black uppercase truncate">{artist} · presskit pendiente</p>
            <p className="mono text-[11px] opacity-90">Así se verá publicado. Es para {pending.email}.</p>
          </div>
          <div className="shrink-0">
            {!userEmail ? (
              <button onClick={signIn} className="inline-flex items-center gap-2 brutalist-border bg-black text-white px-4 py-2.5 mono text-xs font-black uppercase hover:bg-white hover:text-black cursor-pointer">
                <RiGoogleFill className="w-4 h-4" /> Iniciar sesión para publicar
              </button>
            ) : emailMatches ? (
              <button onClick={claim} disabled={claiming} className="inline-flex items-center gap-2 brutalist-border bg-black text-white px-4 py-2.5 mono text-xs font-black uppercase hover:bg-white hover:text-black disabled:opacity-60 cursor-pointer">
                {claiming ? <RiLoader4Line className="w-4 h-4 animate-spin" /> : <RiCheckLine className="w-4 h-4" />}
                {claiming ? 'Publicando…' : 'Aceptar y publicar'}
              </button>
            ) : (
              <button onClick={async () => { await supabase.auth.signOut(); await signIn(); }} className="inline-flex items-center gap-2 brutalist-border bg-black text-white px-4 py-2.5 mono text-xs font-black uppercase hover:bg-white hover:text-black cursor-pointer">
                <RiGoogleFill className="w-4 h-4" /> Cambiar de cuenta
              </button>
            )}
          </div>
        </div>
        {error && (
          <p className="max-w-5xl mx-auto mono text-[11px] font-bold uppercase mt-2 bg-black/30 px-2 py-1">{error}</p>
        )}
        {userEmail && !emailMatches && (
          <p className="max-w-5xl mx-auto mono text-[11px] mt-1 opacity-90">
            Iniciaste sesión como {userEmail}, pero la invitación es para {pending.email}. Cambia de cuenta para publicar.
          </p>
        )}
      </div>

      <PresskitView presskit={presskit} slug={pending.slug} preview />
    </main>
  );
}

function Centered({ title, body, children }: { title: string; body: string; children?: React.ReactNode }) {
  return (
    <main className="min-h-[70vh] flex items-center justify-center p-6">
      <div className="text-center max-w-md">
        {children}
        <h1 className="text-3xl font-black uppercase italic tracking-tighter mb-3">{title}</h1>
        {body && <p className="text-gray-600">{body}</p>}
      </div>
    </main>
  );
}

export default function ClaimPage() {
  return (
    <Suspense fallback={null}>
      <ClaimInner />
    </Suspense>
  );
}
