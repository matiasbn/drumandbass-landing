import { Metadata } from 'next';

import StreamingsClient from './StreamingsClient';

export const metadata: Metadata = {
  title: 'Streamings - Admin - Drum and Bass Chile',
  robots: { index: false, follow: false },
};

export default function StreamingsPage() {
  return <StreamingsClient />;
}
