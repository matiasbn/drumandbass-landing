
import React from 'react';

import EventItem from '@/src/components/EventItem';
import dayjs from '@/src/lib/date'
import { getEvents } from '@/src/lib/contentful';


export const revalidate = 3600;

const Home = async () => {
  const contentfulEvents = await getEvents();

  // Eventos desde ayer en adelante
  const events = contentfulEvents
    .sort((a, b) => dayjs(a.date).unix() - dayjs(b.date).unix())
    .filter(event => dayjs(event.endDate ?? event.date).isAfter(dayjs().subtract(1, 'day')))

  return (
      <main className="grow">
        {/* Events Section */}
        <section id="events" className="border-b-4 border-black">
          <div className="bg-black text-white py-4 uppercase mono text-4xl lg:text-6xl tracking-[0.2em] font-black marquee-container italic sticky top-0 z-40 border-b-4 border-black">
            <div className="marquee-content">
              <span>EVENTOS ★ EVENTOS ★ EVENTOS ★ EVENTOS ★ EVENTOS ★ EVENTOS ★ EVENTOS ★ EVENTOS ★ </span>
              <span>EVENTOS ★ EVENTOS ★ EVENTOS ★ EVENTOS ★ EVENTOS ★ EVENTOS ★ EVENTOS ★ EVENTOS ★ </span>
            </div>
          </div>
          <div className="flex flex-col">
            {events.map((e, index) => (
              <EventItem key={e.id} event={e} index={index} />
            ))}
          </div>
        </section>
      </main>
  );
};

export default Home;
