import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import productoresEventosData from "./data.json";
import { LOGO_PATH } from "@/app/constants";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  title: "Productores de Eventos de Drum and Bass en Chile",
  description:
    "Conoce a los productores de eventos y colectivos que impulsan la cultura Drum and Bass en la escena chilena.",
};

interface ProductorEvento {
  name: string;
  url: string;
}

export default function ProductoresEventosPage() {
  const productoresEventos: ProductorEvento[] = [
    ...productoresEventosData,
  ].sort((a, b) => a.name.localeCompare(b.name));

  const linkClassName =
    "flex h-12 w-full items-center justify-center rounded-md border border-solid border-black/[.08] bg-white text-center text-base font-medium text-black transition-colors hover:bg-gray-100 dark:border-white/[.145] dark:bg-black dark:text-white dark:hover:bg-gray-900";

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 sm:p-12 md:p-24 font-[family-name:var(--font-geist-sans)]">
      <Link href="/">
        <Image
          src={LOGO_PATH}
          alt="Logo Drum & Bass Chile - Volver al inicio"
          width={256}
          height={256}
          className="rounded-full"
          priority
        />
      </Link>
      <h1 className="mt-4 mb-8 text-center text-3xl font-bold">
        Productores de Eventos
      </h1>
      <div className="flex w-full max-w-xs flex-col gap-4">
        {productoresEventos.map((productor) => (
          <a
            key={productor.name}
            href={productor.url}
            target="_blank"
            rel="noopener noreferrer"
            className={linkClassName}
          >
            {productor.name}
          </a>
        ))}
      </div>
      <Footer />
    </main>
  );
}
