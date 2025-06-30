import Image from "next/image";
import Link from "next/link";
import eventosData from "../../data/eventos.json";

interface Evento {
  id: number;
  title: string;
  url: string;
}

export default function EventosPage() {
  const eventos: Evento[] = eventosData;
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 sm:p-12 md:p-24 font-[family-name:var(--font-geist-sans)]">
      <Link href="/">
        <Image
          src="/logo.JPG"
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
          <a
            key={evento.id}
            href={evento.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-12 w-full items-center justify-center rounded-md border border-solid border-black/[.08] bg-white text-center text-base font-medium text-black transition-colors hover:bg-gray-100 dark:border-white/[.145] dark:bg-black dark:text-white dark:hover:bg-gray-900"
          >
            {evento.title}
          </a>
        ))}
      </div>
    </main>
  );
}
