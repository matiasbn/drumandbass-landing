'use client';

import { useEffect } from 'react';
import { event } from '@/src/lib/gtag';

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

      event('ui_click', {
        label: explicit || text || (isLink ? 'link' : 'button'),
        ...(href ? { link_url: href } : {}),
        ...(section ? { section } : {}),
      });
    }

    document.addEventListener('click', onClick, { capture: true });
    return () => document.removeEventListener('click', onClick, { capture: true });
  }, []);

  return null;
}
