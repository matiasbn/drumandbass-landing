import { RemixiconComponentType } from "@remixicon/react";

// Evento del CMS propio (Supabase, tablas cms_events/cms_streamings).
// Fechas en formato 'YYYY-MM-DDTHH:mm' (hora local). description es HTML
// (editado con tiptap en /admin/eventos).
export interface CmsEvent {
  id: string;
  title: string;
  venue?: string;
  address?: string;
  date: string;
  endDate?: string;
  description?: string;
  /** URL de venta activa (la que muestra el botón TICKETS). */
  tickets?: string;
  /** Todas las URLs de venta que usó el evento (incluida la activa). Para analytics. */
  ticketLinks?: string[];
  info?: string;
  flyer?: {
    url: string;
    width: number;
    height: number;
  };
  /**
   * Si el evento tiene un descuento Junglist activo. Solo el booleano: el código
   * jamás se expone acá porque este tipo viaja al HTML público (ISR). El código
   * se pide a /api/evento/[id]/coupon, contra sesión.
   */
  hasCoupon?: boolean;
}

export interface CmsStreaming {
  id: string;
  name: string;
  youtubeUrl: string;
  date: string;
  endDate?: string;
}

export interface SocialLink {
  platform: string;
  url: string;
  icon: RemixiconComponentType;
}
