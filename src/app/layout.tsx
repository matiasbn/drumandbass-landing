import type { Metadata } from "next";
import { Space_Grotesk, Space_Mono } from "next/font/google";
import { GoogleAnalytics } from "@/src/components/GoogleAnalytics";
import "../globals.css";
import Header from "../components/Header";
import { SOCIALS, WHATSAPP_LINK, TEAM } from "../constants";
import { RiWhatsappLine } from "@remixicon/react";
import BrutalistButton from "@/src/components/BigButton";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["300", "400", "700"],
});

const spaceMono = Space_Mono({
  variable: "--font-space-mono",
  subsets: ["latin"],
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: "Drum & Bass Chile",
  description: "Enlaces oficiales de Drum & Bass Chile",
  icons: {
    // Es buena práctica usar un .ico para máxima compatibilidad
    icon: "/favicon.ico",
    // Y un .png para otros usos, como el ícono de Apple
    apple: "/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const gaId = process.env.NEXT_PUBLIC_GA_ID;

  return (
    <html lang="es">
      {gaId && <GoogleAnalytics gaId={gaId} />}
      <style>{`
          body {
              font-family: var(--font-space-grotesk), sans-serif;
              background-color: #ffffff;
              color: #000000;
          }
          .mono { font-family: var(--font-space-mono), monospace; }
          .brutalist-border { border: 4px solid black; }
          .brutalist-shadow { box-shadow: 8px 8px 0px 0px rgba(0,0,0,1); }
          .brutalist-shadow-red { box-shadow: 8px 8px 0px 0px #ff0000; }
          .brutalist-shadow-blue { box-shadow: 8px 8px 0px 0px #0000ff; }
          .brutalist-shadow-green { box-shadow: 8px 8px 0px 0px #25D366; }
          .hover-lift:hover { transform: translate(-4px, -4px); box-shadow: 12px 12px 0px 0px rgba(0,0,0,1); }
          ::selection { background: #ff0000; color: white; }
      `}
      </style>
      <body className={`${spaceGrotesk.variable} ${spaceMono.variable} antialiased`}>
        <div className="min-h-screen flex flex-col selection:bg-[#ff0000] selection:text-white">
          {/* Header / Logo Section */}
          <Header />

          {children}

          <section className="p-6 lg:p-12 flex flex-col lg:flex-row gap-12 border-b-4 border-black">
            <div className="flex-1">
              <h3 className="text-5xl font-black uppercase mb-6 italic">SOCIAL</h3>
              <div className="grid grid-cols-2 gap-4">
                {Object.keys(SOCIALS).map(key => {
                  const {platform, url, icon: Icon} = SOCIALS[key];
                  return (
                    <a 
                      key={platform} 
                      href={url}
                      className="p-6 border-4 border-black hover:bg-[#0000ff] hover:text-white transition-all font-bold uppercase mono text-center brutalist-shadow-blue hover:translate-x-1 hover:translate-y-1 hover:shadow-none"
                    >
                    <div className="text-2xl flex justify-center mb-2"><Icon /></div>
                    {platform}
                  </a>
                  )
                })}
              </div>
            </div>
            <div className="flex-1 bg-white brutalist-border p-8 brutalist-shadow-red relative overflow-hidden">
              <div className="relative z-10">
                <h3 className="text-4xl font-black uppercase mb-4">WHATSAPP</h3>
                <p className="mono font-bold text-lg mb-8 uppercase leading-tight">
                  Únete a nuestro grupo de WhatsApp para estar al tanto de los próximos eventos, lanzamientos exclusivos y
                  conectarte con la comunidad de Drum & Bass en Chile.
                </p>
                <BrutalistButton variant="whatsapp" className="w-full text-2xl py-8" href={WHATSAPP_LINK}>
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
              <h4 className="text-2xl font-black uppercase italic tracking-tighter">DRUM & BASS CHILE 🇨🇱 </h4>
            </div>
                    
            <div className="text-right">
              <p className="mono text-xs font-bold text-[#ff0000] uppercase">TEAM</p>
              <p className="mono text-xs font-bold uppercase flex gap-2">
                {TEAM.map(member => (
                  <a key={member.name} href={member.instagram} className="underline" target="_blank" rel="noopener noreferrer">
                    @{member.name}
                  </a>
                ))}
              </p>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
