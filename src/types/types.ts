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
  tickets?: string;
  info?: string;
  flyer?: {
    url: string;
    width: number;
    height: number;
  };
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
