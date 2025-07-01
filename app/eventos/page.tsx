import Image from "next/image";
import Link from "next/link";
import eventosData from "./data.json";
import { ButtonLink } from "@/components/ButtonLink";
import { LOGO_PATH } from "@/app/constants";

interface Evento {
  id: number;
  title: string;
  url: string;
  date: string;
}

/**
 * Parsea una fecha en formato DD/MM/YY a un objeto Date para poder ordenarla.
 * @param dateString La fecha como string.
 * @returns Un objeto Date.
 */
const parseDate = (dateString: string): Date => {
  const [day, month, year] = dateString.split("/").map(Number);
  // Asumimos que los años YY corresponden al siglo 21.
  return new Date(2000 + year, month - 1, day);
};

export default function EventosPage() {
  // Ordenamos los eventos por fecha, del más próximo al más lejano.
  const eventos: Evento[] = [...eventosData].sort(
    (a, b) => parseDate(a.date).getTime() - parseDate(b.date).getTime()
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
      <h1 className="mt-4 mb-8 text-center text-3xl font-bold">Eventos</h1>
      <div className="flex w-full max-w-xs flex-col gap-4">
        {eventos.map((evento) => (
          <ButtonLink key={evento.id} href={evento.url} isExternal>
            {`${evento.title} ${evento.date}`}
          </ButtonLink>
        ))}
      </div>
    </main>
  );
}
