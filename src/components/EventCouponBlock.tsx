'use client';

import { useEffect, useState } from 'react';
import { RiCoupon3Line, RiFileCopyLine, RiCheckLine } from '@remixicon/react';

import { createClient } from '@/src/lib/supabase';
import { event } from '@/src/lib/gtag';
import BigButton from '@/src/components/BigButton';

type State =
  | { kind: 'loading' }
  | { kind: 'anon' }
  /** Con sesión pero sin cuenta de junglist: inscribirse podría darle el cupón. */
  | { kind: 'not_junglist' }
  /** Ya es junglist y a su perfil no le corresponde descuento: no hay nada que ofrecer. */
  | { kind: 'no_coupon' }
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
  couponForNew,
  couponForExisting,
}: {
  eventId: string;
  eventTitle: string;
  /** Hay código para quien se inscriba a partir de ahora. */
  couponForNew: boolean;
  /** Hay código para quien ya era junglist. */
  couponForExisting: boolean;
}) {
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [copied, setCopied] = useState(false);
  // El código depende de la cuenta, así que hay que decir cuál es: con varias
  // cuentas de Google, "eres Junglist" sin decir quién no significa nada.
  const [userEmail, setUserEmail] = useState<string | null>(null);
  // Si eligió seguir sin inscribirse, el banner se colapsa a una franja.
  const [dismissed, setDismissed] = useState(false);

  const dismissKey = `dnb:coupon-dismissed:${eventId}`;

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(dismissKey) === '1');
    } catch {
      // sin localStorage el banner simplemente se muestra siempre
    }
  }, [dismissKey]);

  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(dismissKey, '1');
    } catch {
      // la elección igual vale durante esta visita
    }
    event('junglist_coupon_dismiss', { event_id: eventId, event_title: eventTitle });
  };

  const restore = () => {
    setDismissed(false);
    try {
      localStorage.removeItem(dismissKey);
    } catch {
      // no pasa nada: el estado en memoria ya se restauró
    }
  };

  useEffect(() => {
    let alive = true;

    // Sin token de Supabase no hay sesión posible, y eso se sabe de inmediato: se
    // pinta la puerta en el primer frame en vez de esperar el round-trip de
    // getUser(). Quien llega desde el correo suele ser anónimo, y ver el evento y
    // que la puerta caiga encima un segundo después es peor que verla de entrada.
    //
    // El token va en COOKIES, no en localStorage: el cliente se crea con
    // createBrowserClient de @supabase/ssr para que el servidor pueda leer la
    // sesión. Buscarlo en localStorage daría siempre "anónimo".
    try {
      const hasSession = document.cookie.split(';').some(c => c.trim().startsWith('sb-'));
      if (!hasSession) {
        setState({ kind: 'anon' });
        return;
      }
    } catch {
      // sin acceso a cookies se sigue por la vía normal
    }

    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!alive) return;
      if (!user) {
        setState({ kind: 'anon' });
        return;
      }
      setUserEmail(user.email ?? null);
      try {
        const res = await fetch(`/api/evento/${eventId}/coupon`);
        const data = await res.json();
        if (!alive) return;
        if (data.status === 'ok') {
          // Siempre en mayúscula (display y "copiar" coinciden, incluso códigos viejos).
          setState({ kind: 'ok', code: String(data.code || '').toUpperCase(), isNew: data.kind === 'new' });
          event('junglist_coupon_view', {
            event_id: eventId,
            event_title: eventTitle,
            coupon_kind: data.kind,
          });
        } else {
          setState({ kind: data.isJunglist ? 'no_coupon' : 'not_junglist' });
        }
      } catch {
        if (alive) setState({ kind: 'no_coupon' });
      }
    })();
    return () => {
      alive = false;
    };
  }, [eventId, eventTitle]);

  // ¿Este visitante podría canjear algo? Si no, no se le ofrece nada y ve la
  // landing normal. Un anónimo puede ser cualquiera de los dos perfiles, así que
  // basta con que exista algún cupón; alguien con sesión y sin cuenta de junglist
  // solo puede aspirar al de "nuevo"; y si ya es junglist sin cupón, no hay nada.
  const canGetCoupon =
    state.kind === 'anon'
      ? couponForNew || couponForExisting
      : state.kind === 'not_junglist'
        ? couponForNew
        : false;

  // Mientras la puerta está abierta, el evento de atrás no debe poder scrollearse.
  const gateOpen = state.kind !== 'loading' && state.kind !== 'ok' && !dismissed && canGetCoupon;
  useEffect(() => {
    if (!gateOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [gateOpen]);

  // Salir y volver a elegir cuenta: el caso real es tener varias de Google y no
  // saber con cuál entraste.
  const switchAccount = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    await login();
  };

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
      // Registro propio (fiable), atribuido al destinatario si llegó desde un
      // correo de campaña. La URL manda; si no trae ct (p. ej. volviste del OAuth
      // de inscripción), se usa el guardado al aterrizar, pero solo si es reciente
      // (TTL 1 h) para no atribuir con un ct viejo. Log genérico → cualquier campaña.
      let ct: string | null = new URLSearchParams(window.location.search).get('ct');
      if (!ct) {
        try {
          const raw = sessionStorage.getItem(`dnb:ct:${eventId}`);
          if (raw) {
            const saved = JSON.parse(raw) as { ct?: string; at?: number };
            if (saved.ct && saved.at && Date.now() - saved.at < 60 * 60 * 1000) {
              ct = saved.ct;
            }
          }
        } catch {
          // sin sessionStorage / json inválido: queda solo el de la URL
        }
      }
      if (ct) {
        fetch('/api/campaign-action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ct, action: 'coupon_copy' }),
          keepalive: true,
        }).catch(() => {});
      }
    } catch {
      // sin portapapeles: el código igual está a la vista
    }
  };

  if (state.kind === 'loading') return null;

  // Ya es junglist pero a su perfil no le toca descuento (p. ej. es solo para
  // nuevos). Se le da feedback claro en vez de silencio: sabe que es miembro y
  // que acá no hay nada que canjear. No bloquea la página.
  if (state.kind === 'no_coupon') {
    return (
      <section
        data-section="Descuento Junglist"
        className="p-6 lg:p-12 border-b-4 border-black bg-black text-white"
      >
        <div className="flex items-center gap-3 mb-2">
          <RiCoupon3Line size={28} />
          <h2 className="text-2xl lg:text-4xl font-black uppercase italic">Ya eres Junglist ✓</h2>
        </div>
        <p className="mono text-sm lg:text-base font-bold uppercase leading-tight opacity-80">
          Este evento tiene descuento solo para otro perfil de Junglist, así que esta vez no hay
          código para ti. Igual nos vemos en la pista.
        </p>
        {userEmail && (
          <p className="mono text-xs mt-4 opacity-60">
            Conectado como <strong>{userEmail}</strong>
          </p>
        )}
      </section>
    );
  }

  // No es junglist y no hay nada que ofrecerle (el cupón no aplica a su caso):
  // solo la landing del evento.
  if (state.kind !== 'ok' && !canGetCoupon) return null;

  // Ya es junglist y tiene código: se muestra en la página, sin bloquearla.
  if (state.kind === 'ok') {
    return (
      <section
        data-section="Descuento Junglist"
        className="p-6 lg:p-12 border-b-4 border-black bg-[#ff0055] text-white"
      >
        <div className="flex items-center gap-3 mb-2">
          <RiCoupon3Line size={32} />
          <h2 className="text-3xl lg:text-5xl font-black uppercase italic">Tu descuento Junglist</h2>
        </div>
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
            className="brutalist-border bg-black text-white px-6 py-4 font-bold uppercase hover:bg-gray-900 transition-colors cursor-pointer inline-flex items-center justify-center gap-2"
          >
            {copied ? <RiCheckLine size={20} /> : <RiFileCopyLine size={20} />}
            {copied ? '¡Copiado!' : 'Copiar código'}
          </button>
        </div>
        <p className="mono text-xs uppercase mt-4 opacity-80">Úsalo al comprar tu ticket.</p>
        {userEmail && (
          <p className="mono text-xs mt-4 opacity-80">
            Conectado como <strong>{userEmail}</strong>
            {' · '}
            <button
              type="button"
              onClick={switchAccount}
              className="underline hover:opacity-100 cursor-pointer"
            >
              Cambiar cuenta
            </button>
          </p>
        )}
      </section>
    );
  }

  // Eligió seguir sin inscribirse: queda una franja discreta por si se arrepiente.
  if (dismissed) {
    return (
      <button
        type="button"
        onClick={restore}
        data-section="Descuento Junglist"
        className="w-full border-b-4 border-black bg-black text-white px-6 py-3 mono text-xs font-bold uppercase text-left hover:bg-gray-900 transition-colors cursor-pointer"
      >
        <RiCoupon3Line size={16} className="inline mr-2 align-text-bottom" />
        Este evento tiene descuento para Junglists — ver cómo obtenerlo
      </button>
    );
  }

  // Puerta a pantalla completa: al llegar desde el correo, lo único que se ve es
  // la decisión —inscribirse/entrar, o seguir al evento sin descuento.
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Descuento Junglist"
      data-section="Descuento Junglist"
      className="fixed inset-0 z-50 bg-[#ff0055] text-white overflow-y-auto flex items-center justify-center p-6"
    >
      <div className="w-full max-w-2xl">
        <RiCoupon3Line size={56} className="mb-4" />
        <h2 className="text-4xl lg:text-6xl font-black uppercase italic leading-none mb-4">
          {eventTitle} tiene descuento para Junglists
        </h2>
        <p className="mono text-sm lg:text-base font-bold uppercase mb-8 leading-tight">
          {!couponForNew
            ? 'El descuento es para Junglists ya registrados. Inicia sesión para ver si tienes.'
            : 'Ser Junglist es gratis. Inscríbete o inicia sesión para ver si tienes descuento.'}
        </p>

        <div className="flex flex-col gap-4">
          {/* Un solo camino al descuento: /junglist unifica inscribirse e iniciar
              sesión (y devuelve al evento después). */}
          <BigButton
            variant="blue"
            className="w-full text-lg py-6"
            href={`/junglist?next=/evento/${eventId}`}
          >
            {couponForNew ? 'Inscríbete o inicia sesión' : 'Inicia sesión para ver tu descuento'}
          </BigButton>

          {/* Opt-out: solo quiere ver el evento, sin el descuento. */}
          <button
            type="button"
            onClick={dismiss}
            className="w-full brutalist-border bg-white text-black py-4 px-6 font-bold uppercase text-sm hover:bg-gray-100 transition-colors cursor-pointer"
          >
            No quiero descuento, llévame al evento
          </button>
        </div>
      </div>
    </div>
  );
}
