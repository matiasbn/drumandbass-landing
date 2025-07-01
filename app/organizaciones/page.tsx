import { ButtonLink } from "@/components/ButtonLink";
import { LOGO_PATH } from "@/app/constants";
import Image from "next/image";
import Link from "next/link";
import organizacionesData from "./data.json";

interface Organizacion {
  name: string;
  url: string;
}

export default function OrganizacionesPage() {
  const organizaciones: Organizacion[] = organizacionesData;
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
        Organizaciones
      </h1>
      <div className="flex w-full max-w-xs flex-col gap-4">
        {organizaciones.map((organizacion) => (
          <ButtonLink
            key={organizacion.name}
            href={organizacion.url}
            isExternal
          >
            {organizacion.name}
          </ButtonLink>
        ))}
      </div>
    </main>
  );
}
