import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';
import type { Document } from '@contentful/rich-text-types';

import { ContentfulEvent } from '../types/types';

dayjs.extend(isoWeek);

/**
 * Eventos sintéticos SOLO para desarrollo. Tienen exactamente la misma forma
 * que los objetos que devuelve `getEvents()` tras mapear Contentful, así que
 * pasan por el mismo pipeline (sort + filter + EventItem + getProximityBadge)
 * y renderizan idéntico a como lo haría data real de Contentful.
 *
 * Apagados por defecto (opt-in): se activan con MOCK_EVENTS=1 en dev.
 * Nunca se renderizan en producción.
 */
export const MOCK_EVENTS_ENABLED =
  process.env.NODE_ENV === 'development' && process.env.MOCK_EVENTS === '1';

// Mismo formato que entrega Contentful, ej. "2026-07-25T18:00".
const fmt = (d: dayjs.Dayjs) => d.format('YYYY-MM-DDTHH:mm');

// Rich-text mínimo con la misma estructura que Contentful entrega en `description`.
const lineup = (text: string): Document =>
  ({
    nodeType: 'document',
    data: {},
    content: [
      {
        nodeType: 'paragraph',
        data: {},
        content: [{ nodeType: 'text', value: text, marks: [], data: {} }],
      },
    ],
  }) as Document;

// Flyer real de Contentful (host ya permitido en next.config) para que la imagen cargue.
const FLYER = {
  url: 'https://images.ctfassets.net/oifkeit63u1g/2tusAnEr8P6JHODqLVpnim/9e127210a1b4c14ace19c439ad4eaee7/flyer_bassterds.png',
  width: 1080,
  height: 1350,
};

export function getMockEvents(): ContentfulEvent[] {
  const now = dayjs();
  const at = (h: number) => now.startOf('day').hour(h); // hora fija del día

  return [
    // 1. PASADO → el filtro debe OCULTARLO (terminó hace 2 días).
    {
      id: 'mock-pasado',
      title: 'TEST · PASADO (debe ocultarse)',
      venue: 'Club Sótano',
      address: 'Lira 1847, Santiago',
      date: fmt(now.subtract(2, 'day').hour(22)),
      endDate: fmt(now.subtract(2, 'day').hour(23).add(1, 'day').hour(4)),
      description: lineup('Este evento ya terminó — no debería aparecer en la home.'),
      tickets: 'https://example.com/tickets',
      flyer: FLYER,
    },

    // 2. AHORA → está ocurriendo (empezó hace 1h, termina en 3h).
    {
      id: 'mock-ahora',
      title: 'TEST · AHORA',
      venue: 'Centro de Eventos ORA',
      address: 'Irarrázaval #2051',
      date: fmt(now.subtract(1, 'hour')),
      endDate: fmt(now.add(3, 'hour')),
      description: lineup('BRISTOL / ROACH / FAT PABLO / DRUMBLACK / FRANTIK'),
      tickets: 'https://example.com/tickets',
      flyer: FLYER,
    },

    // 3. HOY → empieza más tarde hoy (23:00). Sin flyer, para probar "NO FLYER".
    {
      id: 'mock-hoy',
      title: 'TEST · HOY',
      venue: 'Blondie',
      address: 'Alameda 2879, Santiago',
      date: fmt(at(23)),
      endDate: fmt(at(23).add(1, 'day').hour(5)),
      description: lineup('SKULLZER / ESPIRAL / TORCIDA / VAGRANT'),
      tickets: 'https://example.com/tickets',
      // sin flyer a propósito
    },

    // 4. MAÑANA
    {
      id: 'mock-manana',
      title: 'TEST · MAÑANA',
      venue: 'Club Chocolate',
      address: 'Ernesto Pinto Lagarrigue 192',
      date: fmt(now.add(1, 'day').hour(22)),
      endDate: fmt(now.add(2, 'day').hour(4)),
      description: lineup('ALIEN WARK B2B KILLSTEP / ROBIMESS'),
      tickets: 'https://example.com/tickets',
      flyer: FLYER,
    },

    // 5. ESTA SEMANA → pasado mañana (hoy + 2 días), siempre a futuro.
    //    Nota: solo cae en "esta semana" si +2 días sigue en la misma semana ISO
    //    (lun–vie). Cerca del fin de semana pasa a "próxima semana" — comportamiento
    //    correcto del calendario, no un bug.
    {
      id: 'mock-esta-semana',
      title: 'TEST · ESTA SEMANA',
      venue: 'Bar Loreto',
      address: 'Loreto 435, Recoleta',
      date: fmt(now.add(2, 'day').hour(22)),
      endDate: fmt(now.add(3, 'day').hour(4)),
      description: lineup('THE PUMPKIN TERROR & KAPZA'),
      tickets: 'https://example.com/tickets',
      flyer: FLYER,
    },

    // 6. PRÓXIMA SEMANA → semana ISO siguiente (miércoles próximo).
    {
      id: 'mock-proxima-semana',
      title: 'TEST · PRÓXIMA SEMANA',
      venue: 'Centro de Eventos ORA',
      address: 'Irarrázaval #2051',
      date: fmt(now.startOf('isoWeek').add(1, 'week').add(2, 'day').hour(18)),
      endDate: fmt(now.startOf('isoWeek').add(1, 'week').add(2, 'day').hour(23)),
      description: lineup('SO LIQUID crew'),
      tickets: 'https://example.com/tickets',
      flyer: FLYER,
    },

    // 7. SIN BADGE → futuro lejano (más de 2 semanas), muestra solo la fecha.
    {
      id: 'mock-lejano',
      title: 'TEST · FUTURO LEJANO (sin badge)',
      venue: 'Movistar Arena',
      address: 'Av. Beaucheff 1204',
      date: fmt(now.add(3, 'week').hour(20)),
      endDate: fmt(now.add(3, 'week').add(1, 'day').hour(2)),
      description: lineup('Line-up por anunciar.'),
      tickets: 'https://example.com/tickets',
      flyer: FLYER,
    },
  ];
}
