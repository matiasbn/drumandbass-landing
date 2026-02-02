
import React from 'react';
import dayjs from 'dayjs'
import isToday from 'dayjs/plugin/isToday';
import isTomorrow from 'dayjs/plugin/isTomorrow';
import Image from 'next/image';
import { documentToHtmlString } from '@contentful/rich-text-html-renderer';

import { ContentfulEvent } from '../types/types';
import BigButton from './BigButton';

dayjs.extend(isToday);
dayjs.extend(isTomorrow);

function getProximityBadge(date: string, endDate?: string): { label: string; color: string } | null {
  const now = dayjs();
  const eventStart = dayjs(date);
  const eventEnd = endDate ? dayjs(endDate) : eventStart;

  if (now.isAfter(eventStart) && now.isBefore(eventEnd)) return { label: 'AHORA', color: 'bg-green-600' };
  if (eventStart.isToday()) return { label: 'HOY', color: 'bg-red-600' };
  if (eventStart.isTomorrow()) return { label: 'MAÑANA', color: 'bg-orange-500' };
  const daysUntil = eventStart.startOf('day').diff(now.startOf('day'), 'day');
  if (daysUntil > 0 && daysUntil <= 7) return { label: 'ESTA SEMANA', color: 'bg-yellow-500 text-black' };
  return null;
}

interface EventItemProps {
  event: ContentfulEvent;
  index: number;
}

const EventItem: React.FC<EventItemProps> = ({ event, index }) => {
  const { title, flyer, date, endDate, tickets, description, venue, address } = event
  const formattedDate = dayjs(date).format('dddd DD  MMMM  YYYY [@] HH:mm');
  const isEven = index % 2 === 0;
  const badge = getProximityBadge(date, endDate);

  return (
    <div className="group flex flex-col lg:flex-row border-b-8 border-black hover:bg-gray-50 transition-colors overflow-hidden">
      {/* Flyer - hidden on mobile, sidebar on desktop */}
      <div className="hidden lg:block lg:w-1/3 xl:w-1/4 lg:border-r-4 border-black">
        {flyer ? (
          <Image
            src={flyer.url}
            width={flyer.width}
            height={flyer.height}
            alt={title}
            className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500"
          />
        ) : (
          <div className="w-full h-full bg-gray-200 flex items-center justify-center mono font-bold text-center p-4">
            NO FLYER
          </div>
        )}
      </div>

      {/* Content Section */}
      <div className="flex-1 flex flex-col justify-between p-4 lg:p-10 bg-white">
        <div className="flex flex-col lg:flex-row justify-between items-start gap-3 lg:gap-4 mb-4 lg:mb-6">
          <div className="flex gap-3 items-start">
            {/* Flyer thumbnail on mobile */}
            {flyer && (
              <div className="block lg:hidden w-20 shrink-0 border-2 border-black overflow-hidden">
                <Image
                  src={flyer.url}
                  width={80}
                  height={112}
                  alt={title}
                  className="w-full h-auto object-cover"
                />
              </div>
            )}
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1 lg:mb-2">
                {badge && (<div className='flex items-center bg-red-600 text-white text-sm lg:text-xl font-black mono px-3 py-1.5 lg:px-4 lg:py-2 border-4 border-black uppercase tracking-widest animate-pulse'>
                  {['HOY', 'AHORA'].includes(badge.label) && <span className='mr-3 rounded-full bg-white w-2 h-2 inline-block'></span>}
                  <span>
                   {badge.label}
                  </span>
                </div>)}
                <div className="mono text-[12px] lg:text-base font-black bg-black text-white px-2 py-1 inline-block">
                  {formattedDate}
                </div>
              </div>
              <h3 className="text-3xl lg:text-7xl font-black uppercase leading-none tracking-tighter italic mt-1 lg:mt-2">
                {event.title}
              </h3>
              <p className="font-bold text-sm lg:text-2xl uppercase tracking-tight text-gray-500 mt-1 lg:mt-2">
                {address
                  ? <a href={`https://www.google.com/maps/search/?api=1&query=${address}`} target="_blank" rel="noopener noreferrer">
                    <span className='text-sm lg:text-xl'>{venue}</span> - <span className='text-xs lg:text-lg'>{address}</span>
                  </a>
                  : <span className='text-sm lg:text-lg'>{venue}</span>
                }
              </p>
            </div>
          </div>

          <div className="w-full lg:w-auto">
             <BigButton
              variant={isEven ? 'blue' : 'red'}
              className="w-full lg:w-auto text-base lg:text-xl py-3 lg:py-4 px-6 lg:px-10"
              href={tickets}
            >
              TICKETS
            </BigButton>
          </div>
        </div>

        {/* Lineup Section */}
        <div className="mt-2 pt-4 lg:pt-6 border-t-2 border-dashed border-black">
          <div
            className="text-xl lg:text-3xl font-black uppercase italic leading-none cursor-default transition-colors event-description"
            dangerouslySetInnerHTML={{ __html: description ? documentToHtmlString(description) : '' }}>
          </div>
        </div>
      </div>
      <style>
        {`
          .event-description > * {
            margin-bottom: .8em;
          }
        `}
      </style>
    </div>
  );
};

export default EventItem;
