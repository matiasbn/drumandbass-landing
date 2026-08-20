import React from 'react';
import type { Metadata } from 'next';

import EventItem from '@/src/components/EventItem';
import EventsCarousel from '@/src/components/EventsCarousel';
import CommunityZone from '@/src/components/CommunityZone';
import SotanoSection from '@/src/components/SotanoSection';
import NationalReleasesSection from '@/src/components/NationalReleasesSection';
import dayjs, { CHILE_TZ } from '@/src/lib/date';
import { getEvents } from '@/src/lib/cms';
import { getMockEvents, MOCK_EVENTS_ENABLED } from '@/src/lib/mockEvents';

export const metadata: Metadata = {
  title: 'Eventos Drum and Bass en Chile',
  description:
    'Próximos eventos de Drum and Bass en Chile. Fiestas, festivales y encuentros de la comunidad DNB chilena.',
  keywords: [
    'eventos drum and bass',
    'fiestas DNB Chile',
    'bass music eventos',
    'drum and bass Santiago',
    'Drum and Bass Chile eventos',
    'eventos DNB Chile',
  ],
  alternates: {
    canonical: '/',
  },
};

// ISR del home para los EVENTOS (60s). El Sótano ya NO depende de esto: se carga
// client-side vía <SotanoSection/> (/api/sotano), así un capítulo nuevo aparece
// casi al instante sin esperar esta caché. Los eventos igual se revalidan al
// instante vía revalidatePath al editar en el admin.
export const revalidate = 60;

const Home = async () => {
  const cmsEvents = await getEvents();

  // En dev, se añaden eventos sintéticos (misma forma que el CMS) para ver
  // todos los estados. En producción MOCK_EVENTS_ENABLED es siempre false.
  const allEvents = MOCK_EVENTS_ENABLED
    ? [...cmsEvents, ...getMockEvents()]
    : cmsEvents;

  // Solo eventos que aún no terminan (se ocultan los pasados)
  const now = dayjs();
  const events = allEvents
    .sort((a, b) => dayjs(a.date).unix() - dayjs(b.date).unix())
    .filter((event) => {
      // Las fechas son hora de Chile: se interpretan en esa zona para que la
      // vigencia sea correcta también en el server (UTC), no solo en local.
      const start = dayjs.tz(event.date, CHILE_TZ);
      const end = event.endDate ? dayjs.tz(event.endDate, CHILE_TZ) : start;
      // Usa el más tardío entre inicio y fin (protege datos con endDate < date).
      const effectiveEnd = end.isAfter(start) ? end : start;
      return effectiveEnd.isAfter(now);
    });

  return (
    <main className="grow">
      {/* Events Section */}
      <section id="events" className="border-b-4 border-black">
        <div className="bg-black text-white py-4 lg:py-1.5 uppercase mono text-4xl lg:text-2xl tracking-[0.2em] font-black marquee-container italic sticky top-0 z-40 border-b-4 border-black">
          <div className="marquee-content">
            <span>
              EVENTOS ★ EVENTOS ★ EVENTOS ★ EVENTOS ★ EVENTOS ★ EVENTOS ★ EVENTOS ★ EVENTOS ★{' '}
            </span>
            <span>
              EVENTOS ★ EVENTOS ★ EVENTOS ★ EVENTOS ★ EVENTOS ★ EVENTOS ★ EVENTOS ★ EVENTOS ★{' '}
            </span>
          </div>
        </div>
        <div className="bg-white">
          {/* Móvil + tablet: diseño clásico (EventItem), que funciona bien en pantallas
              chicas. El rediseño con destacado + grilla es solo para desktop. */}
          <div className="flex flex-col lg:hidden">
            {events.map((e, index) => (
              <EventItem key={e.id} event={e} index={index} />
            ))}
          </div>

          {/* Desktop (lg+): carrusel de tarjetas destacadas; el siguiente evento se
              asoma por la derecha para que se note que hay más y se puedan recorrer. */}
          <div className="hidden lg:block p-[clamp(0.5rem,1vw,1rem)]">
            <EventsCarousel events={events} />
          </div>
        </div>
      </section>

      {/* Únete a la comunidad — solo en la home */}
      <section className="p-6 lg:p-12 border-b-4 border-black">
        <h2 className="text-5xl font-black uppercase mb-6 italic">¡Únete a la comunidad!</h2>
        <CommunityZone />
      </section>

      {/* Releases Nacionales — carga client-side (siempre fresco), antes de El Sótano */}
      <NationalReleasesSection />

      {/* El Sótano (YouTube) — carga client-side (siempre fresco, sin caché del home) */}
      <SotanoSection />
    </main>
  );
};

export default Home;
