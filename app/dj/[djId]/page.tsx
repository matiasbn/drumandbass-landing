import Image from "next/image";
import Link from "next/link";
import type { Metadata, ResolvingMetadata } from "next";
import { notFound } from "next/navigation";
import data from "@/app/dj/data.json";
import type { Dj } from "@/app/dj/types";
import { LOGO_PATH } from "@/app/constants";
import { use } from "react";
import { getDjId } from "../utils";
import { Footer } from "@/components/Footer";
import { DjLinks } from "@/components/DjLinks";

type Props = {
  params: Promise<{ djId: string }>;
};

export async function generateMetadata(
  { params: paramsPromise }: Props,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _parent: ResolvingMetadata
): Promise<Metadata> {
  const { djId } = await paramsPromise;
  const dj = (data as Dj[]).find((d) => getDjId(d) === djId);

  if (!dj) {
    return {
      title: "DJ no encontrado",
    };
  }

  return {
    title: dj.name,
    description: `Descubre los links y sets de ${dj.name}, DJ de la comunidad Drum and Bass en Chile.`,
  };
}

export async function generateStaticParams() {
  const djs = data as Dj[];
  return djs.map((dj) => ({
    djId: getDjId(dj),
  }));
}
// {params}: {params: Promise<{ id: string }>}
export default function DjDetailPage({ params }: Props) {
  // Decodificar el ID por si contiene caracteres especiales como espacios
  const { djId } = use(params);
  const djIdParam = decodeURIComponent(djId);
  const dj = (data as Dj[]).find((d) => getDjId(d) === djIdParam);

  if (!dj) {
    notFound();
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 sm:p-12 md:p-24 font-[family-name:var(--font-geist-sans)]">
      <Link href="/">
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
      <DjLinks dj={dj} />
      <Footer />
    </main>
  );
}
