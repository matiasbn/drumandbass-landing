'use client';

import BigButton from './BigButton';
import { event } from '@/src/lib/gtag';

interface TicketButtonProps {
  title: string;
  url?: string;
  variant: 'blue' | 'red';
  className?: string;
}

// Botón de tickets con tracking. Va como componente cliente porque EventItem es
// server component y el evento de GA necesita ejecutarse en el navegador.
// GA agrupa por event_title/event_url (siempre únicos por evento), así que
// reciclar la entrada de Contentful no afecta la medición.
export default function TicketButton({ title, url, variant, className }: TicketButtonProps) {
  return (
    <BigButton
      variant={variant}
      className={className}
      href={url}
      onClick={() => event('event_link_click', { event_title: title, event_url: url ?? '' })}
    >
      TICKETS
    </BigButton>
  );
}
