'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import type { User } from '@supabase/supabase-js';

import { createClient, Junglist } from '@/src/lib/supabase';
import BrutalistButton from '@/src/components/BigButton';

type View = 'loading' | 'anon' | 'form' | 'profile' | 'dj';

interface FormState {
  name: string;
  last_name: string;
  instagram: string;
}

const EMPTY_FORM: FormState = { name: '', last_name: '', instagram: '' };

// Marca Google (G a 4 colores).
const GoogleG = () => (
  <svg width="22" height="22" viewBox="0 0 48 48" aria-hidden="true" className="shrink-0">
    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.9 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.3 6.1 29.4 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z" />
    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.3 6.1 29.4 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
    <path fill="#4CAF50" d="M24 44c5.2 0 10-2 13.6-5.2l-6.3-5.2C29.2 35.1 26.7 36 24 36c-5.3 0-9.7-3.1-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4 5.6l6.3 5.2C41.9 35.7 44 30.3 44 24c0-1.3-.1-2.3-.4-3.5z" />
  </svg>
);

const labelCls = 'mono text-xs font-black uppercase tracking-widest mb-1 block';
const inputCls =
  'w-full border-4 border-black p-3 mono font-bold text-lg focus:outline-none focus:bg-yellow-50';

export default function JunglistClient() {
  const [supabase] = useState(() => createClient());
  const [view, setView] = useState<View>('loading');
  const [user, setUser] = useState<User | null>(null);
  const [junglist, setJunglist] = useState<Junglist | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    let user;
    try {
      ({ data: { user } } = await supabase.auth.getUser());
    } catch {
      setView('anon');
      return;
    }
    if (!user) {
      setView('anon');
      return;
    }
    setUser(user);

    // Usamos la sesión para diferenciar: ¿es DJ (pk_profile) y/o junglist?
    const [jRes, pkRes] = await Promise.all([
      fetch('/api/junglist'),
      fetch('/api/pk/profile'),
    ]);
    const data = await jRes.json().catch(() => ({}));
    const pkData = await pkRes.json().catch(() => ({}));

    // Un DJ ya es junglist (por unión): no se le pide registro junglist.
    if (pkData.profile) {
      setView('dj');
      return;
    }

    if (data.junglist) {
      setJunglist(data.junglist);
      setView('profile');
    } else {
      // Prellenar nombre/apellido con datos de la propia cuenta de Google (no de nuestra DB).
      const meta = (user.user_metadata || {}) as Record<string, string>;
      const full = meta.full_name || meta.name || '';
      setForm({
        name: meta.given_name || full.split(' ')[0] || '',
        last_name: meta.family_name || full.split(' ').slice(1).join(' ') || '',
        instagram: '',
      });
      setView('form');
    }
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  const signIn = async () => {
    setSubmitting(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback?next=/junglist` },
    });
    if (error) {
      setError('No pudimos iniciar sesión. Intenta de nuevo.');
      setSubmitting(false);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setJunglist(null);
    setForm(EMPTY_FORM);
    setError(null);
    setView('anon');
  };

  const save = async (method: 'POST' | 'PUT') => {
    setSubmitting(true);
    setError(null);
    const res = await fetch('/api/junglist', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const data = await res.json().catch(() => ({}));
    setSubmitting(false);
    if (!res.ok) {
      setError(data.error || 'Algo salió mal. Intenta de nuevo.');
      return;
    }
    setJunglist(data.junglist);
    setView('profile');
  };

  const unsubscribe = async () => {
    if (!window.confirm('¿Darte de baja como junglist? Podrás volver a registrarte cuando quieras.')) {
      return;
    }
    setSubmitting(true);
    setError(null);
    const res = await fetch('/api/junglist', { method: 'DELETE' });
    setSubmitting(false);
    if (!res.ok) {
      setError('No pudimos darte de baja. Intenta de nuevo.');
      return;
    }
    setJunglist(null);
    setForm(EMPTY_FORM);
    setView('form');
  };

  const update = (field: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  return (
    <main className="grow p-6 lg:p-12 flex justify-center">
      <div className="w-full max-w-2xl">
        <Link
          href="/"
          className="mono text-xs font-black uppercase tracking-widest text-gray-500 hover:text-black inline-block mb-2"
        >
          ← Volver al inicio
        </Link>
        <h1 className="text-5xl lg:text-7xl font-black uppercase italic tracking-tighter mb-2">
          Junglist
        </h1>

        {view === 'loading' && (
          <p className="mono font-bold uppercase text-gray-500">Cargando…</p>
        )}

        {/* No logueado */}
        {view === 'anon' && (
          <div className="brutalist-border brutalist-shadow-blue bg-white p-8 mt-6">
            <p className="mono font-bold text-lg uppercase leading-tight mb-8">
              Inscríbete como miembro oficial de la comunidad y accede a beneficios exclusivos:
              preventas, sorteos y avisos antes que nadie. Usamos Google para evitar spam.
            </p>
            <BrutalistButton
              variant="primary"
              className="w-full text-xl py-6"
              onClick={signIn}
              disabled={submitting}
            >
              <GoogleG /> {submitting ? 'Redirigiendo…' : 'Registrarme o iniciar sesión'}
            </BrutalistButton>
          </div>
        )}

        {/* Logueado y DJ: ya es miembro (mismos beneficios que junglist) */}
        {view === 'dj' && (
          <div className="brutalist-border brutalist-shadow-club bg-white p-8 mt-6">
            <div className="mono text-xs font-black uppercase tracking-widest bg-[#7C3AED] text-white px-3 py-1.5 inline-block mb-6">
              DJ · Miembro oficial
            </div>
            <p className="mono font-bold text-lg uppercase leading-tight mb-8">
              Como DJ ya eres parte de la comunidad, con los mismos beneficios que un junglist.
              No necesitas registrarte aparte. Administra tu presskit cuando quieras.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <BrutalistButton variant="club" className="flex-1 text-lg py-5" href="/pk/edit">
                Editar mi presskit
              </BrutalistButton>
              <BrutalistButton variant="primary" className="text-lg py-5" onClick={signOut} disabled={submitting}>
                Cerrar sesión
              </BrutalistButton>
            </div>
          </div>
        )}

        {/* Logueado sin registro: formulario */}
        {view === 'form' && (
          <div className="brutalist-border brutalist-shadow-blue bg-white p-8 mt-6">
            <p className="mono font-bold uppercase text-gray-600 mb-6 leading-tight">
              Completa tus datos para inscribirte como miembro oficial.
            </p>
            <div className="flex flex-col gap-4">
              <div>
                <label className={labelCls}>Nombre</label>
                <input className={inputCls} value={form.name} onChange={update('name')} placeholder="Tu nombre" />
              </div>
              <div>
                <label className={labelCls}>Apellido</label>
                <input className={inputCls} value={form.last_name} onChange={update('last_name')} placeholder="Tu apellido" />
              </div>
              <div>
                <label className={labelCls}>Instagram</label>
                <input className={inputCls} value={form.instagram} onChange={update('instagram')} placeholder="tu_usuario" />
              </div>
              <div>
                <label className={labelCls}>Correo</label>
                <input className={`${inputCls} bg-gray-100 text-gray-500`} value={user?.email || ''} disabled readOnly />
              </div>
            </div>

            {error && <p className="mono font-bold uppercase text-[#ff0000] mt-4">{error}</p>}

            <div className="flex flex-col sm:flex-row gap-3 mt-8">
              <BrutalistButton variant="blue" className="flex-1 text-lg py-5" onClick={() => save('POST')} disabled={submitting}>
                {submitting ? 'Inscribiendo…' : 'Inscribirme'}
              </BrutalistButton>
              <BrutalistButton variant="primary" className="text-lg py-5" onClick={signOut} disabled={submitting}>
                Cerrar sesión
              </BrutalistButton>
            </div>
          </div>
        )}

        {/* Logueado con registro: perfil */}
        {view === 'profile' && junglist && (
          <div className="brutalist-border brutalist-shadow-blue bg-white p-8 mt-6">
            <div className="mono text-xs font-black uppercase tracking-widest bg-[#0000ff] text-white px-3 py-1.5 inline-block mb-6">
              Miembro oficial
            </div>

            <div className="flex flex-col gap-4">
              <div>
                <label className={labelCls}>Nombre</label>
                <input className={inputCls} value={form.name || junglist.name} onChange={update('name')} />
              </div>
              <div>
                <label className={labelCls}>Apellido</label>
                <input className={inputCls} value={form.last_name || junglist.last_name} onChange={update('last_name')} />
              </div>
              <div>
                <label className={labelCls}>Instagram</label>
                <input className={inputCls} value={form.instagram || junglist.instagram} onChange={update('instagram')} />
              </div>
              <div>
                <label className={labelCls}>Correo</label>
                <input className={`${inputCls} bg-gray-100 text-gray-500`} value={junglist.email} disabled readOnly />
              </div>
            </div>

            {error && <p className="mono font-bold uppercase text-[#ff0000] mt-4">{error}</p>}

            <div className="flex flex-col sm:flex-row gap-3 mt-8">
              <BrutalistButton
                variant="blue"
                className="flex-1 text-lg py-5"
                onClick={() => {
                  // asegura que los inputs tengan valores antes de guardar
                  setForm((f) => ({
                    name: f.name || junglist.name,
                    last_name: f.last_name || junglist.last_name,
                    instagram: f.instagram || junglist.instagram,
                  }));
                  save('PUT');
                }}
                disabled={submitting}
              >
                {submitting ? 'Guardando…' : 'Guardar cambios'}
              </BrutalistButton>
              <BrutalistButton variant="primary" className="text-lg py-5" onClick={signOut} disabled={submitting}>
                Cerrar sesión
              </BrutalistButton>
            </div>

            {/* Un junglist puede además hacerse DJ */}
            <div className="border-t-4 border-black mt-8 pt-6">
              <p className="mono text-sm font-black uppercase mb-3">¿También eres DJ?</p>
              <BrutalistButton variant="club" className="w-full text-lg py-4" href="/pk">
                Crear mi presskit
              </BrutalistButton>
            </div>

            <button
              onClick={unsubscribe}
              disabled={submitting}
              className="mono text-xs font-bold uppercase underline text-gray-500 hover:text-[#ff0000] mt-6 disabled:opacity-40"
            >
              Darme de baja
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
