'use client';

import React, { useState } from 'react';
import { RiWhatsappLine, RiMenuLine, RiCloseLine } from '@remixicon/react';
import BrutalistButton from './BigButton';
import { SOCIALS, WHATSAPP_LINK } from '../constants';

const SpIcon = SOCIALS.spotify.icon;

const HeaderNav = () => {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Desktop nav */}
      <nav className="hidden md:flex gap-4 w-2/3 justify-end pr-8">
        <BrutalistButton className="text-xs py-2 px-4 brutalist-border brutalist-shadow-blue" href={SOCIALS.spotify.url} external>
          <SpIcon /> Playlist
        </BrutalistButton>
        <BrutalistButton className="text-xs py-2 px-4 brutalist-border brutalist-shadow-blue" href="https://foro.drumandbasschile.cl/" external>
          Foro
        </BrutalistButton>
        <BrutalistButton variant="whatsapp" className="text-xs py-2 px-4" href={WHATSAPP_LINK} external>
          <RiWhatsappLine size={16} /> WHATSAPP
        </BrutalistButton>
      </nav>

      {/* Mobile menu button */}
      <button
        onClick={() => setOpen(!open)}
        className="md:hidden mr-4 p-2 border-4 border-black bg-white hover:bg-black hover:text-white transition-colors"
        aria-label="Menu"
      >
        {open ? <RiCloseLine size={24} /> : <RiMenuLine size={24} />}
      </button>

      {/* Mobile popover */}
      {open && (
        <div className="md:hidden absolute top-full left-0 right-0 bg-white border-b-4 border-black z-50 flex flex-col gap-3 p-4">
          <BrutalistButton className="text-sm py-3 px-4 brutalist-border brutalist-shadow-blue w-full" href={SOCIALS.spotify.url} external>
            <SpIcon /> Playlist
          </BrutalistButton>
          <BrutalistButton className="text-sm py-3 px-4 brutalist-border brutalist-shadow-blue w-full" href="https://foro.drumandbasschile.cl/" external>
            Foro
          </BrutalistButton>
          <BrutalistButton variant="whatsapp" className="text-sm py-3 px-4 w-full" href={WHATSAPP_LINK} external>
            <RiWhatsappLine size={18} /> WHATSAPP
          </BrutalistButton>
        </div>
      )}
    </>
  );
};

export default HeaderNav;
