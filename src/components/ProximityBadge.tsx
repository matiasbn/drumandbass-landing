'use client';

import React, { useEffect, useState } from 'react';

import { getProximityBadge, type ProximityBadge as Badge } from '@/src/lib/eventBadge';

// Calcula el badge en el CLIENTE con la hora real del visitante, así nunca queda
// desactualizado aunque la página venga cacheada por ISR. Renderiza null hasta que
// monta (evita mismatch de hidratación y no hornea un valor stale en el HTML).
export default function ProximityBadge({ date, endDate }: { date: string; endDate?: string }) {
  const [badge, setBadge] = useState<Badge | null>(null);

  useEffect(() => {
    setBadge(getProximityBadge(date, endDate));
  }, [date, endDate]);

  if (!badge) return null;

  return (
    <div className="flex items-center bg-red-600 text-white text-sm lg:text-xl font-black mono px-3 py-1.5 lg:px-4 lg:py-2 border-4 border-black uppercase tracking-widest animate-pulse">
      {badge.dot && <span className="mr-3 rounded-full bg-white w-2 h-2 inline-block"></span>}
      <span>
        {badge.label}
        {badge.endTime && ` · HASTA ${badge.endTime}`}
      </span>
    </div>
  );
}
