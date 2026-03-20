'use client';

import React, { useState, useRef } from 'react';
import {
  RiArrowLeftSLine,
  RiArrowRightSLine,
} from '@remixicon/react';

interface PhotoCarouselProps {
  photos: string[];
  artistName: string;
}

export default function PhotoCarousel({ photos, artistName }: PhotoCarouselProps) {
  const [current, setCurrent] = useState(0);
  const touchStartX = useRef(0);
  const touchDeltaX = useRef(0);
  const isSwiping = useRef(false);

  if (photos.length === 0) {
    return (
      <div className="w-full md:w-80 h-80 bg-gray-300 brutalist-border brutalist-shadow flex items-center justify-center shrink-0">
        <span className="text-6xl font-black opacity-20 select-none">IMG</span>
      </div>
    );
  }

  if (photos.length === 1) {
    return (
      <img
        src={photos[0]}
        alt={artistName}
        className="w-full md:w-80 h-80 object-cover brutalist-border brutalist-shadow shrink-0"
      />
    );
  }

  const prev = () => setCurrent((c) => (c === 0 ? photos.length - 1 : c - 1));
  const next = () => setCurrent((c) => (c === photos.length - 1 ? 0 : c + 1));

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchDeltaX.current = 0;
    isSwiping.current = true;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isSwiping.current) return;
    touchDeltaX.current = e.touches[0].clientX - touchStartX.current;
  };

  const handleTouchEnd = () => {
    if (!isSwiping.current) return;
    isSwiping.current = false;
    const threshold = 50;
    if (touchDeltaX.current < -threshold) {
      next();
    } else if (touchDeltaX.current > threshold) {
      prev();
    }
    touchDeltaX.current = 0;
  };

  return (
    <div
      className="relative w-full md:w-80 h-80 shrink-0 brutalist-border brutalist-shadow overflow-hidden group touch-pan-y"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div
        className="flex h-full transition-transform duration-300 ease-in-out"
        style={{ transform: `translateX(-${current * 100}%)` }}
      >
        {photos.map((url, i) => (
          <img
            key={i}
            src={url}
            alt={`${artistName} - foto ${i + 1}`}
            className="w-full h-full object-cover shrink-0 pointer-events-none"
            style={{ minWidth: '100%' }}
          />
        ))}
      </div>

      {/* Prev/Next buttons - always visible on mobile, hover on desktop */}
      <button
        onClick={prev}
        className="absolute left-2 top-1/2 -translate-y-1/2 p-1 bg-black/30 text-white/80 rounded-full backdrop-blur-sm hover:bg-black/60 hover:text-white transition-all md:opacity-0 md:group-hover:opacity-100"
        aria-label="Foto anterior"
      >
        <RiArrowLeftSLine className="w-5 h-5" />
      </button>
      <button
        onClick={next}
        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 bg-black/30 text-white/80 rounded-full backdrop-blur-sm hover:bg-black/60 hover:text-white transition-all md:opacity-0 md:group-hover:opacity-100"
        aria-label="Foto siguiente"
      >
        <RiArrowRightSLine className="w-5 h-5" />
      </button>

      {/* Dots */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
        {photos.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrent(i)}
            className={`w-2.5 h-2.5 border-2 border-black transition-colors ${
              i === current ? 'bg-[#ff0055]' : 'bg-white/80'
            }`}
            aria-label={`Ir a foto ${i + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
