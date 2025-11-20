"use client";

import { ButtonLink } from "@/components/ButtonLink";
import { event } from "@/lib/gtag";

interface Evento {
  title: string;
  url: string;
  date: string;
}

interface EventListProps {
  eventos: Evento[];
}

export function EventList({ eventos }: EventListProps) {
  const handleEventClick = (title: string, url: string) => {
    event("event_link_click", {
      event_title: title,
      event_url: url,
    });
  };

  return (
    <div className="flex w-full max-w-xs flex-col gap-4">
      {eventos.map((evento) => (
        <ButtonLink
          key={evento.title}
          href={evento.url}
          isExternal
          onClick={() => handleEventClick(evento.title, evento.url)}
        >
          {`${evento.title} - ${evento.date}`}
        </ButtonLink>
      ))}
    </div>
  );
}
