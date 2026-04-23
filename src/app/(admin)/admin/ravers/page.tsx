import { Metadata } from 'next';
import RaversClient from './RaversClient';

export const metadata: Metadata = {
  title: 'Ravers - Admin - Drum and Bass Chile',
  robots: { index: false, follow: false },
};

export default function RaversPage() {
  return <RaversClient />;
}
