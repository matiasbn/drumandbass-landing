'use client';

import React, { useState } from 'react';
import { RiWhatsappLine, RiMenuLine, RiCloseLine, RiFolder2Line } from '@remixicon/react';
import BrutalistButton from './BigButton';
import { SOCIALS, WHATSAPP_LINK } from '../constants';

const InstagramIcon = SOCIALS.instagram.icon;
const YouTubeIcon = SOCIALS.youtube.icon;
const SoundcloudIcon = SOCIALS.soundcloud.icon;

const DIRECTORY_LINKS = [
  { href: '/artistas', label: 'Artistas' },
  { href: '/productores', label: 'Productores' },
  { href: '/organizaciones', label: 'Organizaciones' },
];

const HeaderNav = () => {
  const [open, setOpen] = useState(false);
  const [dirOpen, setDirOpen] = useState(false);

  return (
    <>
      {/* Desktop nav */}
      <nav className="hidden lg:flex gap-4 w-2/3 justify-end pr-8 items-center">
        <BrutalistButton
          variant="whatsapp"
          className="text-xs py-2 px-4 h-12"
          href={WHATSAPP_LINK}
          external
        >
          <RiWhatsappLine size={16} /> WHATSAPP
        </BrutalistButton>
        <BrutalistButton
          variant="instagram"
          className="text-xs py-2 px-4 h-12"
          href={SOCIALS.instagram.url}
          external
        >
          <InstagramIcon /> Instagram
        </BrutalistButton>
        <BrutalistButton
          variant="youtube"
          className="text-xs py-2 px-4 h-12"
          href={SOCIALS.youtube.url}
          external
        >
          <YouTubeIcon /> YouTube
        </BrutalistButton>
        <BrutalistButton
          className="text-xs py-2 px-4 brutalist-border brutalist-shadow-blue h-12"
          variant="soundcloud"
          href="https://foro.drumandbasschile.cl/"
          external
        >
          <SoundcloudIcon /> SoundCloud
        </BrutalistButton>
        <div className="relative">
          <button
            onClick={() => setDirOpen(!dirOpen)}
            className="text-xs py-2 px-4 h-12 brutalist-border brutalist-shadow-blue bg-white font-bold uppercase mono flex items-center gap-2 hover:bg-black hover:text-white transition-colors cursor-pointer"
          >
            {dirOpen ? <RiCloseLine size={24} /> : <RiMenuLine size={24} />}
          </button>
          {dirOpen && (
            <div className="absolute top-full right-0 mt-2 bg-white border-4 border-black z-50 flex flex-col min-w-max">
              {DIRECTORY_LINKS.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="px-4 py-3 font-bold uppercase mono text-xs hover:bg-[#ff0000] hover:text-white transition-colors border-b-2 border-black last:border-b-0"
                >
                  {link.label}
                </a>
              ))}
            </div>
          )}
        </div>
      </nav>

      {/* Mobile menu button */}
      <button
        onClick={() => setOpen(!open)}
        className="lg:hidden mr-4 p-2 border-4 border-white hover:border-black bg-black hover:bg-white text-white hover:text-black transition-colors cursor-pointer"
        aria-label="Menu"
      >
        {open ? <RiCloseLine size={24} /> : <RiMenuLine size={24} />}
      </button>

      {/* Mobile popover */}
      {open && (
        <div className="lg:hidden absolute top-full left-0 right-0 bg-white border-b-4 border-black z-50 flex flex-col gap-3 p-4">
          <BrutalistButton
            variant="whatsapp"
            className="text-sm py-3 px-4 w-full"
            href={WHATSAPP_LINK}
            external
          >
            <RiWhatsappLine size={16} /> WHATSAPP
          </BrutalistButton>
          <BrutalistButton
            variant="instagram"
            className="text-sm py-3 px-4 w-full"
            href={SOCIALS.instagram.url}
            external
          >
            <InstagramIcon /> Instagram
          </BrutalistButton>
          <BrutalistButton
            variant="youtube"
            className="text-sm py-3 px-4 w-full"
            href={SOCIALS.youtube.url}
            external
          >
            <YouTubeIcon /> YouTube
          </BrutalistButton>
          <BrutalistButton
            variant="soundcloud"
            className="text-sm py-3 px-4 w-full"
            href="https://foro.drumandbasschile.cl/"
            external
          >
            <SoundcloudIcon /> SoundCloud
          </BrutalistButton>
          {DIRECTORY_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="py-3 px-4 font-bold uppercase mono text-sm border-4 border-black bg-[#ff0000] text-white hover:bg-black transition-colors text-center"
            >
              {link.label}
            </a>
          ))}
        </div>
      )}
    </>
  );
};

export default HeaderNav;
