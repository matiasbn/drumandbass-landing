'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { RiArrowRightLine } from '@remixicon/react';
import dayjs from '@/src/lib/date';
import { event } from '@/src/lib/gtag';
import JunglistDiscountBadge from './JunglistDiscountBadge';

// Destaca, para un junglist, los eventos vigentes donde ya tiene descuento. Cada
// fila lleva a la landing del evento (donde se revela y copia el código con su
// tracking). No muestra el código acá — la landing es la fuente de verdad.
export default function JunglistDiscountsCard({
  discounts,
  source,
}: {
  discounts: { id: string; title: string; date: string }[];
  source: string;
}) {
  useEffect(() => {
    if (discounts.length) {
      event('junglist_discount_highlight_view', { count: discounts.length, source });
    }
  }, [discounts.length, source]);

  if (!discounts.length) return null;

  return (
    <div className="brutalist-border shadow-[8px_8px_0_#0000ff] bg-white p-6 mb-6">
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <JunglistDiscountBadge size="md" />
        <p className="mono text-sm font-black uppercase">Ya tienes descuento en:</p>
      </div>
      <ul className="flex flex-col gap-2">
        {discounts.map((d) => (
          <li key={d.id}>
            <Link
              href={`/evento/${d.id}`}
              onClick={() =>
                event('junglist_discount_event_click', {
                  event_id: d.id,
                  event_title: d.title,
                  source,
                })
              }
              className="flex items-center justify-between gap-3 border-2 border-black bg-white px-4 py-3 hover:bg-[#ff0055] hover:text-white transition-colors"
            >
              <span className="min-w-0">
                <span className="block font-black uppercase leading-tight truncate">{d.title}</span>
                <span className="mono text-[11px] uppercase opacity-70">
                  {dayjs(d.date).format('ddd D MMM · HH:mm')}
                </span>
              </span>
              <RiArrowRightLine className="shrink-0" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
      <p className="mono text-[11px] text-gray-500 mt-3">Entra al evento y copia tu código.</p>
    </div>
  );
}
