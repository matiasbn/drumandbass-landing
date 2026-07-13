import { Metadata } from 'next';

import JunglistsClient from './JunglistsClient';

export const metadata: Metadata = {
  title: 'Junglists - Admin - Drum and Bass Chile',
  robots: { index: false, follow: false },
};

export default function JunglistsPage() {
  return <JunglistsClient />;
}
