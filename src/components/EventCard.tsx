import React from 'react';
import dayjs from 'dayjs';
import Image from 'next/image';
import { documentToHtmlString } from '@contentful/rich-text-html-renderer';

import { ContentfulEvent } from '../types/types';
import TicketButton from './TicketButton';
import ProximityBadge from './ProximityBadge';

interface EventCardProps {
  event: ContentfulEvent;
  index: number;
  /** El destacado (próximo evento): misma tarjeta pero más grande y a ancho completo. */
  featured?: boolean;
}

// Tarjeta ÚNICA para todos los eventos: flyer CUADRADO que define la altura, y toda
// la info (fecha, título, venue, lineup, tickets, badge) cabe dentro de esa altura.
// El destacado es la MISMA tarjeta, sólo más grande. Todo escala de forma fluida con
// clamp() para que se vea consistente en móvil / tablet / desktop / xl sin saltos.
const EventCard: React.FC<EventCardProps> = ({ event, index, featured }) => {
  const { title, flyer, date, endDate, tickets, venue, address, description } = event;
  const formattedDate = featured
    ? dayjs(date).format('ddd DD MMM YYYY [·] HH:mm')
    : dayjs(date).format('ddd DD MMM [·] HH:mm');
  const isEven = index % 2 === 0;

  // Tamaños fluidos (min, ideal-vw, max) por rol. El flyer cuadrado fija la altura.
  const flyerW = featured
    ? 'w-[clamp(150px,19vw,240px)]'
    : 'w-[clamp(128px,15vw,170px)]';
  const pad = featured ? 'p-[clamp(0.9rem,2vw,2rem)]' : 'p-[clamp(0.7rem,1.2vw,1.1rem)]';
  const gap = featured ? 'gap-[clamp(0.4rem,1vw,1rem)]' : 'gap-[clamp(0.3rem,0.6vw,0.6rem)]';
  const titleCls = featured
    ? 'text-[clamp(1.6rem,4.5vw,4rem)]'
    : 'text-[clamp(1.05rem,2vw,1.9rem)]';
  const dateCls = featured
    ? 'text-[clamp(0.65rem,1vw,1rem)]'
    : 'text-[clamp(0.55rem,0.8vw,0.75rem)]';
  const venueCls = featured
    ? 'text-[clamp(0.7rem,1vw,1.05rem)]'
    : 'text-[clamp(0.6rem,0.75vw,0.8rem)]';
  const lineupCls = featured
    ? 'text-[clamp(0.85rem,1.5vw,1.6rem)]'
    : 'text-[clamp(0.65rem,0.9vw,0.95rem)]';
  const btnCls = featured
    ? 'text-[clamp(0.75rem,1vw,1.1rem)] py-[clamp(0.5rem,0.8vw,0.9rem)] px-[clamp(1rem,2vw,2.5rem)]'
    : 'text-[clamp(0.65rem,0.8vw,0.85rem)] py-[clamp(0.35rem,0.5vw,0.6rem)] px-[clamp(0.8rem,1.2vw,1.5rem)]';

  return (
    <article className="group brutalist-border bg-white overflow-hidden flex items-stretch hover:bg-gray-50 transition-colors">
      {/* Flyer siempre 1:1 y a la izquierda. self-start evita que se estire si el
          contenido llegara a ser más alto que el cuadrado. */}
      <div
        className={`${flyerW} aspect-square shrink-0 self-start border-r-4 border-black overflow-hidden`}
      >
        {flyer ? (
          <Image
            src={flyer.url}
            width={flyer.width}
            height={flyer.height}
            alt={title}
            className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500"
          />
        ) : (
          <div className="w-full h-full bg-gray-200 flex items-center justify-center mono text-[10px] font-bold text-center p-2">
            NO FLYER
          </div>
        )}
      </div>

      {/* Info: fecha → título → lineup pegados arriba, sin que las acciones los empujen */}
      <div className={`flex flex-col min-w-0 flex-1 overflow-hidden ${pad} ${gap}`}>
        {/* Fecha */}
        <span
          className={`mono font-black bg-black text-white px-2 py-0.5 self-start ${dateCls}`}
        >
          {formattedDate}
        </span>

        {/* Título + venue */}
        <div className="min-w-0">
          <h3
            className={`font-black uppercase leading-none tracking-tighter italic line-clamp-2 ${titleCls}`}
          >
            {title}
          </h3>
          {venue && (
            <p className={`font-bold uppercase tracking-tight text-gray-500 truncate mt-0.5 ${venueCls}`}>
              {address ? (
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${address}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {venue} - {address}
                </a>
              ) : (
                venue
              )}
            </p>
          )}
        </div>

        {/* Lineup (si hay), recortado */}
        {description && (
          <div
            className={`font-black uppercase italic leading-tight text-black ${featured ? 'line-clamp-3' : 'line-clamp-2'} ${lineupCls}`}
            dangerouslySetInnerHTML={{ __html: documentToHtmlString(description) }}
          />
        )}
      </div>

      {/* Acciones en su propia columna a la derecha (no empujan el texto hacia abajo) */}
      <div className={`flex flex-col items-end justify-start shrink-0 gap-2 ${pad}`}>
        <TicketButton
          variant={isEven ? 'blue' : 'red'}
          className={`w-auto ${btnCls}`}
          title={title}
          url={tickets}
          date={date}
        />
        <ProximityBadge date={date} endDate={endDate} size={featured ? 'lg' : 'sm'} />
      </div>
    </article>
  );
};

export default EventCard;
