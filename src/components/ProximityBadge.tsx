'use client';

import React, { useEffect, useState } from 'react';

import { getProximityBadge, type ProximityBadge as Badge } from '@/src/lib/eventBadge';

// Calcula el badge en el CLIENTE con la hora real del visitante, así nunca queda
// desactualizado aunque la página venga cacheada por ISR. Renderiza null hasta que
// monta (evita mismatch de hidratación y no hornea un valor stale en el HTML).
export default function ProximityBadge({
  date,
  endDate,
  size = 'lg',
}: {
  date: string;
  endDate?: string;
  /** 'lg' para el hero, 'sm' para tarjetas/filas compactas. */
  size?: 'sm' | 'lg';
}) {
  const [badge, setBadge] = useState<Badge | null>(null);

  useEffect(() => {
    setBadge(getProximityBadge(date, endDate));
  }, [date, endDate]);

  if (!badge) return null;
  // "PRÓXIMA SEMANA" se oculta a propósito (daba problemas); el resto sí se muestra.
  if (badge.label === 'PRÓXIMA SEMANA') return null;

  // Un poco más chico que el botón de tickets (que usa clamp equivalente), con la
  // misma sombra brutalista de 8px.
  const sizeCls =
    size === 'sm'
      ? 'text-[clamp(0.5rem,0.7vw,0.72rem)] px-2 py-0.5 border-2 tracking-wider'
      : 'text-[clamp(0.6rem,0.85vw,0.9rem)] px-[clamp(0.5rem,1vw,0.85rem)] py-[clamp(0.15rem,0.35vw,0.45rem)] border-4 tracking-widest';
  const dotCls = size === 'sm' ? 'mr-1.5 w-1.5 h-1.5' : 'mr-2 w-2 h-2';

  return (
    <div
      className={`flex items-center bg-red-600 text-white font-black mono border-black uppercase animate-pulse brutalist-shadow ${sizeCls}`}
    >
      {badge.dot && <span className={`rounded-full bg-white inline-block ${dotCls}`}></span>}
      <span>
        {badge.label}
        {badge.endTime && ` · HASTA ${badge.endTime}`}
      </span>
    </div>
  );
}
