'use client';

import BigButton from './BigButton';
import { event } from '@/src/lib/gtag';
import dayjs from '@/src/lib/date';

interface TicketButtonProps {
  title: string;
  url?: string;
  /** Fecha del evento (ISO). Se usa para identificarlo de forma única junto al título. */
  date?: string;
  variant: 'blue' | 'red';
  className?: string;
}

// Botón de tickets con tracking. Va como componente cliente porque EventItem es
// server component y el evento de GA necesita ejecutarse en el navegador.
// Identificamos el evento por TÍTULO + FECHA: la URL puede cambiar (se actualiza
// la venta de entradas) pero la fecha no; y dos eventos con el mismo nombre en
// distintos días quedan separados. Ver la convención en CLAUDE.md.
export default function TicketButton({ title, url, date, variant, className }: TicketButtonProps) {
  const eventDate = date ? dayjs(date).format('YYYY-MM-DD') : '';
  return (
    <BigButton
      variant={variant}
      className={className}
      href={url}
      onClick={() =>
        event('event_link_click', {
          event_title: title,
          event_date: eventDate,
          event_url: url ?? '',
        })
      }
    >
      TICKETS
    </BigButton>
  );
}
