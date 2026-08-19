'use client';

import React, { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/src/lib/supabase';
import { RiGoogleFill, RiCheckLine, RiErrorWarningLine, RiLoader4Line } from '@remixicon/react';
import { event } from '@/src/lib/gtag';

interface PendingPreview {
  email: string;
  slug: string;
  artist_name: string | null;
  status: string;
  data: {
    artist_name?: string;
    city?: string | null;
    country?: string | null;
    genres?: string[];
    bio?: string | null;
    mixes?: { title: string }[];
    photo_urls?: string[];
  };
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

  const d = pending.data || {};
  const artist = d.artist_name || pending.artist_name || 'Tu presskit';
  const emailMatches = userEmail && userEmail === pending.email.toLowerCase();
  const cover = d.photo_urls?.[0] || null;

  return (
    <main className="min-h-[70vh] max-w-2xl mx-auto p-6 lg:p-10">
      <p className="mono text-xs font-black uppercase text-[#ff0055] mb-2">Presskit pendiente de aprobación</p>
      <h1 className="text-4xl lg:text-5xl font-black uppercase italic tracking-tighter leading-none mb-6">{artist}</h1>

      {/* Preview de lo que armó el admin */}
      <div className="brutalist-border brutalist-shadow p-5 mb-6 flex gap-4 items-start bg-white">
        {cover && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover} alt={artist} className="w-24 h-24 object-cover brutalist-border shrink-0" />
        )}
        <div className="min-w-0">
          {(d.city || d.country) && (
            <p className="mono text-xs font-bold uppercase text-gray-500">{[d.city, d.country].filter(Boolean).join(', ')}</p>
          )}
          {d.genres?.length ? (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {d.genres.slice(0, 6).map((g) => (
                <span key={g} className="mono text-[10px] font-black uppercase bg-black text-white px-2 py-0.5">{g}</span>
              ))}
            </div>
          ) : null}
          {d.bio && <p className="text-sm mt-3 line-clamp-3 text-gray-700">{d.bio}</p>}
          {d.mixes?.length ? (
            <p className="mono text-[11px] font-bold uppercase text-gray-500 mt-3">{d.mixes.length} sets & releases</p>
          ) : null}
        </div>
      </div>

      <p className="text-sm text-gray-700 mb-4">
        Este presskit es para <strong>{pending.email}</strong>. Al confirmarlo con tu cuenta de Google queda publicado; después puedes editarlo cuando quieras.
      </p>

      {error && (
        <div className="flex items-start gap-2 brutalist-border border-red-600 bg-red-50 p-3 mb-4">
          <RiErrorWarningLine className="w-5 h-5 text-red-600 shrink-0" />
          <p className="mono text-xs font-bold uppercase text-red-700">{error}</p>
        </div>
      )}

      {!userEmail ? (
        <button
          onClick={signIn}
          className="w-full inline-flex items-center justify-center gap-2 brutalist-border bg-black text-white px-6 py-4 mono text-sm font-black uppercase hover:bg-[#ff0055] cursor-pointer"
        >
          <RiGoogleFill className="w-5 h-5" />
          Iniciar sesión con Google para confirmar
        </button>
      ) : emailMatches ? (
        <button
          onClick={claim}
          disabled={claiming}
          className="w-full inline-flex items-center justify-center gap-2 brutalist-border bg-[#ff0055] text-white px-6 py-4 mono text-sm font-black uppercase hover:bg-black disabled:opacity-60 cursor-pointer"
        >
          {claiming ? <RiLoader4Line className="w-5 h-5 animate-spin" /> : <RiCheckLine className="w-5 h-5" />}
          {claiming ? 'Publicando…' : 'Aceptar y publicar mi presskit'}
        </button>
      ) : (
        <div>
          <div className="flex items-start gap-2 brutalist-border border-yellow-500 bg-yellow-50 p-3 mb-3">
            <RiErrorWarningLine className="w-5 h-5 text-yellow-600 shrink-0" />
            <p className="mono text-xs font-bold uppercase text-yellow-800">
              Iniciaste sesión como {userEmail}, pero la invitación es para {pending.email}. Cambia de cuenta para confirmar.
            </p>
          </div>
          <button
            onClick={async () => {
              await supabase.auth.signOut();
              await signIn();
            }}
            className="w-full inline-flex items-center justify-center gap-2 brutalist-border bg-black text-white px-6 py-4 mono text-sm font-black uppercase hover:bg-[#ff0055] cursor-pointer"
          >
            <RiGoogleFill className="w-5 h-5" />
            Cambiar de cuenta
          </button>
        </div>
      )}
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
