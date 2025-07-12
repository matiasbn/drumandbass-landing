import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ButtonLink } from "@/components/ButtonLink";
import { LOGO_PATH } from "@/app/constants";
import { Footer } from "@/app/components/Footer";

export const metadata: Metadata = {
  title: "Drum and Bass Chile | La Comunidad de Drum and Bass en Chile",
  description:
    "El punto de encuentro para la comunidad de Drum and Bass en Chile. Descubre DJs, eventos, y organizaciones de la escena local.",
};

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 sm:p-12 md:p-24 font-[family-name:var(--font-geist-sans)]">
      <Image
        src={LOGO_PATH}
        alt="Logo Drum & Bass Chile"
        width={256}
        height={256}
        className="rounded-full" // Esta clase de Tailwind hace la imagen redonda
        priority // Ayuda a que la imagen principal cargue más rápido
      />
      <h1 className="mt-4 mb-8 whitespace-nowrap text-center text-xl font-bold sm:text-2xl md:text-3xl">
        La comunidad <br />
        online de <br />
        Drum and Bass en Chile 🇨🇱
      </h1>
      <div className="flex w-full max-w-xs flex-col gap-4">
        <Link
          href="/eventos"
          className="flex h-12 w-full items-center justify-center rounded-md border border-solid border-black/[.08] bg-gray-200 text-center text-base font-medium text-black transition-colors hover:bg-gray-300 dark:border-white/[.145] dark:bg-gray-800 dark:text-white dark:hover:bg-gray-700"
        >
          Eventos
        </Link>
        <ButtonLink href="https://docs.google.com/forms/d/e/1FAIpQLSflrgi9s_oAzMfIRhqj4vr8FAeWZTjDwoQa4IhInSY78I0giA/viewform?usp=dialog">
          Encuesta Satisfacción So Liquid
        </ButtonLink>
        <ButtonLink href="https://chat.whatsapp.com/GH1ZogYyOKTFqrV6s70U4R">
          Grupo WhatsApp (English Welcome)
        </ButtonLink>
        <ButtonLink href="https://www.instagram.com/drumandbasschile.cl">
          Instagram
        </ButtonLink>
        <ButtonLink href="/dj">DJs</ButtonLink>
        <ButtonLink href="/organizaciones">Organizaciones</ButtonLink>
      </div>
      <Footer />
    </main>
  );
}
