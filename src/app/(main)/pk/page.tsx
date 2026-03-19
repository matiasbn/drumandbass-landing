import type { Metadata } from 'next';
import Link from 'next/link';
import { RiMicLine, RiArrowRightLine } from '@remixicon/react';

export const metadata: Metadata = {
  title: 'Presskit DJ — Drum and Bass Chile',
  description:
    'Crea tu presskit digital como DJ. Comparte tu bio, mixes y redes sociales en un solo lugar.',
  keywords: ['presskit', 'DJ', 'drum and bass Chile', 'electronic press kit'],
};

export default function PresskitLandingPage() {
  return (
    <main className="flex-1">
      {/* Hero */}
      <section className="border-b-4 border-black p-6 lg:p-12 flex flex-col items-center text-center">
        <div className="mb-8">
          <RiMicLine className="w-16 h-16 mx-auto mb-4" />
          <h1 className="text-6xl lg:text-8xl font-black uppercase italic tracking-tighter leading-none mb-4">
            PRESSKIT
          </h1>
          <p className="mono text-lg font-bold uppercase opacity-60 max-w-xl mx-auto">
            Tu presskit digital como DJ. Bio, mixes, redes sociales — todo en un solo lugar.
          </p>
        </div>

        <Link
          href="/pk/edit"
          className="inline-flex items-center gap-3 bg-black text-white px-8 py-4 text-xl font-black uppercase tracking-wider brutalist-border hover:translate-x-[-4px] hover:translate-y-[-4px] hover:shadow-[8px_8px_0px_0px_rgba(255,0,85,1)] transition-all"
        >
          CREA TU PRESSKIT
          <RiArrowRightLine className="w-6 h-6" />
        </Link>
      </section>

      {/* How it works */}
      <section className="border-b-4 border-black p-6 lg:p-12">
        <h2 className="text-5xl font-black uppercase italic mb-8">CÓMO FUNCIONA</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { step: '01', title: 'REGÍSTRATE', desc: 'Crea tu cuenta y elige tu nombre de DJ.' },
            { step: '02', title: 'COMPLETA TU PERFIL', desc: 'Agrega tu bio, géneros, redes sociales y mixes.' },
            { step: '03', title: 'COMPARTE', desc: 'Publica tu presskit y comparte el link con promotores y venues.' },
          ].map(({ step, title, desc }) => (
            <div
              key={step}
              className="bg-white brutalist-border brutalist-shadow p-6"
            >
              <span className="mono text-4xl font-black opacity-20">{step}</span>
              <h3 className="text-2xl font-black uppercase mt-2 mb-2">{title}</h3>
              <p className="mono text-sm opacity-70">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="p-6 lg:p-12 text-center">
        <p className="mono text-sm font-bold uppercase opacity-60 mb-4">
          Gratis. Sin límites. Para la escena.
        </p>
        <Link
          href="/pk/edit"
          className="inline-flex items-center gap-3 bg-[#ff0055] text-white px-8 py-4 text-xl font-black uppercase tracking-wider brutalist-border border-black hover:translate-x-[-4px] hover:translate-y-[-4px] hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] transition-all"
        >
          EMPEZAR AHORA
          <RiArrowRightLine className="w-6 h-6" />
        </Link>
      </section>
    </main>
  );
}
