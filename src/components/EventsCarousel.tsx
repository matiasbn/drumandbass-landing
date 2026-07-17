'use client';

import React, { useRef } from 'react';
import { RiArrowLeftSLine, RiArrowRightSLine } from '@remixicon/react';

import { CmsEvent } from '../types/types';
import EventCard from './EventCard';

// Carrusel de eventos para DESKTOP: cada slide es una tarjeta destacada (grande) a
// ancho casi completo, dejando asomar el siguiente evento por la derecha para que se
// note que hay más y se puedan recorrer con las flechas. Solo el primero lleva el
// rótulo "PRÓXIMO EVENTO" (ver EventCard). Las flechas se auto-trackean por
// ClickTracker vía data-track.
export default function EventsCarousel({ events }: { events: CmsEvent[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const multiple = events.length > 1;

  const scroll = (dir: number) => {
    const el = ref.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.9, behavior: 'smooth' });
  };

  return (
    <div className="relative">
      <div
        ref={ref}
        className="flex gap-4 overflow-x-auto snap-x snap-mandatory scroll-smooth [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      >
        {events.map((e, i) => (
          <div key={e.id} className={`snap-start shrink-0 ${multiple ? 'w-[93%]' : 'w-full'}`}>
            <EventCard event={e} index={i} featured />
          </div>
        ))}
      </div>

      {multiple && (
        <>
          <button
            type="button"
            aria-label="Evento anterior"
            data-track="carrusel_evento_anterior"
            onClick={() => scroll(-1)}
            className="absolute left-3 top-1/2 -translate-y-1/2 z-20 brutalist-border brutalist-shadow bg-white text-black hover:bg-[#ff0055] hover:text-white transition-colors p-2"
          >
            <RiArrowLeftSLine size={28} />
          </button>
          <button
            type="button"
            aria-label="Evento siguiente"
            data-track="carrusel_evento_siguiente"
            onClick={() => scroll(1)}
            className="absolute right-3 top-1/2 -translate-y-1/2 z-20 brutalist-border brutalist-shadow bg-white text-black hover:bg-[#ff0055] hover:text-white transition-colors p-2"
          >
            <RiArrowRightSLine size={28} />
          </button>
        </>
      )}
    </div>
  );
}
