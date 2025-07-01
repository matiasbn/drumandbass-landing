import { ButtonLink } from "@/components/ButtonLink";
import Image from "next/image";
import Link from "next/link";
import data from "./data.json";
import { LOGO_PATH } from "../constants";

type Dj = {
  name: string;
};

export default function DjListPage() {
  const djs = data as Dj[];

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
      <h1 className="mt-4 mb-8 text-center text-3xl font-bold">DJs</h1>
      <div className="flex w-full max-w-xs flex-col gap-4">
        {djs.map((dj) => (
          // Nota: Los botones apuntan a "#" como placeholder. Puedes cambiar el href según necesites.
          <ButtonLink key={dj.name} href="#">
            {dj.name}
          </ButtonLink>
        ))}
      </div>
    </main>
  );
}
