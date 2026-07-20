import { notFound } from 'next/navigation';
import Image from 'next/image';
import type { Metadata } from 'next';
import { RiWhatsappLine } from '@remixicon/react';

import dayjs from '@/src/lib/date';
import { getEventById } from '@/src/lib/cms';
import { WHATSAPP_LINK } from '@/src/constants';
import TicketButton from '@/src/components/TicketButton';
import ProximityBadge from '@/src/components/ProximityBadge';
import BigButton from '@/src/components/BigButton';
import TrackOnMount from '@/src/components/TrackOnMount';

// Landing pública de un evento (por id). Es el destino de los correos de campaña
// (para medir la visita en GA de forma confiable) y también sirve para compartir
// el evento en redes. Ofrece los tickets + CTAs de comunidad (Junglist/WhatsApp/DJ).
export const revalidate = 3600;

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const ev = await getEventById(id);
  if (!ev) return { title: 'Evento no encontrado · Drum and Bass Chile' };
  return {
    title: `${ev.title} · Drum and Bass Chile`,
    description: `${ev.title}${ev.venue ? ` en ${ev.venue}` : ''} — ${dayjs(ev.date).format('D [de] MMMM YYYY')}.`,
    ...(ev.flyer ? { openGraph: { images: [ev.flyer.url] } } : {}),
  };
}

export default async function EventoLandingPage({ params }: PageProps) {
  const { id } = await params;
  const ev = await getEventById(id);
  if (!ev) notFound();

  const fecha = dayjs(ev.date).format('dddd DD [de] MMMM YYYY [·] HH:mm');
  const lugar = ev.venue ? `${ev.venue}${ev.address ? ` · ${ev.address}` : ''}` : '';
  const mapsUrl = ev.address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ev.address)}`
    : undefined;

  return (
    <main className="grow">
      <TrackOnMount name="landing_evento_view" params={{ event_id: ev.id, event_title: ev.title }} />

      {/* Evento */}
      <section className="border-b-4 border-black">
        <div className="grid grid-cols-1 lg:grid-cols-2">
          {/* Flyer */}
          <div className="bg-black border-b-4 lg:border-b-0 lg:border-r-4 border-black">
            {ev.flyer ? (
              <Image
                src={ev.flyer.url}
                width={ev.flyer.width || 1000}
                height={ev.flyer.height || 1000}
                alt={ev.title}
                priority
                className="w-full h-auto object-cover"
              />
            ) : (
              <div className="aspect-square flex items-center justify-center mono font-bold text-white">
                SIN FLYER
              </div>
            )}
          </div>

          {/* Info */}
          <div className="p-6 lg:p-12 flex flex-col justify-center gap-4 bg-white">
            <div className="flex flex-wrap items-center gap-2">
              <ProximityBadge date={ev.date} endDate={ev.endDate} />
              <span className="mono text-xs lg:text-base font-black bg-black text-white px-2 py-1 inline-block">
                {fecha}
              </span>
            </div>

            <h1 className="text-4xl lg:text-7xl font-black uppercase italic tracking-tighter leading-none">
              {ev.title}
            </h1>

            {lugar && (
              <p className="font-bold text-base lg:text-2xl uppercase tracking-tight text-gray-600">
                {mapsUrl ? (
                  <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="hover:text-black">
                    {lugar}
                  </a>
                ) : (
                  lugar
                )}
              </p>
            )}

            {ev.description && (
              <div
                className="text-lg lg:text-2xl font-black uppercase italic leading-tight event-landing-desc"
                dangerouslySetInnerHTML={{ __html: ev.description }}
              />
            )}

            <div className="mt-2">
              <TicketButton
                variant="red"
                className="w-full sm:w-auto text-xl py-4 px-10"
                title={ev.title}
                url={ev.tickets}
                date={ev.date}
                eventId={ev.id}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Cross-sell: comunidad */}
      <section className="p-6 lg:p-12 border-b-4 border-black">
        <h2 className="text-3xl lg:text-5xl font-black uppercase italic mb-2">Súmate a la comunidad</h2>
        <p className="mono text-sm lg:text-base font-bold uppercase opacity-60 mb-6 leading-tight">
          Compres o no ticket, hay más movidas de Drum and Bass en Chile esperándote.
        </p>
        <div className="flex flex-col lg:flex-row gap-4">
          <BigButton variant="blue" className="flex-1 text-lg py-6" href="/junglist">
            Únete como Junglist
          </BigButton>
          <BigButton variant="whatsapp" className="flex-1 text-lg py-6" href={WHATSAPP_LINK}>
            <RiWhatsappLine /> Grupo de WhatsApp
          </BigButton>
          <BigButton variant="club" className="flex-1 text-lg py-6" href="/pk">
            ¿Eres DJ? Crea tu presskit
          </BigButton>
        </div>
      </section>

      <style>{`.event-landing-desc > * { margin-bottom: .5em; }`}</style>
    </main>
  );
}
