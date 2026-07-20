'use client';

import { useEffect, useState } from 'react';
import { RiCoupon3Line } from '@remixicon/react';

import { createClient } from '@/src/lib/supabase';
import { event } from '@/src/lib/gtag';
import BigButton from '@/src/components/BigButton';

type State =
  | { kind: 'loading' }
  | { kind: 'anon' }
  | { kind: 'not_junglist' }
  | { kind: 'ok'; code: string; isNew: boolean };

/**
 * Descuento Junglist de un evento. El código NO viene en el HTML de la página
 * (es ISR y público): se pide a /api/evento/[id]/coupon, que lo revela solo si
 * hay sesión y el usuario es junglist —y elige el código de "junglist nuevo" o
 * el de "ya registrado" según su fecha de registro.
 */
export default function EventCouponBlock({
  eventId,
  eventTitle,
}: {
  eventId: string;
  eventTitle: string;
}) {
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!alive) return;
      if (!user) {
        setState({ kind: 'anon' });
        return;
      }
      try {
        const res = await fetch(`/api/evento/${eventId}/coupon`);
        const data = await res.json();
        if (!alive) return;
        if (data.status === 'ok') {
          setState({ kind: 'ok', code: data.code, isNew: data.kind === 'new' });
          event('junglist_coupon_view', {
            event_id: eventId,
            event_title: eventTitle,
            coupon_kind: data.kind,
          });
        } else {
          setState({ kind: 'not_junglist' });
        }
      } catch {
        if (alive) setState({ kind: 'not_junglist' });
      }
    })();
    return () => {
      alive = false;
    };
  }, [eventId, eventTitle]);

  const login = async () => {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/evento/${eventId}`,
      },
    });
  };

  const copy = async () => {
    if (state.kind !== 'ok') return;
    try {
      await navigator.clipboard.writeText(state.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      event('junglist_coupon_copy', { event_id: eventId, event_title: eventTitle });
    } catch {
      // sin portapapeles: el código igual está a la vista
    }
  };

  if (state.kind === 'loading') return null;

  return (
    <section
      data-section="Descuento Junglist"
      className="p-6 lg:p-12 border-b-4 border-black bg-[#ff0055] text-white"
    >
      <div className="flex items-center gap-3 mb-2">
        <RiCoupon3Line size={32} />
        <h2 className="text-3xl lg:text-5xl font-black uppercase italic">Descuento Junglist</h2>
      </div>

      {state.kind === 'ok' ? (
        <>
          <p className="mono text-sm lg:text-base font-bold uppercase mb-6 leading-tight">
            {state.isNew
              ? '¡Bienvenido a la comunidad! Este es tu código de descuento para este evento.'
              : 'Por ser Junglist, este es tu código de descuento para este evento.'}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center">
            <span className="brutalist-border bg-white text-black px-8 py-5 text-2xl lg:text-4xl font-black tracking-widest text-center break-all">
              {state.code}
            </span>
            <button
              type="button"
              onClick={copy}
              className="brutalist-border bg-black text-white px-6 py-4 font-bold uppercase hover:bg-gray-900 transition-colors cursor-pointer"
            >
              {copied ? '¡Copiado!' : 'Copiar código'}
            </button>
          </div>
          <p className="mono text-xs uppercase mt-4 opacity-80">
            Úsalo al comprar tu ticket.
          </p>
        </>
      ) : (
        <>
          <p className="mono text-sm lg:text-base font-bold uppercase mb-6 leading-tight">
            {state.kind === 'anon'
              ? 'Este evento tiene descuento para Junglists. Inscríbete gratis y accede al tuyo, o inicia sesión si ya eres Junglist.'
              : 'Este evento tiene descuento para Junglists. Completa tu registro gratis y accede al tuyo.'}
          </p>
          <div className="flex flex-col lg:flex-row gap-4">
            <BigButton
              variant="blue"
              className="flex-1 text-lg py-6"
              href={`/junglist?next=/evento/${eventId}`}
            >
              {state.kind === 'anon' ? 'Inscríbete y obtén tu descuento' : 'Completa tu registro'}
            </BigButton>
            {state.kind === 'anon' && (
              <button
                type="button"
                onClick={login}
                className="flex-1 brutalist-border bg-white text-black text-lg py-6 px-6 font-bold uppercase hover:bg-gray-100 transition-colors cursor-pointer"
              >
                Ya soy Junglist, iniciar sesión
              </button>
            )}
          </div>
        </>
      )}
    </section>
  );
}
