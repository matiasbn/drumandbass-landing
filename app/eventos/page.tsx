import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import eventosData from "./data.json";
import { LOGO_PATH } from "@/app/constants";
import { Footer } from "@/components/Footer";
import { EventList } from "@/components/EventList";

export const metadata: Metadata = {
  title: "Eventos de Drum and Bass en Chile",
  description:
    "Encuentra los próximos eventos y fiestas de la escena Drum and Bass en Chile. Mantente al día con las fechas y compra tus entradas.",
};

interface Evento {
  id: number;
  title: string;
  url: string;
  date: string;
}

/**
 * Parsea una fecha en formato DD/MM/YY o DD/MM/YYYY a un objeto Date para poder ordenarla.
 * @param dateString La fecha como string.
 * @returns Un objeto Date.
 */
const parseDate = (dateString: string): Date => {
  const [day, month, year] = dateString.split("/").map(Number);
  // Si el año tiene 2 dígitos, asumimos que corresponde al siglo 21
  const fullYear = year < 100 ? 2000 + year : year;
  return new Date(fullYear, month - 1, day);
};

export default function EventosPage() {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0); // Establecer la hora al inicio del día para comparación exacta

  // Separar eventos en próximos y pasados
  const eventosProximos: Evento[] = [];
  const eventosPasados: Evento[] = [];

  eventosData.forEach((evento) => {
    const fechaEvento = parseDate(evento.date);
    if (fechaEvento >= hoy) {
      eventosProximos.push(evento);
    } else {
      eventosPasados.push(evento);
    }
  });

  // Ordenar eventos próximos del más próximo al más lejano
  eventosProximos.sort(
    (a, b) => parseDate(a.date).getTime() - parseDate(b.date).getTime()
  );

  // Ordenar eventos pasados del más reciente al más antiguo
  eventosPasados.sort(
    (a, b) => parseDate(b.date).getTime() - parseDate(a.date).getTime()
  );

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 sm:p-12 md:p-24 font-[family-name:var(--font-geist-sans)]">
      <Link href="/">
        <Image
          src={LOGO_PATH}
          alt="Logo Drum & Bass Chile - Volver al inicio"
          width={256}
          height={256}
          className="rounded-full" // Esta clase de Tailwind hace la imagen redonda
          priority // Ayuda a que la imagen principal cargue más rápido
        />
      </Link>
      
      {/* Eventos próximos */}
      {eventosProximos.length > 0 && (
        <>
          <h1 className="mt-4 mb-8 text-center text-3xl font-bold">Próximos Eventos</h1>
          <EventList eventos={eventosProximos} />
        </>
      )}
      
      {/* Eventos pasados */}
      {eventosPasados.length > 0 && (
        <>
          <h2 className="mt-12 mb-8 text-center text-2xl font-bold">Eventos Pasados</h2>
          <EventList eventos={eventosPasados} />
        </>
      )}
      
      <Footer />
    </main>
  );
}
