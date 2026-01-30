
import React from 'react';
import dayjs from 'dayjs'
import Image from 'next/image';
import { documentToHtmlString } from '@contentful/rich-text-html-renderer';

import { ContentfulEvent } from '../types/types';
import BigButton from './BigButton';

interface EventItemProps {
  event: ContentfulEvent;
  index: number;
}

const EventItem: React.FC<EventItemProps> = ({ event, index }) => {
  const { title, flyer, date, tickets, description, venue, address } = event
  const formattedDate = dayjs(date).format('dddd DD  MMMM  YYYY [@] HH:mm');
  const isEven = index % 2 === 0;

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
            NO FLYER AVAILABLE
          </div>
        )}
      </div>

      {/* Content Section */}
      <div className="flex-1 flex flex-col justify-between p-4 lg:p-10 bg-white">
        <div className="flex flex-col lg:flex-row justify-between items-start gap-3 lg:gap-4 mb-4 lg:mb-6">
          <div className="flex gap-3 items-start">
            {/* Flyer thumbnail on mobile */}
            {flyer && (
              <div className="block lg:hidden w-20 flex-shrink-0 border-2 border-black overflow-hidden">
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
              <div className="mono text-[12px] lg:text-base mb-1 lg:mb-2 font-black bg-black text-white px-2 py-1 inline-block">
                {formattedDate}
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
