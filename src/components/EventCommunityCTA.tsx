'use client';

import { useEffect, useState } from 'react';
import { RiWhatsappLine } from '@remixicon/react';

import { createClient } from '@/src/lib/supabase';
import { MOCK_AUTH_ENABLED, readMockPersona, SOCIAL } from '@/src/lib/devAuth';
import { WHATSAPP_LINK } from '@/src/constants';
import BigButton from '@/src/components/BigButton';

/**
 * CTA de comunidad de la landing de evento. Es consciente de la sesión porque
 * si no, la página se contradice: arriba le dice "eres Junglist, este es tu
 * código" y abajo "únete como Junglist". A quien ya es junglist (o DJ, que
 * siempre lo es) se le ofrece su perfil, no que se inscriba de nuevo.
 */
export default function EventCommunityCTA() {
  const [isJunglist, setIsJunglist] = useState<boolean | null>(null);

  useEffect(() => {
    let alive = true;
    if (MOCK_AUTH_ENABLED) {
      const persona = readMockPersona();
      if (persona && persona !== SOCIAL) {
        setIsJunglist(persona.isJunglist);
        return;
      }
      // 'social' cae a la sesión real de abajo.
    }

    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!alive) return;
      if (!user) {
        setIsJunglist(false);
        return;
      }
      try {
        const [jung, pk] = await Promise.all([
          fetch('/api/junglist').then(r => (r.ok ? r.json() : null)),
          fetch('/api/pk/profile').then(r => (r.ok ? r.json() : null)),
        ]);
        if (!alive) return;
        setIsJunglist(Boolean(jung?.junglist || pk?.profile));
      } catch {
        if (alive) setIsJunglist(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <section data-section="Comunidad" className="p-6 lg:p-12 border-b-4 border-black">
      <h2 className="text-3xl lg:text-5xl font-black uppercase italic mb-2">
        {isJunglist ? 'Sigue conectado' : 'Súmate a la comunidad'}
      </h2>
      <p className="mono text-sm lg:text-base font-bold uppercase opacity-60 mb-6 leading-tight">
        {isJunglist
          ? 'Ya eres parte. Acá se arma lo que viene.'
          : 'Compres o no ticket, hay más movidas de Drum and Bass en Chile esperándote.'}
      </p>

      <div className="flex flex-col lg:flex-row gap-4">
        {/* Hasta saber quién es, no se muestra: un parpadeo de "únete" a alguien
            que ya es junglist es exactamente la contradicción que se quiere evitar. */}
        {isJunglist !== null && (
          <BigButton variant="blue" className="flex-1 text-lg py-6" href="/junglist">
            {isJunglist ? 'Mi perfil Junglist' : 'Únete como Junglist'}
          </BigButton>
        )}
        <BigButton variant="whatsapp" className="flex-1 text-lg py-6" href={WHATSAPP_LINK}>
          <RiWhatsappLine /> Grupo de WhatsApp
        </BigButton>
      </div>
    </section>
  );
}
