
import React from 'react';

import EventItem from '@/src/components/EventItem';
import dayjs from '@/src/lib/date'
import { getEvents } from '@/src/lib/contentful';


const Home = async () => {
  const contentfulEvents = await getEvents();

  // Eventos desde ayer en adelante
  const events = contentfulEvents
    .sort((a, b) => dayjs(a.date).unix() - dayjs(b.date).unix())
    .filter(event => dayjs(event.date).isAfter(dayjs().subtract(1, 'day')))

  const heroLinks = [
    { href: '/artistas', label: 'Artistas' },
    { href: '/productores', label: 'Productores' },
    { href: '/organizaciones', label: 'Organizaciones' },
  ];
    
  return (
      <main className="flex-grow">
        {/* Hero Section */}
        <section className="p-6 lg:p-12 border-b-4 border-black bg-[#ff0000] text-white">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-5xl lg:text-[5em] xl:text-[8em] font-black uppercase leading-[1]  tracking-tighter italic mb-4 lg:mb-8 drop-shadow-[5px_5px_0px_rgba(0,0,0,1)] lg:drop-shadow-[7px_7px_0px_rgba(0,0,0,1)]">
              La comunidad de  <br/> DRUM & BASS de <br /> <span className="text-[#0000ff]">CHILE 🇨🇱</span>
            </h2>
            
            {/* Directory Links Grid */}
            <div className="flex flex-col md:flex-row gap-6">
              {heroLinks.map((link) => (
                <a key={link.href} href={link.href} title={link.label} className="lg:flex-1/3 group p-3 lg:p-6 bg-black text-white border-4 border-black hover:bg-white hover:text-black transition-all brutalist-shadow-blue hover:translate-x-1 hover:translate-y-1 hover:shadow-none">
                  <h3 className="text-4xl md:text-3xl lg:text-4xl font-black uppercase italic leading-none group-hover:tracking-widest transition-all">{link.label}</h3>
                </a>
              ))}
            </div>
          </div>
        </section>

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
