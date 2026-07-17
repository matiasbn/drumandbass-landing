import { Metadata } from 'next';

import EventosClient from './EventosClient';

export const metadata: Metadata = {
  title: 'Eventos - Admin - Drum and Bass Chile',
  robots: { index: false, follow: false },
};

export default function EventosPage() {
  return <EventosClient />;
}
