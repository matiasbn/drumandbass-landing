import { Metadata } from 'next';
import RaversClient from './RaversClient';

export const metadata: Metadata = {
  title: 'No registrados - Admin - Drum and Bass Chile',
  robots: { index: false, follow: false },
};

export default function RaversPage() {
  return <RaversClient />;
}
