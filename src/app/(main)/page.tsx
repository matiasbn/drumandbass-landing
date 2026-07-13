import React from 'react';
import type { Metadata } from 'next';

import EventItem from '@/src/components/EventItem';
import CommunityZone from '@/src/components/CommunityZone';
import dayjs from '@/src/lib/date';
import { getEvents } from '@/src/lib/contentful';
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

export const revalidate = 3600;

const Home = async () => {
  const contentfulEvents = await getEvents();

  // En dev, se añaden eventos sintéticos (misma forma que Contentful) para ver
  // todos los estados. En producción MOCK_EVENTS_ENABLED es siempre false.
  const allEvents = MOCK_EVENTS_ENABLED
    ? [...contentfulEvents, ...getMockEvents()]
    : contentfulEvents;

  // Solo eventos que aún no terminan (se ocultan los pasados)
  const now = dayjs();
  const events = allEvents
    .sort((a, b) => dayjs(a.date).unix() - dayjs(b.date).unix())
    .filter((event) => {
      const start = dayjs(event.date);
      const end = event.endDate ? dayjs(event.endDate) : start;
      // Usa el más tardío entre inicio y fin (protege datos con endDate < date).
      const effectiveEnd = end.isAfter(start) ? end : start;
      return effectiveEnd.isAfter(now);
    });

  return (
    <main className="grow">
      {/* Events Section */}
      <section id="events" className="border-b-4 border-black">
        <div className="bg-black text-white py-4 uppercase mono text-4xl lg:text-6xl tracking-[0.2em] font-black marquee-container italic sticky top-0 z-40 border-b-4 border-black">
          <div className="marquee-content">
            <span>
              EVENTOS ★ EVENTOS ★ EVENTOS ★ EVENTOS ★ EVENTOS ★ EVENTOS ★ EVENTOS ★ EVENTOS ★{' '}
            </span>
            <span>
              EVENTOS ★ EVENTOS ★ EVENTOS ★ EVENTOS ★ EVENTOS ★ EVENTOS ★ EVENTOS ★ EVENTOS ★{' '}
            </span>
          </div>
        </div>
        <div className="flex flex-col">
          {events.map((e, index) => (
            <EventItem key={e.id} event={e} index={index} />
          ))}
        </div>
      </section>

      {/* Únete a la comunidad — solo en la home */}
      <section className="p-6 lg:p-12 border-b-4 border-black">
        <h2 className="text-5xl font-black uppercase mb-6 italic">¡Únete a la comunidad!</h2>
        <CommunityZone />
      </section>
    </main>
  );
};

export default Home;
