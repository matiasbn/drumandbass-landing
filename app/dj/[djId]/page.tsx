import { ButtonLink } from "@/components/ButtonLink";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import data from "../data.json";
import type { Dj } from "../types";
import { LOGO_PATH } from "../../constants";

type Props = {
  params: { djId: string };
};

export async function generateStaticParams() {
  const djs = data as Dj[];
  return djs.map((dj) => ({
    djId: dj.name.toLowerCase(),
  }));
}

export default function DjDetailPage({ params }: Props) {
  // Decodificar el ID por si contiene caracteres especiales como espacios
  const djId = decodeURIComponent(params.djId);
  const dj = (data as Dj[]).find((d) => d.name.toLowerCase() === djId);

  if (!dj) {
    notFound();
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 sm:p-12 md:p-24 font-[family-name:var(--font-geist-sans)]">
      <Link href="/dj">
        <Image
          src={LOGO_PATH}
          alt="Logo Drum & Bass Chile - Volver a la lista de DJs"
          width={256}
          height={256}
          className="rounded-full"
          priority
        />
      </Link>
      <h1 className="mt-4 mb-8 text-center text-3xl font-bold">{dj.name}</h1>
      <div className="flex w-full max-w-xs flex-col gap-4">
        {dj.links.map((link) => (
          <ButtonLink key={link.url} href={link.url} isExternal>
            {link.title}
          </ButtonLink>
        ))}
        {dj.sets.length > 0 && <ButtonLink href="#">Sets</ButtonLink>}
      </div>
    </main>
  );
}
