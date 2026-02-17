import { RemixiconComponentType } from "@remixicon/react";
import type { Document } from "@contentful/rich-text-types";

export interface ContentfulEvent {
  id: string;
  title: string;
  venue?: string;
  address?: string;
  date: string;
  endDate?: string;
  description?: Document;
  tickets?: string;
  info?: string;
  flyer?: {
    url: string;
    width: number;
    height: number;
  };
}

export interface ContentfulStreaming {
  id: string;
  title: string;
  youtubeUrl: string;
  date: string;
  endDate?: string;
}

export interface SocialLink {
  platform: string;
  url: string;
  icon: RemixiconComponentType;
}
