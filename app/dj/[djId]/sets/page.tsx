import { ButtonLink } from "@/components/ButtonLink";
import Link from "next/link";
import type { Metadata, ResolvingMetadata } from "next";
import { notFound } from "next/navigation";
import data from "@/app/dj/data.json";
import type { Dj } from "@/app/dj/types";
import { use } from "react";
import { getDjId } from "@/app/dj/utils";
import { Footer } from "@/app/components/Footer";

type Props = {
  params: Promise<{ djId: string }>;
};

export async function generateMetadata(
  { params: paramsPromise }: Props,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  parent: ResolvingMetadata
): Promise<Metadata> {
  const { djId } = await paramsPromise;
  const dj = (data as Dj[]).find((d) => getDjId(d) === djId);

  if (!dj) {
    return {
      title: "Sets no encontrados",
    };
  }

  return {
    title: `Sets de ${dj.name}`,
    description: `Escucha los últimos sets y mixes de ${dj.name}, DJ de la escena Drum and Bass en Chile.`,
  };
}

export async function generateStaticParams() {
  const djs = data as Dj[];
  // Solo generamos páginas para los DJs que realmente tienen sets
  const djsWithSets = djs.filter((dj) => dj.sets && dj.sets.length > 0);

  return djsWithSets.map((dj) => ({
    djId: getDjId(dj),
  }));
}

export default function DjSetsPage({ params }: Props) {
  const { djId } = use(params);
  const djIdParam = decodeURIComponent(djId);
  const dj = (data as Dj[]).find((d) => getDjId(d) === djIdParam);

  // Si el DJ no existe o no tiene sets, mostramos la página 404
  if (!dj || dj.sets.length === 0) {
    notFound();
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 sm:p-12 md:p-24 font-[family-name:var(--font-geist-sans)]">
      <div className="mb-8 text-center">
        <Link href={`/`} className="text-sm text-blue-500 hover:underline">
          &larr; Volver a {dj.name}
        </Link>
        <h1 className="mt-2 text-3xl font-bold">Sets de {dj.name}</h1>
      </div>
      <div className="flex w-full max-w-xs flex-col gap-4">
        {dj.sets.map((set) => (
          <ButtonLink key={set.url} href={set.url} isExternal>
            {set.title}
          </ButtonLink>
        ))}
      </div>
      <Footer />
    </main>
  );
}
