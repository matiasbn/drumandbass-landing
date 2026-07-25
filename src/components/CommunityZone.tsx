'use client';

import React, { useEffect, useState } from 'react';
import { RiWhatsappLine } from '@remixicon/react';

import { createClient } from '@/src/lib/supabase';
import { WHATSAPP_LINK } from '@/src/constants';
import BrutalistButton from '@/src/components/BigButton';
import JunglistDiscountBadge from '@/src/components/JunglistDiscountBadge';

// Estados según la sesión: invitado (sin registro), junglist (miembro, no DJ) o DJ.
type Status = 'loading' | 'guest' | 'junglist' | 'dj';

const cardCls = 'flex-1 bg-white brutalist-border p-8 relative overflow-hidden';
const decoCls =
  'absolute top-[-20%] right-[-10%] text-9xl font-black opacity-5 pointer-events-none select-none uppercase -rotate-12';

const CommunityZone: React.FC = () => {
  const [status, setStatus] = useState<Status>('loading');
  // Descuentos: los que le corresponden al junglist (discountCount) y cuántos hay
  // activos en total (activeCount, público → sirve para llamar la atención del anon).
  const [discountCount, setDiscountCount] = useState(0);
  const [activeCount, setActiveCount] = useState(0);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setStatus('guest');
        return;
      }
      const [pkRes, jRes] = await Promise.all([
        fetch('/api/pk/profile'),
        fetch('/api/junglist'),
      ]);
      const pk = await pkRes.json().catch(() => ({}));
      const j = await jRes.json().catch(() => ({}));
      if (pk.profile) setStatus('dj'); // un DJ ya es junglist
      else if (j.junglist) setStatus('junglist');
      else setStatus('guest');
    })();
  }, []);

  // Descuentos: para junglist/DJ, los que le corresponden; para todos (incl. anon),
  // cuántos hay activos en total (para llamar la atención a inscribirse).
  useEffect(() => {
    if (status === 'loading') return;
    let alive = true;
    fetch('/api/junglist/discounts')
      .then((r) => (r.ok ? r.json() : { discounts: [], activeCount: 0 }))
      .then((d: { discounts?: unknown[]; activeCount?: number }) => {
        if (!alive) return;
        setDiscountCount((d.discounts || []).length);
        setActiveCount(d.activeCount || 0);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [status]);

  const isDj = status === 'dj';
  const isJunglist = status === 'junglist';

  return (
    <div className="flex flex-col lg:flex-row gap-12">
      {/* Junglist — visible también para DJs (un DJ es junglist y también accede a
          sus descuentos desde su perfil). */}
      <div className={`${cardCls} brutalist-shadow-blue`}>
        <div className="relative z-10">
          <h3 className="text-4xl font-black uppercase mb-4">JUNGLIST</h3>
          {isJunglist || isDj ? (
            <>
              {discountCount > 0 && (
                <div className="mb-6 flex flex-wrap items-center gap-2">
                  <JunglistDiscountBadge />
                  <span className="mono font-bold text-sm uppercase">
                    {discountCount === 1
                      ? 'Tienes 1 descuento activo'
                      : `Tienes ${discountCount} descuentos activos`}
                  </span>
                </div>
              )}
              <p className="mono font-bold text-lg mb-8 uppercase leading-tight">
                {isDj
                  ? 'Como DJ ya eres junglist. Entra a tu perfil para ver tus descuentos y beneficios.'
                  : discountCount > 0
                    ? 'Entra a tu perfil y revisa en qué eventos usar tu descuento.'
                    : 'Ya eres junglist oficial. Revisa o edita tu perfil cuando quieras.'}
              </p>
              <BrutalistButton variant="blue" className="w-full text-2xl py-8" href="/junglist">
                {discountCount > 0 ? 'VER MIS DESCUENTOS' : 'VER MI PERFIL'}
              </BrutalistButton>
            </>
          ) : (
            <>
              {activeCount > 0 && (
                <div className="mb-6 flex flex-wrap items-center gap-2">
                  <JunglistDiscountBadge />
                  <span className="mono font-black text-sm uppercase">
                    {activeCount === 1
                      ? '¡Hay un descuento activo!'
                      : `¡Hay ${activeCount} descuentos activos!`}
                  </span>
                </div>
              )}
              <p className="mono font-bold text-lg mb-8 uppercase leading-tight">
                {activeCount > 0
                  ? 'Inscríbete gratis como junglist y desbloquea tu descuento para los próximos eventos.'
                  : 'Regístrate como junglist oficial y accede a beneficios exclusivos. Estamos preparando preventas, sorteos y avisos antes que nadie para toda la comunidad.'}
              </p>
              <BrutalistButton variant="blue" className="w-full text-2xl py-8" href="/junglist">
                {activeCount > 0 ? 'QUIERO MI DESCUENTO' : 'ENTRA ACÁ, JUNGLIST'}
              </BrutalistButton>
            </>
          )}
        </div>
        <div className={decoCls}>DNB</div>
      </div>

      {/* Presskit / DJ */}
      <div className={`${cardCls} brutalist-shadow-club`}>
        <div className="relative z-10">
          <h3 className="text-4xl font-black uppercase mb-4">PRESSKIT</h3>
          {isDj ? (
            <>
              <p className="mono font-bold text-lg mb-8 uppercase leading-tight">
                Ya eres DJ, con los mismos beneficios que un junglist. Edita tu presskit cuando
                quieras: bio, mixes, géneros y redes.
              </p>
              <BrutalistButton variant="club" className="w-full text-2xl py-8" href="/pk/edit">
                EDITAR MI PRESSKIT
              </BrutalistButton>
            </>
          ) : (
            <>
              <p className="mono font-bold text-lg mb-8 uppercase leading-tight">
                {isJunglist ? '¿También eres DJ? ' : '¿Tocas drum and bass? '}
                Crea tu presskit para compartirlo y publica tus releases en Drum and Bass Chile
                para que todos los vean.
              </p>
              <BrutalistButton variant="club" className="w-full text-2xl py-8" href="/pk">
                PRESSKIT ACÁ!
              </BrutalistButton>
            </>
          )}
        </div>
        <div className={decoCls}>DJ</div>
      </div>

      {/* WhatsApp — siempre igual */}
      <div className={`${cardCls} brutalist-shadow-red`}>
        <div className="relative z-10">
          <h3 className="text-4xl font-black uppercase mb-4">WHATSAPP</h3>
          <p className="mono font-bold text-lg mb-8 uppercase leading-tight">
            Únete a nuestro grupo de WhatsApp para estar al tanto de los próximos eventos y
            conectarte con la comunidad de Drum and Bass en Chile.
          </p>
          <BrutalistButton variant="whatsapp" className="w-full text-2xl py-8" href={WHATSAPP_LINK}>
            <RiWhatsappLine /> ÚNETE AL GRUPO
          </BrutalistButton>
        </div>
        <div className={decoCls}>BASS</div>
      </div>
    </div>
  );
};

export default CommunityZone;
