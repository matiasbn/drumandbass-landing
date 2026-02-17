import Header from '../../components/Header';
import { SOCIALS, WHATSAPP_LINK, TEAM } from '../../constants';
import { RiWhatsappLine } from '@remixicon/react';
import BrutalistButton from '@/src/components/BigButton';

export default function MainLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="min-h-screen flex flex-col selection:bg-[#ff0000] selection:text-white">
      {/* Header / Logo Section */}
      <Header />

      {children}

      <section className="p-6 lg:p-12 flex flex-col lg:flex-row gap-12 border-b-4 border-black">
        <div className="flex-1">
          <h3 className="text-5xl font-black uppercase mb-6 italic">SOCIAL</h3>
          <div className="grid grid-cols-2 gap-4">
            {Object.keys(SOCIALS).map((key) => {
              const { platform, url, icon: Icon } = SOCIALS[key];
              return (
                <a
                  key={platform}
                  href={url}
                  className="p-6 border-4 border-black hover:bg-[#0000ff] hover:text-white transition-all font-bold uppercase mono text-center brutalist-shadow-blue hover:translate-x-1 hover:translate-y-1 hover:shadow-none"
                >
                  <div className="text-2xl flex justify-center mb-2">
                    <Icon />
                  </div>
                  {platform}
                </a>
              );
            })}
          </div>
        </div>
        <div className="flex-1 bg-white brutalist-border p-8 brutalist-shadow-red relative overflow-hidden">
          <div className="relative z-10">
            <h3 className="text-4xl font-black uppercase mb-4">WHATSAPP</h3>
            <p className="mono font-bold text-lg mb-8 uppercase leading-tight">
              Únete a nuestro grupo de WhatsApp para estar al tanto de los próximos eventos,
              lanzamientos exclusivos y conectarte con la comunidad de Drum and Bass en Chile.
            </p>
            <BrutalistButton
              variant="whatsapp"
              className="w-full text-2xl py-8"
              href={WHATSAPP_LINK}
            >
              <RiWhatsappLine /> ÚNETE AL GRUPO
            </BrutalistButton>
          </div>
          {/* Visual Decoration */}
          <div className="absolute top-[-20%] right-[-10%] text-9xl font-black opacity-5 pointer-events-none select-none uppercase -rotate-12">
            BASS
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="p-6 lg:p-12 bg-black text-white flex flex-col lg:flex-row items-center justify-between gap-8">
        <div>
          <p className="mono font-bold text-xs uppercase opacity-60">Desde 2025</p>
          <h4 className="text-2xl font-black uppercase italic tracking-tighter">
            Drum and BASS CHILE 🇨🇱{' '}
          </h4>
        </div>

        <div className="text-right">
          <p className="mono text-xs font-bold text-[#ff0000] uppercase">TEAM</p>
          <p className="mono text-xs font-bold uppercase flex gap-2">
            {TEAM.map((member) => (
              <a
                key={member.name}
                href={member.instagram}
                className="underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                @{member.name}
              </a>
            ))}
          </p>
        </div>
      </footer>
    </div>
  );
}
