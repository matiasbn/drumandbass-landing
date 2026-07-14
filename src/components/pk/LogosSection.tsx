'use client';

import { useState } from 'react';
import BrutalistButton from '@/src/components/BigButton';
import { RiDownloadLine, RiEyeLine, RiEyeOffLine } from '@remixicon/react';

interface LogosSectionProps {
  slug: string;
  artistName: string;
  logoUrls: string[];
}

// Transparent checkerboard so logos with alpha are legible on any theme.
const CHECKER =
  'bg-[repeating-conic-gradient(#e5e5e5_0_25%,#ffffff_0_50%)] bg-[length:24px_24px]';

export default function LogosSection({ slug, artistName, logoUrls }: LogosSectionProps) {
  const [showLogos, setShowLogos] = useState(false);

  if (!logoUrls?.length) return null;

  return (
    <section className="border-b-4 border-black p-6 lg:p-12">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h2 className="text-5xl font-black uppercase italic">LOGOS</h2>
        <div className="flex flex-wrap gap-3">
          <BrutalistButton
            variant="primary"
            onClick={() => setShowLogos((v) => !v)}
            className="w-fit"
          >
            {showLogos ? (
              <>
                <RiEyeOffLine className="w-5 h-5" />
                OCULTAR LOGOS
              </>
            ) : (
              <>
                <RiEyeLine className="w-5 h-5" />
                MOSTRAR LOGOS
              </>
            )}
          </BrutalistButton>
          <BrutalistButton
            variant="red"
            href={`/api/pk/${slug}/logos`}
            className="w-fit"
          >
            <RiDownloadLine className="w-5 h-5" />
            DESCARGAR TODOS (ZIP)
          </BrutalistButton>
        </div>
      </div>

      {showLogos && (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
          {logoUrls.map((url, i) => (
            <a
              key={i}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              download
              title={`Descargar logo ${i + 1}`}
              className={`${CHECKER} brutalist-border p-3 flex items-center justify-center aspect-square hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={`${artistName} logo ${i + 1}`}
                className="max-w-full max-h-full object-contain"
              />
            </a>
          ))}
        </div>
      )}
    </section>
  );
}
