import type { Metadata } from 'next';
import Link from 'next/link';
import NationalReleases from '@/src/components/NationalReleases';
import { getNationalReleases } from '@/src/lib/nationalReleases';

export const metadata: Metadata = {
  title: 'Releases Nacionales — Drum and Bass Chile',
  description:
    'Todos los releases de productores nacionales de drum and bass de Chile, publicados por los propios DJs desde su presskit.',
  keywords: ['releases drum and bass Chile', 'productores nacionales DNB', 'drum and bass chileno'],
};

export const revalidate = 3600;

export default async function ReleasesPage() {
  const releases = await getNationalReleases();

  return (
    <main className="flex-1">
      <section className="border-b-4 border-black p-6 lg:p-12">
        <Link href="/" className="mono text-sm text-gray-600 hover:text-black uppercase">
          &larr; Volver al inicio
        </Link>
        <h1 className="text-5xl lg:text-7xl font-black uppercase italic tracking-tighter leading-none mt-3 mb-2">
          Releases Nacionales
        </h1>
        <p className="mono text-base lg:text-lg font-bold uppercase opacity-60 leading-tight">
          Todos los releases de productores nacionales. Publica el tuyo desde tu presskit.
        </p>
      </section>

      <section className="p-6 lg:p-12">
        {releases.length === 0 ? (
          <p className="mono text-sm uppercase opacity-60">
            Aún no hay releases publicados. Marca un release de SoundCloud en tu presskit para
            aparecer aquí.
          </p>
        ) : (
          <NationalReleases releases={releases} />
        )}
      </section>
    </main>
  );
}
