import { ButtonLink } from "@/components/ButtonLink";
import { LOGO_PATH } from "@/app/constants";
import Image from "next/image";
import Link from "next/link";
import comunidadesData from "./data.json";

interface Organizacion {
  name: string;
  url: string;
}

export default function OrganizacionesPage() {
  const organizaciones: Organizacion[] = comunidadesData;
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
        {organizaciones.map((comunidad) => (
          <ButtonLink key={comunidad.name} href={comunidad.url} isExternal>
            {comunidad.name}
          </ButtonLink>
        ))}
      </div>
    </main>
  );
}
