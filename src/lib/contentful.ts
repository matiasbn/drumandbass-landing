import { createClient, type Asset, type EntryFieldTypes } from 'contentful';

import { ContentfulEvent } from '@/src/types/types';

interface EventSkeleton {
  contentTypeId: 'event';
  fields: {
    title: EntryFieldTypes.Text;
    venue?: EntryFieldTypes.Text;
    address?: EntryFieldTypes.Text;
    date: EntryFieldTypes.Text;
    endDate: EntryFieldTypes.Text;
    description?: EntryFieldTypes.RichText;
    tickets?: EntryFieldTypes.Text;
    info?: EntryFieldTypes.Text;
    flyer?: EntryFieldTypes.AssetLink;
  };
}

const client = createClient({
  space: process.env.CONTENTFUL_SPACE_ID!,
  accessToken: process.env.CONTENTFUL_ACCESS_TOKEN!,
});

export async function getEvents(): Promise<ContentfulEvent[]> {
  const response = await client.getEntries<EventSkeleton>({
    content_type: 'event',
  });
  return response.items.map(({fields, sys}) => {
    const flyerAsset = fields.flyer as Asset | undefined;
    const flyerFile = flyerAsset?.fields?.file;
    const imageDetails = flyerFile?.details as { image?: { width: number; height: number } } | undefined;
    const flyer = flyerFile ? {
      url: `https:${flyerFile.url}`,
      width: imageDetails?.image?.width ?? 0,
      height: imageDetails?.image?.height ?? 0,
    } : undefined;

    return {
      id: sys.id,
      title: fields.title as string,
      venue: fields.venue as string | undefined,
      address: fields.address as string | undefined,
      date: fields.date as string,
      endDate: fields.endDate as string | undefined,
      description: fields.description as ContentfulEvent['description'],
      tickets: fields.tickets as string | undefined,
      info: fields.info as string | undefined,
      flyer
    };
  });
}
