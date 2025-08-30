"use client";

import Link from "next/link";
import { ButtonLink } from "@/components/ButtonLink";
import { event } from "@/lib/gtag";

export function HomeLinks() {
  const handleButtonClick = (buttonName: string) => {
    event("button_click", {
      button_name: buttonName,
    });
  };

  return (
    <div className="flex w-full max-w-xs flex-col gap-4">
      <Link
        href="/eventos"
        className="flex h-12 w-full items-center justify-center rounded-md border border-solid border-black/[.08] bg-gray-200 text-center text-base font-medium text-black transition-colors hover:bg-gray-300 dark:border-white/[.145] dark:bg-gray-800 dark:text-white dark:hover:bg-gray-700"
        onClick={() => handleButtonClick("Eventos")}
      >
        Eventos
      </Link>
      <ButtonLink
        href="/productores"
        onClick={() => handleButtonClick("Productores")}
      >
        Productores de eventos
      </ButtonLink>
      <ButtonLink
        href="https://foro.drumandbasschile.cl"
        onClick={() => handleButtonClick("Foro")}
      >
        Foro
      </ButtonLink>
      <ButtonLink
        href="https://chat.whatsapp.com/GH1ZogYyOKTFqrV6s70U4R"
        onClick={() => handleButtonClick("Grupo WhatsApp")}
      >
        Grupo WhatsApp (English Welcome)
      </ButtonLink>
      <ButtonLink
        href="https://www.instagram.com/drumandbasschile.cl"
        onClick={() => handleButtonClick("Instagram")}
      >
        Instagram
      </ButtonLink>
      <ButtonLink href="/dj" onClick={() => handleButtonClick("DJs")}>
        DJs
      </ButtonLink>
      <ButtonLink
        href="/organizaciones"
        onClick={() => handleButtonClick("Organizaciones")}
      >
        Organizaciones
      </ButtonLink>
    </div>
  );
}
