'use client';

import { useEffect } from 'react';
import { event } from '@/src/lib/gtag';

// Detecta la red social a partir del host del enlace (para el evento social_click).
function socialNetwork(href: string): string | null {
  try {
    const h = new URL(href).hostname.replace(/^www\./, '');
    if (h.includes('instagram.com')) return 'instagram';
    if (h.includes('wa.me') || h.includes('whatsapp.com')) return 'whatsapp';
    if (h.includes('soundcloud.com')) return 'soundcloud';
    if (h.includes('youtube.com') || h.includes('youtu.be')) return 'youtube';
    if (h.includes('spotify.com')) return 'spotify';
    if (h.includes('facebook.com')) return 'facebook';
    if (h.includes('tiktok.com')) return 'tiktok';
    if (h.includes('x.com') || h.includes('twitter.com')) return 'twitter';
    return null;
  } catch {
    return null;
  }
}

// Auto-tracking global: escucha todos los clics en <a> y <button> del sitio y
// envía un evento `ui_click` a GA con el texto, el destino y la sección donde
// ocurrió. Así CUALQUIER sección nueva queda trackeada sin agregar código:
// la sección se deduce del atributo `data-section` o del encabezado más cercano.
// Para una etiqueta explícita, pon `data-track="mi-label"` en el elemento.
export default function ClickTracker() {
  useEffect(() => {
    function onClick(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      const el = target?.closest('a, button') as HTMLElement | null;
      if (!el) return;

      const explicit = el.getAttribute('data-track');
      const text = (el.getAttribute('aria-label') || el.textContent || '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 100);
      const isLink = el.tagName === 'A';
      const href = isLink ? (el as HTMLAnchorElement).href : undefined;

      const sectionEl = el.closest('[data-section]') as HTMLElement | null;
      const section =
        sectionEl?.getAttribute('data-section') ||
        el
          .closest('section')
          ?.querySelector('h1, h2, h3')
          ?.textContent?.replace(/\s+/g, ' ')
          .trim()
          .slice(0, 60) ||
        undefined;

      // Si es un enlace a una red social/WhatsApp, lo registramos como social_click;
      // el resto como ui_click genérico.
      const network = href ? socialNetwork(href) : null;
      if (network) {
        event('social_click', { network, ...(section ? { section } : {}) });
      } else {
        event('ui_click', {
          label: explicit || text || (isLink ? 'link' : 'button'),
          ...(href ? { link_url: href } : {}),
          ...(section ? { section } : {}),
        });
      }
    }

    document.addEventListener('click', onClick, { capture: true });
    return () => document.removeEventListener('click', onClick, { capture: true });
  }, []);

  return null;
}
