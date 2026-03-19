import type { Metadata } from 'next';
import PkHero from '@/src/components/pk/PkHero';

export const metadata: Metadata = {
  title: 'Presskit DJ — Drum and Bass Chile',
  description:
    'Crea tu presskit digital como DJ. Comparte tu bio, mixes y redes sociales en un solo lugar.',
  keywords: ['presskit', 'DJ', 'drum and bass Chile', 'electronic press kit'],
};

export default function PresskitLandingPage() {
  return (
    <main className="flex-1">
      <PkHero />

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
    </main>
  );
}
