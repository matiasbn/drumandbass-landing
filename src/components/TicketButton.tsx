'use client';

import BigButton from './BigButton';
import { event } from '@/src/lib/gtag';
import dayjs from '@/src/lib/date';

interface TicketButtonProps {
  title: string;
  url?: string;
  /** Fecha del evento (ISO). Se envía como parámetro del evento de GA. */
  date?: string;
  /** id del evento (cms_events.id). Se agrega como marcador `dnbt` a la URL para
   *  identificar el clic al botón de tickets de forma única — así se distingue de
   *  cualquier otro link a la misma página (p. ej. un Instagram usado como venta).
   *  Analytics lee ese marcador para atribuir el clic al evento correcto. */
  eventId?: string;
  variant: 'blue' | 'red';
  className?: string;
}

// Agrega el marcador `dnbt=<id>` a la URL sin romper el destino (params extra se
// ignoran). El navegador registra el clic saliente con esta URL marcada, así el
// evento queda identificado aunque la URL de destino se comparta o cambie.
function withMarker(url?: string, eventId?: string): string | undefined {
  if (!url || !eventId) return url;
  try {
    const u = new URL(url);
    u.searchParams.set('dnbt', eventId);
    return u.toString();
  } catch {
    const sep = url.includes('?') ? '&' : '?';
    return `${url}${sep}dnbt=${encodeURIComponent(eventId)}`;
  }
}

// Botón de tickets con tracking. Va como componente cliente porque EventItem es
// server component y el evento de GA necesita ejecutarse en el navegador.
export default function TicketButton({ title, url, date, eventId, variant, className }: TicketButtonProps) {
  const eventDate = date ? dayjs(date).format('YYYY-MM-DD') : '';
  const href = withMarker(url, eventId);
  return (
    <BigButton
      variant={variant}
      className={className}
      href={href}
      onClick={() =>
        event('event_link_click', {
          event_title: title,
          event_date: eventDate,
          event_url: href ?? '',
        })
      }
    >
      TICKETS
    </BigButton>
  );
}
